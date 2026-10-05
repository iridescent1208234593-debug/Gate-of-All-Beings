"""Account recovery: hashed answers, persistent throttling, atomic password updates."""
import time
import unicodedata


def init_schema(conn):
    conn.execute('CREATE TABLE IF NOT EXISTS account_recovery (uid INTEGER PRIMARY KEY, question TEXT NOT NULL, answer_hash TEXT NOT NULL)')
    conn.execute('CREATE TABLE IF NOT EXISTS security_attempts (bucket TEXT NOT NULL, at REAL NOT NULL)')
    conn.execute('CREATE INDEX IF NOT EXISTS security_attempts_bucket ON security_attempts(bucket, at)')


def normalized_answer(value):
    return unicodedata.normalize('NFKC', value).strip().casefold()


def handle_security(handler, action, api):
    reply = handler._json
    origin = handler.headers.get('Origin')
    if origin and origin not in ('https://huiguan.iridescently.xyz', 'http://127.0.0.1:8089', 'http://localhost:8089'):
        return reply(403, {'error': '请从会馆账户页面操作'})
    if handler.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
        return reply(415, {'error': '请使用账户页面提交'})
    body = handler._read_json()
    if body is None:
        return
    if not isinstance(body, dict) or any(not isinstance(v, str) for v in body.values()):
        return reply(400, {'error': '输入格式不正确'})
    if any(len(v) > 256 for v in body.values()):
        return reply(400, {'error': '输入内容过长'})
    username = body.get('username', '').strip()
    ident = None
    if action in ('settings', 'change', 'setup'):
        session = api['read_session'](handler._get_session())
        ident = api['resolve_identity'](session['kind'], session['uid']) if session else None
        if not ident:
            return reply(401, {'error': '登录已失效，请重新登录'})
        if ident['kind'] != 'local':
            return reply(400, {'error': 'USSO 账号请到 USSO 修改密码；这里仅管理站内账号'})
        username = ident['username']
    # Count both per-account and per-IP attempts, persisted across restarts.
    if action != 'settings':
        scope = 'question' if action == 'question' else 'verify'
        buckets = [(scope + ':user:' + username.casefold(), 20 if scope == 'question' else 5),
                   (scope + ':ip:' + handler._client_ip(), 60 if scope == 'question' else 30)]
        with api['DB_LOCK']:
            conn = api['db']()
            try:
                conn.execute('BEGIN IMMEDIATE')
                now = time.time()
                conn.execute('DELETE FROM security_attempts WHERE at < ?', (now - 900,))
                blocked = any(conn.execute('SELECT count(*) FROM security_attempts WHERE bucket=?', (key,)).fetchone()[0] >= limit for key, limit in buckets)
                if not blocked:
                    conn.executemany('INSERT INTO security_attempts VALUES (?,?)', [(key, now) for key, _ in buckets])
                conn.commit()
            finally:
                conn.close()
        if blocked:
            return reply(429, {'error': '尝试过于频繁，请 15 分钟后再试'})
    user = api['get_local_user_by_name'](username)
    conn = api['db']()
    try:
        recovery = conn.execute('SELECT question, answer_hash FROM account_recovery WHERE uid=?', (user['uid'],)).fetchone() if user else None
    finally:
        conn.close()
    if action == 'settings':
        return reply(200, {'ok': True, 'configured': bool(recovery), 'question': recovery['question'] if recovery else ''})
    if action == 'question':
        if not user or user['status'] != 'active' or not recovery:
            return reply(400, {'error': '该账号未设置找回问题或不可用，请检查用户名；尚有已登录设备时，请到“账户安全”设置'})
        return reply(200, {'ok': True, 'question': recovery['question']})
    if action not in ('reset', 'change', 'setup'):
        return reply(404, {'error': '未知操作'})
    if action == 'reset':
        valid = user and user['status'] == 'active' and recovery and api['verify_password'](normalized_answer(body.get('answer', '')), recovery['answer_hash'])
        if not valid:
            return reply(401, {'error': '账号或答案不正确，或尚未设置找回问题'})
    elif not api['verify_password'](body.get('current_password', ''), user['pass_hash']):
        return reply(401, {'error': '当前密码不正确，请重新输入'})
    if action == 'setup':
        question = body.get('question', '').strip()
        answer = normalized_answer(body.get('answer', ''))
        if not 4 <= len(question) <= 120 or not 4 <= len(answer) <= 128:
            return reply(400, {'error': '提示问题需 4–120 个字，答案需 4–128 个字'})
        if answer == normalized_answer(username) or answer == normalized_answer(body.get('current_password', '')):
            return reply(400, {'error': '答案不能与用户名或当前密码相同'})
        answer_hash = api['hash_password'](answer)
    else:
        password = body.get('new_password', '')
        if not 6 <= len(password) <= 64:
            return reply(400, {'error': '新密码长度需在 6–64 位之间'})
        if password != body.get('confirm_password', ''):
            return reply(400, {'error': '两次输入的新密码不一致'})
        password_hash = api['hash_password'](password)
    with api['DB_LOCK']:
        conn = api['db']()
        try:
            conn.execute('BEGIN IMMEDIATE')
            current = conn.execute('SELECT pass_hash, status FROM local_users WHERE uid=?', (user['uid'],)).fetchone()
            fresh = conn.execute('SELECT answer_hash FROM account_recovery WHERE uid=?', (user['uid'],)).fetchone()
            if not current or current['status'] != 'active' or current['pass_hash'] != user['pass_hash'] or (action == 'reset' and (not fresh or fresh['answer_hash'] != recovery['answer_hash'])):
                conn.rollback()
                return reply(409, {'error': '账户信息刚刚发生变化，请刷新后重试'})
            if action == 'setup':
                conn.execute('INSERT INTO account_recovery VALUES (?,?,?) ON CONFLICT(uid) DO UPDATE SET question=excluded.question, answer_hash=excluded.answer_hash', (user['uid'], question, answer_hash))
            else:
                conn.execute('UPDATE local_users SET pass_hash=? WHERE uid=?', (password_hash, user['uid']))
                conn.execute("DELETE FROM sessions_db WHERE kind='local' AND uid=?", (str(user['uid']),))
            conn.commit()
        finally:
            conn.close()
    if action == 'setup':
        return reply(200, {'ok': True, 'message': '找回问题已保存，请记住答案。'})
    cookies = ['session=; Path=/; Domain=.iridescently.xyz; Max-Age=0; HttpOnly; Secure; SameSite=Lax', handler._sso_clear_cookie()]
    return reply(200, {'ok': True, 'message': '密码已更新，请使用新密码重新登录。'}, cookie=cookies)
