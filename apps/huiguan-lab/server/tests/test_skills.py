"""Skill tree rules: points, tier prerequisites, slots, cooldowns, online points (temporary sqlite only)."""
import asyncio
from pathlib import Path

from lab.skills import SkillBook, install
from lab.store import Store

SKILLS = Path(__file__).resolve().parents[2] / "client" / "data" / "skills.json"


def make(tmp_path):
    return SkillBook(Store(tmp_path / "t.sqlite"), SKILLS)


def tier_ids(book, branch, tier):
    return sorted(book.by_tier[(branch, tier)])


def test_catalog_covers_all_effects(tmp_path):
    book = make(tmp_path)
    assert len(book.skills) == 244
    assert len(book.data["branches"]) == 21
    assert all(s["name"] for s in book.skills.values())


def test_unlock_needs_previous_tier_and_points(tmp_path):
    book = make(tmp_path)
    t1, t2 = tier_ids(book, "fire", 1), tier_ids(book, "fire", 2)
    assert book.unlock("p1", t2[0]) == "skill_needs_previous"
    assert book.unlock("p1", t1[0]) is None
    assert book.view("p1")["points"] == 9
    assert book.unlock("p1", t1[0]) == "skill_already"
    assert book.unlock("p1", t2[0]) is None
    assert book.view("p1")["points"] == 7
    # first unlocks fill the bar
    assert book.view("p1")["equipped"][:2] == [t1[0], t2[0]]
    book.grant("p1", points=-7)
    assert book.unlock("p1", t1[1]) == "skill_no_points"


def test_equip_moves_and_cooldown(tmp_path):
    book = make(tmp_path)
    a, b = tier_ids(book, "melee", 1)[:2]
    book.unlock("p", a); book.unlock("p", b)
    assert book.equip("p", 3, a) is None
    assert book.view("p")["equipped"] == ["", b, "", a]
    assert book.equip("p", 0, "fire/candle") == "skill_locked"
    assert book.equip("p", 9, a) == "skill_bad_slot"
    assert book.cast_check("p", a, 100.0) is None
    assert book.cast_check("p", b, 100.1) == "skill_cooldown"       # global
    assert book.cast_check("p", b, 101.0) is None
    assert book.cast_check("p", a, 101.0) == "skill_cooldown"       # per skill
    assert book.cast_check("p", "fire/candle", 200.0) == "skill_not_equipped"


def test_online_points_and_admin(tmp_path):
    book = make(tmp_path)
    assert not book.tick_online("p", 300)
    assert book.tick_online("p", 300)
    assert book.view("p")["points"] == 11
    v = book.grant("p", unlock_all=True)
    assert len(v["unlocked"]) == 244
    v = book.grant("p", reset=True)
    assert v["unlocked"] == [] and v["points"] == 10


def test_handlers_broadcast_cast(tmp_path):
    class FakeHub:
        def __init__(self):
            self.sent, self.cast, self.counters = [], [], {}
        def send(self, c, m): self.sent.append(m)
        def broadcast(self, sid, m, exclude=None): self.cast.append((sid, m))

    class C:
        pid, space, x, z, dir = "p", "hall", 1.0, 2.0, 0.5

    book = install(FakeHub, Store(tmp_path / "h.sqlite"), SKILLS)
    hub, c = FakeHub(), C()
    first = tier_ids(book, "holy", 1)[0]
    asyncio.run(hub.on_skill_unlock(c, {"id": first}, 0))
    assert hub.sent[-1]["unlocked"] == [first]
    asyncio.run(hub.on_skill_cast(c, {"id": first}, 10.0))
    assert hub.cast == [("hall", {"t": "cast", "pid": "p", "id": first, "x": 1.0, "z": 2.0, "dir": 0.5})]
    asyncio.run(hub.on_skill_cast(c, {"id": first}, 10.1))
    assert hub.sent[-1] == {"t": "skill_error", "code": "skill_cooldown"}


def test_gateway_skill_flow_and_fx_route(gateway):
    """Real gateway: unlock, equip, cast reaches the other player, points persist, /fx needs a session."""
    import json as _json
    import httpx
    from test_gateway import enter, recv_until
    g = gateway
    _, code = g.new_code(); _, code_b = g.new_code()
    ca = g.login(code)
    a, wa = enter(g, ca, "施法者")
    b, _ = enter(g, g.login(code_b), "观众")
    a.send(_json.dumps({"t": "skill_state"}))
    st = recv_until(a, "skills")
    assert st["points"] == 10 and st["unlocked"] == [] and st["equipped"] == ["", "", "", ""]
    book = _json.loads(SKILLS.read_text(encoding="utf-8"))
    first = book["branches"][0]["skills"][0]
    a.send(_json.dumps({"t": "skill_cast", "id": first}))
    assert recv_until(a, "skill_error")["code"] == "skill_not_equipped"
    a.send(_json.dumps({"t": "skill_unlock", "id": first}))
    st = recv_until(a, "skills")
    assert st["points"] == 10 - book["skills"][first]["cost"] and st["equipped"][0] == first
    a.send(_json.dumps({"t": "skill_cast", "id": first}))
    cast = recv_until(b, "cast")
    assert cast["pid"] == wa["pid"] and cast["id"] == first
    # /fx is behind the session cookie and only serves packed effect names
    assert httpx.get(g.base + "/fx/" + first + ".json").status_code == 401
    assert ca.get("/fx/../lab.config.json").status_code == 404
    from lab.auth import set_admin_password
    set_admin_password(g.tmp / "secrets", "correct horse battery")
    adm = httpx.Client(base_url=g.admin, headers={"X-Lab-Admin": "1"})
    assert adm.post("/admin/api/login", json={"password": "correct horse battery"}).status_code == 200
    r = adm.post("/admin/api/skills/" + wa["pid"], json={"unlock_all": True, "points": 5})
    assert r.status_code == 200
    pushed = recv_until(a, "skills", pred=lambda m: len(m["unlocked"]) == 244)
    assert pushed["points"] == 10 - book["skills"][first]["cost"] + 5
    a.close(); b.close()
    # survives a restart
    g.stop(); g.start()
    a, _ = enter(g, g.login(code), "施法者")
    a.send(_json.dumps({"t": "skill_state"}))
    assert len(recv_until(a, "skills")["unlocked"]) == 244
    a.close()
