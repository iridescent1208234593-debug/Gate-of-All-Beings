"""Fixture accounts for the onboarding browser scenarios. Test storage only: python fixture.py <repo> <storage>."""
import os, sys, json, pathlib, time
root = pathlib.Path(sys.argv[1]); store = sys.argv[2]
for k in list(os.environ):
    if k.startswith(('IRIDESCENTLY_','LAB_','USSO_','HX_','TURNSTILE_')): os.environ.pop(k)
os.environ.update(IRIDESCENTLY_STORAGE_ROOT=store, IRIDESCENTLY_ENVIRONMENT='test', HX_SSO_SECRET='local-test')
sys.path[:0] = [str(root/'apps/huiguan'), str(root/'services/platform')]
import server_huiguan as s, onboarding_progress as op
from site_domains import SITE_DOMAIN
from contextlib import closing
out = {}
with closing(s.db()) as db, db:
    for label, when in (('fresh', time.time()), ('old', time.time() - 86400 * 90), ('merge', time.time()), ('other', time.time())):
        row = db.execute("SELECT uid FROM local_users WHERE username=?", ('guide-' + label,)).fetchone()
        uid = row[0] if row else db.execute("INSERT INTO local_users(username,nickname,pass_hash,role,status) VALUES(?,?,?,?,?)",
                                            ('guide-' + label, '测试' + label, 'fixture', 'user', 'active')).lastrowid
        db.execute("DELETE FROM onboarding_progress WHERE kind='local' AND uid=?", (str(uid),))
        db.execute("DELETE FROM legal_consents WHERE kind='local' AND uid=?", (str(uid),))
        s.legal_consent.record(db, 'local', uid, now=when)
        out[label] = uid
out = {k: s.create_session('local', v, 'iridescently.cn') for k, v in out.items()}
print(json.dumps(out))
