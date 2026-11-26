from contextlib import ExitStack
from hashlib import sha256

from fastapi.testclient import TestClient

from lab.app import Lab, create_app
from lab.config import Config
from lab.field_games import NIGHT, PAVILION, RELAY, STATIONS


def test_scene_games(tmp_path):
    """Use real authenticated WebSockets; place test players directly at scene fixtures."""
    lab = Lab(Config(runtime=tmp_path / "runtime", secrets=tmp_path / "secrets", r4_enabled=False))
    origin = "http://127.0.0.1:18300"
    with TestClient(create_app(lab), base_url=origin) as api, ExitStack() as sockets:
        def recv(user, kind):
            for _ in range(40):
                message = user[1].receive_json()
                if message["t"] == kind:
                    return message
            raise AssertionError(kind)

        users = []
        for i in range(5):
            code = lab.auth.create_code("scene-test")[1]
            login = api.post("/api/login", json={"code": code}, headers={"Origin": origin})
            assert login.status_code == 200
            sock = sockets.enter_context(api.websocket_connect(origin.replace("http", "ws", 1) + "/ws",
                                                               headers={"Origin": origin}))
            sock.send_json({"t": "hello", "client": "test"})
            welcome = sock.receive_json()
            assert welcome["t"] == "welcome"
            users.append((welcome["pid"], sock))

        host, partner, third, fourth, observer = users

        def send(user, action, game="", room=None, **data):
            version = lab.hub.minigames.packs[game][2] if game else None
            user[1].send_json(dict(t="minigame", action=action, game=game, table=room, version=version, **data))

        def move_fixture(user, object_id):
            conn = lab.hub.conns[user[0]]
            geo = lab.hub.geometry(conn.space)
            x, _, z = geo.objects[object_id]["position"]
            assert geo.free(x, z)
            conn.x, conn.z = x, z

        def touch(user, object_id):
            user[1].send_json({"t": "interact", "object": object_id})

        move_fixture(host, PAVILION)
        touch(host, PAVILION)
        recv(host, "minigame_open")
        send(host, "catalog")
        assert len(recv(host, "minigame_catalog")["packs"]) == 5
        for game, roster in [(RELAY, [host, partner]), (NIGHT, [host, partner, third, fourth])]:
            send(host, "download", game)
            package = recv(host, "minigame_pack")
            assert sha256(package["data"].encode()).hexdigest() == package["version"]
            send(host, "create", game)
            room = recv(host, "minigame_state")["table"]["id"]
            send(host, "start", game, room)
            recv(host, "minigame_state")
            assert recv(host, "minigame_error")["code"] == "field_players"
            for index, user in enumerate(roster[1:], 1):
                send(user, "join", game, room)
                for member in roster[:index + 1]:
                    recv(member, "minigame_state")
            send(host, "start", game, room)

            def views():
                return [recv(member, "minigame_state")["table"] for member in roster]

            started = views()
            assert all(view["phase"] == "running" for view in started)
            send(observer, "state", game)
            view = recv(observer, "minigame_state")["table"]
            assert view["role"] == "" and not any(p["revealed"] for p in view["players"])

            if game == RELAY:
                by_title = {title: key for key, title in STATIONS.items()}
                station = by_title[started[0]["next"]]
                touch(host, station)
                assert recv(host, "error")["code"] == "too_far"
                for step in range(6):
                    user = roster[step % 2]
                    move_fixture(user, station)
                    touch(user, station)
                    progressed = views()
                    assert all(view["progress"] == step + 1 for view in progressed)
                    if step < 5:
                        station = by_title[progressed[0]["next"]]
                    if step == 0:
                        move_fixture(user, station)
                        touch(user, station)
                        assert recv(user, "minigame_error")["code"] == "field_pass"
                assert all(view["reason"] == "relay" for view in progressed)
            else:
                roles = [view["role"] for view in started]
                assert sorted(roles) == ["keeper", "keeper", "keeper", "saboteur"]
                suspect = roster[roles.index("saboteur")]
                keeper = roster[roles.index("keeper")]
                station = "firefly-west"
                move_fixture(keeper, station)
                touch(keeper, station)
                assert all(view["progress"] == 1 for view in views())
                lab.hub.minigames.field.rooms["hall", game].next_jam = 0
                move_fixture(suspect, station)
                touch(suspect, station)
                assert all(view["progress"] == 0 for view in views())
                send(keeper, "meeting", game, room)
                assert recv(keeper, "minigame_error")["code"] == "field_near"
                move_fixture(keeper, PAVILION)
                send(keeper, "meeting", game, room)
                assert all(view["phase"] == "meeting" for view in views())
                for user in roster:
                    send(user, "vote", game, room, target=suspect[0] if user != suspect else "")
                    voted = views()
                    assert all("votes" not in view for view in voted)
                assert all(view["reason"] == "keepers" for view in voted)
                assert all([p["pid"] for p in view["players"] if p["revealed"]] == [suspect[0]] for view in voted)

            send(host, "leave", game, room)
            assert views() == [None] * len(roster)
