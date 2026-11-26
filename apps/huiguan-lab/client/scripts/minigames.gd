extends Node

const Board = preload("res://scripts/minigame_board.gd")
const CACHE := "user://lab-minigames"
const ERRORS := {
	"pack": "找不到这个扩展包。", "version": "扩展包已更新，请回到列表重新下载。",
	"space": "当前空间不可访问。", "exists": "这里已经有棋桌了。",
	"changed": "棋局已更新，请再试一次。", "full": "棋桌已经坐满。",
	"turn": "现在还不能落子。", "cell": "这个位置不能落子。",
	"seat": "请先入座。", "offline": "对手暂时离线，等对手回来再继续。",
	"action": "当前阶段不能进行这个操作。",
	"field_space": "场景游戏请到西木会馆的棋亭参加。",
	"field_busy": "你已加入另一场场景游戏。结束后再换场。",
	"field_players": "在线人数还不够，请等同伴入座。",
	"field_near": "请走到棋亭旁再召集会议。",
	"field_station": "先从棋亭或小游戏菜单加入一场游戏。",
	"field_route": "还没轮到这座萤火台，看看下一站。",
	"field_pass": "请把下一棒交给一位同伴。",
	"field_jam": "这座信标没有信号，或熄灯还在冷却。",
	"field_repair": "信标已点满，或该换同伴接手了。",
}
const FIELD_ENDS := {
	"relay": "接力成功，六棒全部完成！", "timeout": "时间到了，接力未完成。",
	"keepers": "巡夜人获胜！", "saboteur": "隐灯客获胜！",
}

var screen: VBoxContainer
var content: VBoxContainer
var feedback: Label
var host: Control
var catalog: Array = []
var selected := ""
var downloading := ""
var pack: Dictionary = {}
var current = null
var elapsed := 0.0
var entry: Button
var timer_label: Label
var timer_end_ms := 0


func _ready() -> void:
	Net.message.connect(_on_message)
	Net.state_changed.connect(_on_connection)


func open(main: Control) -> void:
	host = main
	screen = host._panel("联机小游戏", 480.0)
	var style := StyleBoxFlat.new()
	style.bg_color = Color("#252d2a")
	style.set_corner_radius_all(10)
	style.set_content_margin_all(10.0)
	(host.panel_scroll.get_parent() as PanelContainer).add_theme_stylebox_override("panel", style)
	feedback = Label.new()
	feedback.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	screen.add_child(feedback)
	content = VBoxContainer.new()
	content.add_theme_constant_override("separation", 8)
	screen.add_child(content)
	downloading = ""
	_render()
	_send("catalog")
	if selected != "":
		_send("state")


func _open() -> bool:
	return is_instance_valid(screen) and screen.is_inside_tree()


func _process(delta: float) -> void:
	if not _open():
		return
	if is_instance_valid(timer_label) and timer_label.is_inside_tree():
		timer_label.text = "剩余 %d 秒" % maxi(0, ceili((timer_end_ms - Time.get_ticks_msec()) / 1000.0))
	elapsed += delta
	if elapsed >= 3.0:
		elapsed = 0.0
		if selected != "":
			_send("state")


func _send(action: String, extra := {}) -> void:
	if Net.state != "open":
		feedback.text = "正在连接会馆，连上后可以继续。"
		return
	var msg := {"t": "minigame", "action": action, "game": selected}
	if selected != "":
		msg["version"] = str(pack.get("version", ""))
	if typeof(current) == TYPE_DICTIONARY:
		msg["table"] = current["id"]
		msg["revision"] = current["revision"]
	msg.merge(extra, true)
	Net.send(msg)


func _on_connection(state: String, _detail: String) -> void:
	if not _open():
		return
	if state == "open":
		feedback.text = ""
		_send("catalog" if selected == "" else "state")
	else:
		downloading = ""
		feedback.text = "连接中断，正在等待重连。"
		_render()


func _on_message(msg: Dictionary) -> void:
	if not _open():
		if msg.get("t") == "minigame_state" and msg.get("game") == selected and pack.get("mode") == "field":
			_field_sync(msg["table"])
		elif msg.get("t") == "minigame_error" and is_instance_valid(host):
			host.toast(str(ERRORS.get(msg["code"], "操作失败，请重试。")))
		elif msg.get("t") == "welcome" and selected != "" and pack.get("mode") == "field":
			current = null
			entry.text = "小游戏"
			_send("state")
		return
	match msg.get("t"):
		"welcome", "space":
			if selected != "":
				current = null
				_render()
				_send("state")
		"minigame_catalog":
			catalog = msg["packs"]
			feedback.text = ""
			_render()
		"minigame_pack":
			if msg["game"] == downloading:
				_receive_pack(msg)
		"minigame_state":
			if msg["game"] == selected and msg["table"] != current:
				if pack.get("mode") == "field":
					if _field_sync(msg["table"]):
						_render()
				else:
					current = msg["table"]
					feedback.text = ""
					_render()
		"minigame_error":
			download_failed(str(ERRORS.get(msg["code"], "操作失败，请重试。")))
		"error":
			if msg.get("code") == "unknown_type" and catalog.is_empty():
				feedback.text = "当前会馆版本还未开放联机小游戏。"


func download_failed(reason: String) -> void:
	downloading = ""
	feedback.text = reason
	_render()


func _cache_path(game: String) -> String:
	return CACHE.path_join(game + ".json")


func _check_pack(meta: Dictionary, raw: String) -> Dictionary:
	if raw.sha256_text() != meta["version"]:
		return {}
	var data = JSON.parse_string(raw)
	if typeof(data) != TYPE_DICTIONARY or data.get("id") != meta["id"]:
		return {}
	data["version"] = meta["version"]
	return data


func _cached(meta: Dictionary) -> Dictionary:
	return _check_pack(meta, FileAccess.get_file_as_string(_cache_path(meta["id"])))


func _receive_pack(msg: Dictionary) -> void:
	var game := downloading
	downloading = ""
	for meta in catalog:
		if meta["id"] != game:
			continue
		var raw := str(msg["data"])
		var data := _check_pack(meta, raw)
		if data.is_empty():
			download_failed("扩展包校验失败，请刷新列表后重试。")
			return
		DirAccess.make_dir_recursive_absolute(CACHE)
		var file := FileAccess.open(_cache_path(game), FileAccess.WRITE)
		if file != null:
			file.store_string(raw)
			file.close()
		_select(data)
		if file == null:
			feedback.text = "本次可以游玩。设备未能保存扩展包，下次需要重新下载。"
		return


func _select(data: Dictionary) -> void:
	pack = data
	selected = data["id"]
	current = null
	feedback.text = ""
	_render()
	_send("state")


func _field_sync(data) -> bool:
	var previous: Dictionary = current if current is Dictionary else {}
	var fresh: Dictionary = data if data is Dictionary else {}
	timer_end_ms = Time.get_ticks_msec() + int(fresh.get("remaining", 0)) * 1000
	current = data
	var seated: bool = fresh.get("you", "") != ""
	var phase := str(fresh.get("phase", ""))
	var event := str(fresh.get("event", ""))
	if is_instance_valid(entry):
		entry.text = "小游戏 · 投票" if seated and phase == "meeting" else ("小游戏 · 进行中" if seated and phase == "running" else "小游戏")
	if seated and (event != previous.get("event", "") or phase != previous.get("phase", "")) and is_instance_valid(host):
		if phase == "over":
			host.toast(str(FIELD_ENDS.get(fresh.get("reason"), "游戏结束。")), 6)
		elif phase == "meeting":
			host.toast("夜巡会议开始，打开「小游戏」查看并投票。", 6)
		elif phase == "running" and event != "":
			var next := str(fresh.get("next", ""))
			host.toast(event + (" 下一站：" + next if next != "" else ""), 5)
	return fresh.get("revision", -1) != previous.get("revision", -1) or fresh.get("players", []) != previous.get("players", [])


func _download(meta: Dictionary) -> void:
	if Net.state != "open":
		feedback.text = "连接会馆后才能下载扩展包。"
		return
	downloading = meta["id"]
	feedback.text = "正在下载%s…" % meta["title"]
	_render()
	_send("download", {"game": downloading})


func _text(value: String) -> void:
	var label := Label.new()
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.text = value
	content.add_child(label)


func _button(title: String, callback: Callable) -> Button:
	return host._add_button(content, title, callback)


func _render() -> void:
	for child in content.get_children():
		content.remove_child(child)
		child.queue_free()
	if selected == "":
		_text("场景游戏在会馆游玩，桌游可在同一空间开桌。")
		for meta in catalog:
			var data := _cached(meta)
			var title := str(meta["title"])
			_text(title + " · " + str(meta["description"]))
			if data.is_empty():
				var button := _button("下载%s（%d B）" % [title, meta["bytes"]], _download.bind(meta))
				button.disabled = downloading != ""
			else:
				_button("打开%s" % title, _select.bind(data))
		_button("刷新列表", func(): _send("catalog"))
	else:
		if pack.get("mode") == "field":
			_render_field()
		else:
			_render_table()
	host._layout_panel.call_deferred()


func _game_heading() -> void:
	_button("返回游戏列表", func():
		selected = ""
		current = null
		entry.text = "小游戏"
		feedback.text = ""
		_render())
	_text(str(pack["title"]) + " · " + str(pack["description"]))


func _render_field() -> void:
	_game_heading()
	if current == null:
		_button("组队", func(): _send("create"))
		return
	var phase := str(current["phase"])
	var you := str(current["you"])
	var players: Array = current["players"]
	if phase == "running" or phase == "meeting":
		timer_label = Label.new()
		content.add_child(timer_label)
		var progress := ProgressBar.new()
		progress.max_value = float(current["goal"])
		progress.value = float(current["progress"])
		progress.custom_minimum_size.y = 18
		content.add_child(progress)
	var nicknames := PackedStringArray()
	for player in players:
		var suffix := "（你）" if player["pid"] == you else ""
		if player["revealed"]:
			suffix += " · 隐灯客"
		elif player["out"]:
			suffix += " · 观战"
		elif not player["online"]:
			suffix += " · 离线"
		nicknames.append(str(player["nick"]) + suffix)
	_text("同队：" + "、".join(nicknames))
	var role := str(current["role"])
	if role != "":
		_text("你的身份：隐灯客 · 到已有信号的台子旁互动，暗中削弱信号。" if role == "saboteur" else "你的身份：巡夜人 · 和同伴轮流点亮信标。")
	if phase == "lobby":
		_text("%d / %d 人 · 至少 %d 人开始" % [players.size(), pack["max_players"], pack["min_players"]])
		if you == "":
			_button("加入队伍", func(): _send("join")).disabled = players.size() >= int(pack["max_players"])
		else:
			if current["host"] == you:
				_button("开始", func(): _send("start")).disabled = players.size() < int(pack["min_players"])
			_button("退出队伍", func(): _send("leave"))
	elif phase == "running":
		if selected == "firefly-relay":
			_text("下一站：" + str(current["next"]))
		else:
			for station in current["stations"]:
				_text("%s · %d / 2" % [station, current["stations"][station]])
			if current["can_meet"]:
				_button("在棋亭召集会议", func(): _send("meeting"))
		_button("回到场景", host._clear_panels)
	elif phase == "meeting":
		_text("先在会馆聊天里讨论，再回来投票。每人一票，平票继续夜巡。")
		var can_vote := false
		for player in players:
			if player["pid"] == you:
				can_vote = not player["out"] and not player["voted"]
		for player in players:
			if not player["out"]:
				_button("投给 " + str(player["nick"]), _vote.bind(str(player["pid"]))).disabled = not can_vote
		_button("跳过投票", _vote.bind("")).disabled = not can_vote
		_button("回到场景聊天", host._clear_panels)
	else:
		_text(str(FIELD_ENDS.get(current["reason"], "游戏结束。")))
		if you != "":
			_button("结束这场游戏", func(): _send("leave"))
	if str(current["event"]) != "":
		_text(str(current["event"]))


func _vote(target: String) -> void:
	_send("vote", {"target": target})


func _render_table() -> void:
	_game_heading()
	if current == null:
		_button("开桌", func(): _send("create"))
		return
	var players: Array = current["players"]
	var sides: Array = pack["sides"]
	var side := int(current["side"])
	for i in range(players.size()):
		_text("%s  %s%s%s" % [sides[i], players[i]["nick"], "（你）" if side == i + 1 else "",
			" · 离线" if not players[i]["online"] else ""])
	if players.size() == 1:
		_text("等另一位玩家入座。")
		if side == 0:
			_button("入座", func(): _send("join")).disabled = not players[0]["online"]
		else:
			_button("收起棋桌", func(): _send("leave"))
		return
	var reason := str(current["reason"])
	var both_online: bool = players[0]["online"] and players[1]["online"]
	if reason == "draw":
		_text("棋盘已满，和棋。")
	elif reason != "":
		var ending: String = {"resign": " · 对方认输", "disconnect": " · 对方离线超时"}.get(reason, "")
		_text(str(sides[int(current["winner"]) - 1]) + "获胜" + ending)
	elif not both_online:
		_text("一位棋手暂时离线，棋局保留约两分钟。")
	else:
		_text("轮到" + str(sides[int(current["turn"]) - 1]) + ("（你）" if side == int(current["turn"]) else ""))
	var board := Board.new()
	var viewport_width: float = host.get_viewport_rect().size.x
	var width := clampf(viewport_width - 64.0, 100.0, 412.0)
	board.custom_minimum_size = Vector2(width, width * float(pack["rows"]) / float(pack["columns"]))
	board.pack = pack
	board.state = current
	board.can_play = side != 0 and reason == "" and both_online and int(current["turn"]) == side and Net.state == "open"
	board.played.connect(func(x, y): _send("move", {"x": x, "y": y}))
	content.add_child(board)
	if side == 0:
		_text("观战中。")
	elif reason != "":
		_button("等对手同意再来一局" if current["rematch"] else "再来一局", func(): _send("rematch")).disabled = current["rematch"] or not both_online
		_button("关闭棋桌", func(): _send("leave"))
	else:
		_button("认输…", func():
			var confirm := ConfirmationDialog.new()
			confirm.dialog_text = "确认认输并结束本局？"
			content.add_child(confirm)
			confirm.confirmed.connect(func():
				_send("resign")
				confirm.queue_free())
			confirm.canceled.connect(confirm.queue_free)
			confirm.popup_centered())
