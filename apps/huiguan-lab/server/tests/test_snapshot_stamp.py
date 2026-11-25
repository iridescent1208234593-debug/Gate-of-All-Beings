import json, math, time
from contextlib import closing

from test_gateway import enter, recv_until


def test_additive_monotonic_snapshot_time(gateway):
    _, code_a = gateway.new_code(label="timestamp-a")
    _, code_b = gateway.new_code(label="timestamp-b")
    with closing(gateway.login(code_a)) as a_http, closing(gateway.login(code_b)) as b_http:
        a, wa = enter(gateway, a_http, "Timestamp A")
        b, wb = enter(gateway, b_http, "Timestamp B")
        try:
            x, z = wa["you"]["x"], wa["you"]["z"]
            for i in (1, 2, 3):
                a.send(json.dumps({"t":"move","x":x + i*0.09,"z":z,"dir":0.0,"anim":"walk","seq":i}))
                def contains_position(m):
                    return any(r[0] == wa["pid"] and abs(r[1] - (x + i*0.09)) < 1e-4 for r in m["p"])
                snapshot=recv_until(b,"s",pred=contains_position)
                assert set(snapshot) == {"t","seq","full","p","time"}
                # An unchanged client keeps consuming the same 5 columns and old packet keys.
                legacy = {k: snapshot[k] for k in ("t","seq","full","p")}
                assert all(len(row) == 5 for row in legacy["p"])
                stamp=snapshot["time"]
                assert math.isfinite(stamp) and stamp > 0
                if i > 1:
                    assert stamp > prev and snapshot["seq"] > prev_seq
                    assert stamp - prev < 2
                prev, prev_seq=stamp,snapshot["seq"]
                time.sleep(0.12)
        finally:
            a.close()
            b.close()
