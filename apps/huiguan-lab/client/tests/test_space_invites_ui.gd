extends SceneTree
## #101: pending invitations are shown with accept/decline; owners see who has not answered yet.

var failed := false

func _initialize() -> void:
	call_deferred("_run")

func _check(ok: bool, detail: String) -> void:
	if not ok:
		failed = true
		push_error(detail)

func _labels(node: Node) -> Array:
	var out: Array = []
	for child in node.find_children("*", "Label", true, false):
		out.append((child as Label).text)
	return out

func _run() -> void:
	var app := (load("res://scenes/main.tscn") as PackedScene).instantiate()
	root.add_child(app)
	await process_frame
	var hall := {"id": "hall", "kind": "public", "title": "西木会馆", "owner": null, "mine": false, "guests": [], "pending": [], "online": 2, "r4_branch": true}
	app.world.space = {"id": "hall"}
	# A guest with one pending invitation: it is listed with accept/decline, not as an enterable space.
	app._on_message({"t": "spaces", "spaces": [hall]})
	app._on_message({"t": "invites", "invites": [{"space": {"id": "sp_1", "title": "小院"}, "from": "主人", "expires_at": 0}]})
	app._render_spaces()
	_check(app.find_child("Accept_sp_1", true, false) is Button, "pending invitation needs an accept button")
	_check(app.find_child("Decline_sp_1", true, false) is Button, "pending invitation needs a decline button")
	_check(app.find_child("Go_sp_1", true, false) == null, "a pending invitation is not an enterable space")
	_check(_labels(app).has("主人 邀请你去「小院」"), "the invitation names who invited and where")
	# After accepting, the server lists the space and clears the invitation.
	app._on_message({"t": "invites", "invites": []})
	app._on_message({"t": "spaces", "spaces": [hall, {"id": "sp_1", "kind": "private", "title": "小院", "owner": "p_owner", "mine": false, "guests": [], "pending": [], "online": 1, "r4_branch": true}]})
	app._render_spaces()
	_check(app.find_child("Accept_sp_1", true, false) == null, "answered invitations disappear")
	_check(app.find_child("Go_sp_1", true, false) is Button, "an accepted invitation becomes an enterable space")
	# An owner sees an unanswered invitation as waiting, with a way to withdraw it.
	app.world.players = {"p_guest": {"nick": "客人"}}
	app._on_message({"t": "spaces", "spaces": [hall, {"id": "sp_2", "kind": "private", "title": "我的院子", "owner": "p_me", "mine": true, "guests": [], "pending": ["p_guest", "p_away"], "online": 1, "r4_branch": true}]})
	app._render_spaces()
	var labels := _labels(app)
	_check(labels.has("等待对方确认"), "owner sees the present guest is still deciding")
	_check(labels.has("等待确认 p_away"), "owner sees pending invitations of players who are not here")
	_check(app.find_child("Invite_p_guest", true, false) == null, "a pending guest is not offered a second invitation")
	if not failed: print("PASS: pending invitations offer accept/decline, accepted ones become enterable, owners see who is waiting")
	quit(1 if failed else 0)
