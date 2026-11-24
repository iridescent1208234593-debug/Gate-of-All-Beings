"""Onboarding Progress over HTTP. Run as a separate process: python -B this_file.py. Synthetic loopback only."""
from contextlib import closing
from pathlib import Path
import http.client
import http.server
import json
import os
import sys
import tempfile
import threading


def run():
    root = Path(__file__).resolve().parents[3]
    with tempfile.TemporaryDirectory(prefix='onboarding-http-fixture-') as d:
        for k in list(os.environ):
            if k.startswith(('IRIDESCENTLY_', 'LAB_', 'USSO_', 'HX_', 'TURNSTILE_')):
                os.environ.pop(k)
        os.environ.update(IRIDESCENTLY_STORAGE_ROOT=str(Path(d) / 'synthetic-storage'), IRIDESCENTLY_ENVIRONMENT='test')
        sys.path[:0] = [str(root / 'apps/huiguan'), str(root / 'services/platform')]
        from storage_paths import initialize_storage
        initialize_storage()
        import server_huiguan as s
        import onboarding_progress as op
        from site_domains import SITE_DOMAIN, site_url
        origin = site_url('huiguan')
        ids = {}
        with closing(s.db()) as db, db:
            for label in ('newcomer', 'veteran', 'skipper'):
                uid = db.execute("INSERT INTO local_users(username,nickname,pass_hash,role) VALUES(?,?,?,?)",
                                 (label + '-private-login', label, 'fixture', 'user')).lastrowid
                ids[label] = str(uid)
            # Registered after the guide shipped vs. long before it.
            s.legal_consent.record(db, 'local', ids['newcomer'], now=op.ROLLOUT_AT + 60)
            s.legal_consent.record(db, 'local', ids['skipper'], now=op.ROLLOUT_AT + 60)
            s.legal_consent.record(db, 'local', ids['veteran'], now=op.ROLLOUT_AT - 86400 * 30)
        sessions = {label: s.create_session('local', uid, SITE_DOMAIN) for label, uid in ids.items()}
        with http.server.ThreadingHTTPServer(('127.0.0.1', 0), s.Handler) as srv:
            threading.Thread(target=srv.serve_forever, daemon=True).start()

            def call(path, actor=None, body=None):
                h = {'Host': origin.split('://', 1)[1]}
                if actor:
                    h['Cookie'] = 'session=' + sessions[actor]
                if body is not None:
                    h.update({'Origin': origin, 'Content-Type': 'application/json'})
                with closing(http.client.HTTPConnection('127.0.0.1', srv.server_port, timeout=5)) as c:
                    c.request('GET' if body is None else 'POST', path, json.dumps(body) if body is not None else None, h)
                    r = c.getresponse()
                    return r.status, json.loads(r.read())

            # Visitors read an empty shape and cannot write.
            status, data = call('/api/onboarding')
            assert status == 200 and data == {'logged_in': False, 'chapters': {}}, data
            assert call('/api/onboarding', body={'chapter': 'world', 'status': 'completed'})[0] == 401

            # A new account starts both chapters fresh.
            status, data = call('/api/onboarding', 'newcomer')
            assert status == 200 and data['chapters']['world']['status'] == 'new', data
            assert data['chapters']['identity'] == {'status': 'new', 'seen': []}

            # Steps accumulate; bad keys are dropped; pause and resume.
            status, data = call('/api/onboarding', 'newcomer', {'chapter': 'identity', 'seen': ['hall', 'bad key!', 'hall', 'oc']})
            assert status == 200 and data['status'] == 'active' and data['seen'] == ['hall', 'oc'], data
            status, data = call('/api/onboarding', 'newcomer', {'chapter': 'identity', 'status': 'paused', 'seen': ['gallery']})
            assert data['status'] == 'paused' and data['seen'] == ['hall', 'oc', 'gallery'], data

            # Guest progress merged after sign-in only moves forward.
            status, data = call('/api/onboarding', 'newcomer', {'chapter': 'world', 'status': 'completed', 'merge': True, 'seen': ['door']})
            assert data['status'] == 'completed', data
            status, data = call('/api/onboarding', 'newcomer', {'chapter': 'world', 'status': 'active', 'merge': True})
            assert data['status'] == 'completed', data

            # "重新查看" reopens a finished chapter from the start.
            status, data = call('/api/onboarding', 'newcomer', {'chapter': 'world', 'reset': True})
            assert data['status'] == 'active' and data['seen'] == [], data

            # Skip is final until reopened.
            status, data = call('/api/onboarding', 'skipper', {'chapter': 'identity', 'status': 'skipped'})
            assert data['status'] == 'skipped', data

            # Accounts from before the guide are never put through it.
            status, data = call('/api/onboarding', 'veteran')
            assert {c['status'] for c in data['chapters'].values()} == {'veteran'}, data
            # …and stay veteran on later reads.
            assert call('/api/onboarding', 'veteran')[1]['chapters']['identity']['status'] == 'veteran'
            # …but may reopen it themselves.
            assert call('/api/onboarding', 'veteran', {'chapter': 'identity', 'reset': True})[1]['status'] == 'active'

            # Contract errors.
            assert call('/api/onboarding', 'newcomer', {'chapter': 'life', 'status': 'completed'})[0] == 400
            assert call('/api/onboarding', 'newcomer', {'chapter': 'world', 'status': 'veteran'})[1]['code'] == 'unknown_status'
            assert call('/api/onboarding', 'newcomer', {'chapter': 'world', 'status': 7})[0] == 400

            # Per-account isolation.
            assert call('/api/onboarding', 'skipper')[1]['chapters']['world']['status'] == 'new'
    print('onboarding progress http: ok')


if __name__ == '__main__':
    run()
