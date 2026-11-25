extends SceneTree


func check(ok: bool, phrase: String) -> bool:
	if not ok:
		push_error(phrase)
		quit(1)
	return ok

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var net = root.get_node("Net")
	var skills = root.get_node("Skills")
	net.set_process(false)
	var main = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	current_scene = main
	main.set_process(false)
	skills.set_process(false)
	main.welcomed = true
	main.world.me_pid = "self"
	main.world.set_space({"id": "hall", "template": "hall"})
	net.state = "open"
	skills.ready_state = true
	var emote: String = main.action_buttons.keys().filter(func(id): return id != "crouch")[0]
	main._request_action(emote)
	if not check(main.pending_action == emote and main.toast_label.text == main.ACTION_WAIT_TEXT and not main.world.me.has("emote_id"),"Immediate emote feedback before authority"): return
	main._on_message({"t":"emote","pid":"other","id":emote})
	if not check(main.pending_action == emote and not main.world.me.has("emote_id"),"Remote emote must not acknowledge this request"): return
	main._on_message({"t":"emote","pid":"self","id":emote})
	if not check(main.pending_action == "" and main.world.me.emote_id == emote and main.toast_label.text == "","Authoritative emote acknowledgement"): return
	main._request_action(emote)
	main._on_message({"t":"error","code":"emote_while_moving"})
	if not check(main.pending_action == "" and main.toast_label.text != main.ACTION_WAIT_TEXT, "Emote rejection clears pending"): return
	main._request_action(emote)
	main._check_action_timeout(main.pending_action_until)
	if not check(main.pending_action == "" and main.toast_label.text.contains("重试"), "Emote timeout releases retry"): return
	main._request_action(emote)
	main._on_net_state("closed", "")
	if not check(main.pending_action == "", "Emote pending cleared on disconnect"): return
	var chosen := ""
	for id in skills.catalog.get("skills", {}):
		if skills.skill(id).get("anchor", "") != "screen":
			chosen = id
			break
	if not check(chosen != "" and not skills.skill(chosen).is_empty(), "Valid skill catalog fixture"): return
	skills.equipped[0] = chosen
	skills.fx[chosen] = {"state":"loading","info":{},"frames":[]}
	skills.cast_slot(0)
	if not check(skills.awaiting_cast == chosen and skills.ui.toast_label.text == skills.CAST_WAIT_TEXT and skills._casts.is_empty() and skills.cooldown_left(chosen) == 0, "Cast pending before authoritative effects/cooldown"): return
	skills._on_message({"t":"cast","pid":"not-me","id":chosen})
	if not check(skills.awaiting_cast == chosen and skills.ui.toast_label.text == skills.CAST_WAIT_TEXT, "Remote cast must not acknowledge local request"): return
	skills._on_message({"t":"skill_error","code":"skill_not_equipped"})
	if not check(skills.awaiting_cast == "" and skills.ui.toast_label.text != skills.CAST_WAIT_TEXT, "Cast rejection releases retry"): return
	skills.cast_slot(0)
	skills._check_feedback_timeout(skills.cast_due)
	if not check(skills.awaiting_cast == "" and skills.ui.toast_label.text.contains("重试"), "Cast timeout releases retry"): return
	skills.cast_slot(0)
	skills._on_message({"t":"cast","pid":"self","id":chosen})
	if not check(skills.awaiting_cast == "" and skills.awaiting_fx == chosen and skills.ui.toast_label.text == skills.FX_WAIT_TEXT and skills.cooldown_left(chosen) > 0 and skills._casts.is_empty(), "Authoritative cast sets cooldown; missing FX separate state"): return
	skills._check_feedback_timeout(skills.fx_due)
	if not check(skills.awaiting_fx == "" and skills.ui.toast_label.text.contains("未能及时"), "FX timeout explicitly separates success from visual delay"): return
	skills.cooldown_until.clear()
	skills.cast_slot(0)
	skills._on_message({"t":"cast","pid":"self","id":chosen})
	skills._fail(chosen)
	if not check(skills.awaiting_fx == "" and skills.ui.toast_label.text.contains("加载失败"), "FX download failure feedback"): return
	skills.cooldown_until.clear()
	var page := ImageTexture.create_from_image(Image.create(2, 2, false, Image.FORMAT_RGBA8))
	skills.fx[chosen] = {
		"state":"loading",
		"info":{"w": 2, "h": 2, "cols": 1, "per_page": 1, "n": 1, "fps": 4, "loop": false, "origin": [1,1]},
		"pages":[[0, page]], "frames":[]
	}
	skills.cast_slot(0)
	skills._on_message({"t":"cast","pid":"self","id":chosen})
	skills._build_frames(chosen)
	if not check(skills.awaiting_fx == "" and skills._casts.size() == 1 and skills.ui.toast_label.text == "", "Downloaded effect clears pending and starts actual play"): return
	skills.cooldown_until.clear()
	skills.fx[chosen]["state"] = "loading"
	skills.cast_slot(0)
	skills._on_net_state("closed","")
	if not check(skills.awaiting_cast == "" and skills.awaiting_fx == "" and not skills.ready_state, "Disconnect clears skill feedback"): return
	main.world.apply_snapshot([["self", 4.0, 5.0, 0.0, "walk"]], 1000.0, 0.0)
	if not check(main.world.authoritative_position == Vector2(4, 5), "Native own authoritative position is preserved"): return
	print("PENDING_FEEDBACK_PASS authority, timeout, rejection, disconnect, own position")
	quit(0)
