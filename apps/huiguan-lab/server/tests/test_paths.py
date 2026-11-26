"""LAB 2.2: player-placed dirt-path tiles, and the old 玩家初始场 merged into the hall."""
import json
import time

from test_gateway import enter, recv_until
from lab.store import Store


def cell_under(w):
    return int(w["you"]["x"] // 1), int(w["you"]["z"] // 1)


def test_tiles_place_sync_permissions_and_persist(gateway):
    g = gateway
    _, ca = g.new_code(); _, cb = g.new_code()
    a, wa = enter(g, g.login(ca), "铺路人")
    b, wb = enter(g, g.login(cb), "路人")
    # the LAB lays one road from the home field to the campfire
    seeded = {(x, z) for x, z, kind, by in wa["tiles"] if by == "lab"}
    assert (18, 0) in seeded and (18, 9) in seeded and all(k == "dirt" for _, _, k, _ in wa["tiles"])
    x, z = cell_under(wa)
    x += 1
    a.send(json.dumps({"t": "tile", "x": x, "z": z, "on": True}))
    for s in (a, b):
        m = recv_until(s, "tile", pred=lambda m: (m["x"], m["z"]) == (x, z))
        assert m["on"] is True and m["by"] == wa["pid"] and m["kind"] == "dirt"
    # One starter soil tile: a second placement is refused until the first is recovered.
    a.send(json.dumps({"t": "tile", "x": x+1, "z": z, "on": True}))
    assert recv_until(a, "error")["code"] == "no_soil"
    a.send(json.dumps({"t": "tile", "x": x, "z": z, "on": False}))
    recv_until(a,"inventory",pred=lambda m:m["soil"]==1)
    # floats that are whole numbers are fine (Godot JSON), fractions are not
    a.send(json.dumps({"t": "tile", "x": float(x + 1), "z": float(z), "on": True}))
    recv_until(a, "tile", pred=lambda m: (m["x"], m["z"]) == (x + 1, z))
    a.send(json.dumps({"t": "tile", "x": x + 0.5, "z": z, "on": True}))
    assert recv_until(a, "error")["code"] == "bad_request"
    # out of reach, blocked by the house / the river
    a.send(json.dumps({"t": "tile", "x": x + 9, "z": z, "on": True}))
    assert recv_until(a, "error")["code"] == "tile_too_far"
    # Move the single soil item back to its first cell for the ownership check.
    a.send(json.dumps({"t":"tile", "x":x+1,"z":z,"on":False}))
    recv_until(a,"inventory",pred=lambda m:m["soil"]==1)
    a.send(json.dumps({"t":"tile", "x":x,"z":z,"on":True}))
    recv_until(a,"inventory",pred=lambda m:m["soil"]==0)
    # someone else cannot lift my tile, but can lift the LAB's
    b.send(json.dumps({"t": "tile", "x": x, "z": z, "on": False}))
    assert recv_until(b, "error")["code"] == "tile_not_yours"
    a.close(); b.close()
    time.sleep(0.3)
    g.stop(); g.start()
    s, w = enter(g, g.login(ca), "铺路人")
    cells = {(cx, cz): by for cx, cz, _, by in w["tiles"]}
    assert cells.get((x, z)) == wa["pid"] and (x + 1, z) not in cells
    s.close()


def test_tiles_refuse_house_river_and_flood(gateway):
    g = gateway
    _, ca = g.new_code()
    a, wa = enter(g, g.login(ca), "试探")
    # walk next to the house corner (13.8, -5.9) and try to pave inside it
    from test_gateway import walk_to
    p = walk_to(a, (wa["you"]["x"], wa["you"]["z"]), (14.6, -5.2))
    a.send(json.dumps({"t": "tile", "x": 12, "z": -7, "on": True}))
    assert recv_until(a, "error")["code"] == "tile_blocked"
    # flood: more than 24 changes in 10 s are refused
    codes = []
    for i in range(30):
        a.send(json.dumps({"t": "tile", "x": 14 + (i % 2), "z": -5 + (i // 2) % 3, "on": i % 4 < 2}))
    end = time.time() + 3
    while time.time() < end:
        try:
            m = json.loads(a.recv(timeout=0.3))
        except TimeoutError:
            break
        if m["t"] == "error":
            codes.append(m["code"])
    assert "tile_rate_limited" in codes
    a.close()


def test_old_initial_space_is_merged_into_hall(gateway):
    g = gateway
    _, code = g.new_code()
    s, w = enter(g, g.login(code), "老玩家")
    pid = w["pid"]
    s.close()
    time.sleep(0.3)
    g.stop()
    # Recreate what a LAB 2.1 database looked like: a separate 'initial' space with a creature,
    # a tile and this player standing in it.
    store = Store(g.tmp / "runtime" / "data" / "lab.sqlite")
    now = time.time()
    store.exec("INSERT INTO spaces(id,kind,title,template,created_at) VALUES('initial','public','玩家初始场','initial',?)", (now,))
    frog = {"id": "e_oldfrog", "space": "initial", "x": 17.0, "z": 15.0, "species": "青蛙", "kind": "creature",
            "asset": "b_frog", "height": 1.2, "speed": 0.0, "behavior": "idle", "heading": 0.0, "visible": True,
            "stage": 0, "grow_seconds": 0, "growth_at": now, "stages": []}
    store.exec("INSERT INTO lab_entities(id,space_id,state,updated_at) VALUES(?,?,?,?)", (frog["id"], "initial", json.dumps(frog), now))
    store.exec("INSERT INTO lab_tiles(space_id,x,z,kind,placed_by,placed_at) VALUES('initial',16,14,'dirt',?,?)", (pid, now))
    store.exec("UPDATE players SET space='initial', x=17.5, z=15.5 WHERE pid=?", (pid,))
    store.close()
    g.start()
    s, w = enter(g, g.login(code), "老玩家")
    assert w["space"]["id"] == "hall"
    assert abs(w["you"]["x"] - 17.5) < 0.01 and abs(w["you"]["z"] - (15.5 - 18)) < 0.01
    frog_now = next(n for n in w["npcs"] if n["id"] == "e_oldfrog")
    assert (frog_now["x"], frog_now["z"]) == (17.0, -3.0)
    assert [16, -4, "dirt", pid] in w["tiles"]
    assert all(sp["id"] != "initial" for sp in w["spaces"])
    s.close()
    time.sleep(0.3)
    g.stop()
    store = Store(g.tmp / "runtime" / "data" / "lab.sqlite")
    assert not store.one("SELECT 1 FROM spaces WHERE id='initial'")
    assert store.one("SELECT count(*) n FROM audit WHERE action='space.merge_initial_into_hall'")["n"] == 1
    store.close()
    g.start()           # a second start must not move anything again
    s, w = enter(g, g.login(code), "老玩家")
    assert next(n for n in w["npcs"] if n["id"] == "e_oldfrog")["z"] == -3.0
    s.close()
