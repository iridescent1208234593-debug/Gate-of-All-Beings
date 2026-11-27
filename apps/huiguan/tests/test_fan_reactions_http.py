"""#86: fan gallery reactions over real HTTP. Run as a separate process: python -B this_file.py.
Synthetic loopback and temporary test storage only.

Covers the agreed reaction rules: one "like" (favorite) per account that moves between cards,
up/down votes that toggle off and swap, no double counting on repeats, guests cannot write,
and reactions only reach cards the public gallery actually shows.
"""
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
 with tempfile.TemporaryDirectory(prefix='fan-reactions-http-fixture-') as d:
  for k in list(os.environ):
   if k.startswith(('IRIDESCENTLY_', 'LAB_', 'USSO_', 'HX_', 'TURNSTILE_')): os.environ.pop(k)
  os.environ.update(IRIDESCENTLY_STORAGE_ROOT=str(Path(d) / 'synthetic-storage'), IRIDESCENTLY_ENVIRONMENT='test')
  sys.path[:0] = [str(root / 'apps/huiguan'), str(root / 'services/platform')]
  from storage_paths import initialize_storage
  initialize_storage()
  import server_huiguan as s
  from site_domains import SITE_DOMAIN, site_url
  origin = site_url('huiguan')
  s.rate_blocked = lambda *a, **k: False   # the per-minute limit is not under test here
  with closing(s.db()) as db, db:
   ids = {}
   for label in ('owner', 'alice', 'bob'):
    uid = db.execute("INSERT INTO local_users(username,nickname,pass_hash,role) VALUES(?,?,?,?)",
                     (label + '-private-login', label.title(), 'fixture', 'user')).lastrowid
    ids[label] = str(uid)
    s.legal_consent.record(db, 'local', uid)
   s.Handler._ensure_fan_reaction_tables(None, db)
   cards = {}
   for name, public, status in (('public-a', 1, 'approved'), ('public-b', 1, 'approved'),
                                ('pending', 1, 'pending'), ('rejected', 1, 'rejected'), ('hidden', 0, 'approved')):
    cards[name] = db.execute(
     "INSERT INTO fan_characters(user_kind,user_uid,name,type,is_public,review_status,created_at,updated_at) "
     "VALUES('local',?,?,'turtle',?,?,'2026-01-01','2026-01-01')", (ids['owner'], name, public, status)).lastrowid
  sessions = {label: s.create_session('local', uid, SITE_DOMAIN) for label, uid in ids.items()}
  with http.server.ThreadingHTTPServer(('127.0.0.1', 0), s.Handler) as srv:
   threading.Thread(target=srv.serve_forever, daemon=True).start()

   def react(actor, cid, kind):
    h = {'Host': origin.split('://', 1)[1], 'Origin': origin, 'Content-Type': 'application/json'}
    if actor: h['Cookie'] = 'session=' + sessions[actor]
    with closing(http.client.HTTPConnection('127.0.0.1', srv.server_port, timeout=5)) as c:
     c.request('POST', '/api/fan/react', json.dumps({'character_id': cid, 'type': kind}), h)
     r = c.getresponse()
     return r.status, json.loads(r.read() or b'{}')

   def state(actor, cid, kind):
    status, body = react(actor, cid, kind)
    assert status == 200, (actor, cid, kind, status, body)
    return {k: body['state'][k] for k in ('fav', 'up', 'down', 'my_fav', 'my_vote')}

   def rows(table, cid):
    with closing(s.db()) as db:
     return db.execute(f"SELECT COUNT(*) FROM {table} WHERE character_id=?", (cid,)).fetchone()[0]

   a, b = cards['public-a'], cards['public-b']
   # Up, then up again cancels; up → down swaps instead of adding a second vote.
   assert state('alice', a, 'up') == {'fav': 0, 'up': 1, 'down': 0, 'my_fav': False, 'my_vote': 1}
   assert state('alice', a, 'up') == {'fav': 0, 'up': 0, 'down': 0, 'my_fav': False, 'my_vote': 0}
   state('alice', a, 'up')
   assert state('alice', a, 'down') == {'fav': 0, 'up': 0, 'down': 1, 'my_fav': False, 'my_vote': -1}
   assert rows('fan_char_votes', a) == 1
   # Votes from different accounts add up; likes are independent of votes.
   assert state('bob', a, 'up')['up'] == 1 and rows('fan_char_votes', a) == 2
   assert state('alice', a, 'fav') == {'fav': 1, 'up': 1, 'down': 1, 'my_fav': True, 'my_vote': -1}
   # One like per account: liking another card moves it, it is never counted twice.
   status, body = react('alice', b, 'fav')
   assert status == 200 and body['state']['fav'] == 1 and body['prev_state']['fav'] == 0, body
   assert rows('fan_char_favorites', a) == 0 and rows('fan_char_favorites', b) == 1
   assert state('alice', b, 'fav')['fav'] == 0   # liking the same card again cancels
   # Guests cannot write; malformed requests are rejected without touching counts.
   assert react(None, a, 'up')[0] == 401
   assert react('alice', a, 'superlike')[0] == 400 and react('alice', 'x', 'up')[0] == 400
   # Only cards the public gallery shows accept new reactions.
   for name in ('pending', 'rejected', 'hidden'):
    for kind in ('up', 'down', 'fav'):
     status, body = react('bob', cards[name], kind)
     assert status == 404, (name, kind, status, body)
   assert react('bob', 999999, 'up')[0] == 404
   with closing(s.db()) as db:
    hidden_ids = [cards[n] for n in ('pending', 'rejected', 'hidden')] + [999999]
    q = ','.join('?' * len(hidden_ids))
    assert db.execute(f"SELECT COUNT(*) FROM fan_char_votes WHERE character_id IN ({q})", hidden_ids).fetchone()[0] == 0
    assert db.execute(f"SELECT COUNT(*) FROM fan_char_favorites WHERE character_id IN ({q})", hidden_ids).fetchone()[0] == 0
   srv.shutdown()
 print('PASS real HTTP: vote toggle/swap, one moving like, no double counts, guest 401, only public approved cards accept reactions')


if __name__ == '__main__':
 run()
