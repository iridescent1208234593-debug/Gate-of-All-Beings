"""Real dual-client motion cadence and authoritative frog reactions on isolated data."""
import time
from contextlib import closing

from test_gateway import enter, recv_until
from test_live_art import admin


def test_two_clients_share_frog_reaction_and_fast_motion(gateway):
    g = gateway
    _, first_code = g.new_code()
    _, second_code = g.new_code()
    first, second = g.login(first_code), g.login(second_code)
    with closing(admin(g)) as control:
        s1, welcome = enter(g, first, 'First')
        s2, _ = enter(g, second, 'Second')
        start = [welcome['you']['x'] + 0.5, welcome['you']['z']]
        reply = control.post('/admin/api/entities/hall', json={
            'asset': 'b_frog', 'kind': 'creature', 'behavior': 'wander',
            'x': start[0], 'z': start[1], 'speed': 0.8})
        assert reply.status_code == 200, reply.text
        eid = reply.json()['entity']['id']
        try:
            records = []
            for sock in (s1, s2):
                frames = {}
                deadline = time.monotonic() + 2.5
                while time.monotonic() < deadline:
                    packet = recv_until(sock, 'npc_motion', timeout=3)
                    assert packet['space'] == 'hall'
                    for row in packet['motions']:
                        if row[0] == eid:
                            frames[packet['seq']] = (packet['time'], row)
                    if len(frames) >= 18:
                        break
                assert len(frames) >= 15
                records.append(frames)
            shared = records[0].keys() & records[1].keys()
            assert len(shared) >= 8
            assert all(records[0][seq] == records[1][seq] for seq in shared)
            states = {row[1][4] for frames in records for row in frames.values()}
            assert 'watch' in states and 'retreat' in states
            stamps = sorted(value[0] for value in records[0].values())
            assert (stamps[-1] - stamps[0]) / (len(stamps)-1) < 0.18
            assert any(value[1][1:3] != start for value in records[0].values())
        finally:
            s1.close()
            s2.close()
