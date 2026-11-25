extends CanvasLayer
## 狼人杀面板（客户端）。服务端见 server/lab/werewolf.py，消息 t = ww_*。
##
## 自成一体，和 skills.gd 同样的做法：只监听 Net.message，自己拉快照、自己画 UI，不改 main.gd 的逻辑。
## 唯一的接触点是打开面板时借用 main.panel_holder 放一个不可见占位 —— 那是主场景判断
## "有对话框打开就停键盘移动/停点地面移动/收起摇杆" 的开关，占位被 main 清掉时本面板也一起关闭。
##
## 快照只在阶段变化时推送，所以面板打开期间每秒本地倒计时、每 3 秒补拉一次 ww_state 兜底同步。

const OPEN_KEY := KEY_T
const RESYNC_EVERY := 3.0

const PHASE_NAME := {
	"idle": "还没有牌桌", "lobby": "组局中", "night": "夜晚", "hunter": "猎人开枪",
	"speak": "白天发言", "vote": "投票放逐", "over": "本局结束",
}

const ERR_TEXT := {
	"ww_already_open": "这个空间已经有牌桌了", "ww_no_room": "这里没有牌桌",
	"ww_in_progress": "这局已经开始，等它结束", "ww_full": "座位已经满了",
	"ww_not_seated": "你还没有入座", "ww_bad_phase": "现在不能这么做",
	"ww_not_host": "只有房主可以开始", "ww_need_players": "人数不够，再等等",
	"ww_not_ready": "还有人没有准备", "ww_dead": "你已经出局了",
	"ww_bad_action": "这一步现在做不了", "ww_bad_target": "这个目标不可选",
	"ww_guard_repeat": "不能连续两晚守同一个人", "ww_not_your_turn": "还没轮到你发言",
	"ww_empty": "发言不能是空的",
}

var _main: Node
var _hold: Control
var _open := false
var _mobile := false
var _state: Dictionary = {}
var _state_at := 0.0          # 本地收到快照的时刻，倒计时从这里往下走
var _left := 0.0
var _resync_at := 0.0
var _err := ""
var _err_until := 0.0

var _entry: Button
var _panel: Control
var _frame: PanelContainer
var _title: Label
var _timer: Label
var _err_label: Label
var _seats: GridContainer
var _seats_title: Label
var _me_box: VBoxContainer
var _act_box: VBoxContainer
var _lobby_box: HFlowContainer
var _say_input: LineEdit
var _say_button: Button
var _log_box: VBoxContainer
var _log_scroll: ScrollContainer


func _ready() -> void:
	_mobile = WebBridge.is_mobile()
	_build_entry()
	_build_panel()
	Net.message.connect(_on_message)
	Net.state_changed.connect(_on_net_state)
	print("LABWW boot %s mobile=%s" % [Time.get_datetime_string_from_system(), _mobile])


# ------------------------------------------------------------------ 入口与小面板骨架
func _build_entry() -> void:
	_entry = Button.new()
	_entry.name = "WerewolfEntry"
	_entry.text = "狼人杀"
	_entry.focus_mode = Control.FOCUS_NONE
	_entry.tooltip_text = "狼人杀牌桌（T）"
	_entry.add_theme_font_size_override("font_size", 13)
	_entry.anchor_left = 1.0; _entry.anchor_right = 1.0
	_entry.anchor_top = 1.0; _entry.anchor_bottom = 1.0
	var side := 60.0 if _mobile else 54.0
	var bar_top := -96.0 - (side * 4 + 6 * 4 + 44 + 8) - 6.0
	_entry.offset_right = -10; _entry.offset_left = -10 - 96
	_entry.offset_bottom = bar_top - 4; _entry.offset_top = bar_top - 38
	entry_style(_entry)
	add_child(_entry)
	_entry.pressed.connect(toggle_panel)


func entry_style(b: Button) -> void:
	var s := StyleBoxFlat.new()
	s.bg_color = Color(0.1, 0.08, 0.08, 0.78)
	s.set_corner_radius_all(7)
	s.set_content_margin_all(4)
	b.add_theme_stylebox_override("normal", s)
	var h := StyleBoxFlat.new()
	h.bg_color = Color(0.22, 0.14, 0.12, 0.9)
	h.set_corner_radius_all(7)
	b.add_theme_stylebox_override("hover", h)
	b.add_theme_stylebox_override("pressed", h)


func _build_panel() -> void:
	# skills.gd 的 ui 层是 layer 2，全屏容器会吃掉鼠标；狼人杀必须压在它上面才能点按钮
	layer = 10
	_panel = Control.new()
	_panel.name = "WerewolfPanel"
	_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	_panel.visible = false
	add_child(_panel)
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.55)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	_panel.add_child(shade)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	_panel.add_child(center)
	_frame = PanelContainer.new()
	var ps := StyleBoxFlat.new()
	ps.bg_color = Color(0.09, 0.09, 0.11, 0.98)
	ps.set_corner_radius_all(10)
	ps.set_content_margin_all(12)
	_frame.add_theme_stylebox_override("panel", ps)
	center.add_child(_frame)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 8)
	_frame.add_child(col)

	# 标题行
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 10)
	col.add_child(head)
	_title = Label.new()
	_title.text = "狼人杀"
	_title.add_theme_font_size_override("font_size", 22)
	_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(_title)
	_timer = Label.new()
	_timer.add_theme_font_size_override("font_size", 18)
	_timer.modulate = Color("ffe08a")
	head.add_child(_timer)
	var close := Button.new()
	close.text = "关闭（T）"
	close.focus_mode = Control.FOCUS_NONE
	close.pressed.connect(close_panel)
	head.add_child(close)

	_err_label = Label.new()
	_err_label.add_theme_font_size_override("font_size", 13)
	_err_label.add_theme_color_override("font_color", Color("ff8a7a"))
	_err_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_err_label.visible = false
	col.add_child(_err_label)

	# 主体：左座位与自己的牌，右本局记录
	var body := HBoxContainer.new()
	body.add_theme_constant_override("separation", 12)
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(body)
	var left := VBoxContainer.new()
	left.add_theme_constant_override("separation", 6)
	left.custom_minimum_size.x = 300 if _mobile else 330
	body.add_child(left)
	_seats_title = Label.new()
	_seats_title.text = "座位"
	_seats_title.add_theme_font_size_override("font_size", 15)
	_seats_title.modulate = Color(1, 1, 1, 0.8)
	left.add_child(_seats_title)
	_seats = GridContainer.new()
	_seats.columns = 2
	_seats.add_theme_constant_override("h_separation", 6)
	_seats.add_theme_constant_override("v_separation", 6)
	left.add_child(_seats)
	_me_box = VBoxContainer.new()
	_me_box.add_theme_constant_override("separation", 4)
	left.add_child(_me_box)

	var right := VBoxContainer.new()
	right.add_theme_constant_override("separation", 4)
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_child(right)
	var log_title := Label.new()
	log_title.text = "本局记录"
	log_title.add_theme_font_size_override("font_size", 15)
	log_title.modulate = Color(1, 1, 1, 0.8)
	right.add_child(log_title)
	_log_scroll = ScrollContainer.new()
	_log_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_log_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	right.add_child(_log_scroll)
	_log_box = VBoxContainer.new()
	_log_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_log_box.add_theme_constant_override("separation", 3)
	_log_scroll.add_child(_log_box)

	# 底部：行动、大厅按钮、发言
	_act_box = VBoxContainer.new()
	_act_box.add_theme_constant_override("separation", 6)
	col.add_child(_act_box)
	_lobby_box = HFlowContainer.new()
	_lobby_box.add_theme_constant_override("h_separation", 8)
	col.add_child(_lobby_box)
	var say := HBoxContainer.new()
	say.add_theme_constant_override("separation", 8)
	col.add_child(say)
	_say_input = LineEdit.new()
	_say_input.placeholder_text = "轮到你发言时说两句"
	_say_input.max_length = 120
	_say_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_say_input.custom_minimum_size.y = 40 if _mobile else 34
	_say_input.text_submitted.connect(func(_t): _submit_say())
	say.add_child(_say_input)
	_say_button = Button.new()
	_say_button.text = "发言"
	_say_button.focus_mode = Control.FOCUS_NONE
	_say_button.pressed.connect(_submit_say)
	say.add_child(_say_button)


# ------------------------------------------------------------------ 开关
func toggle_panel() -> void:
	if Net.state != "open":
		return
	if _open: close_panel()
	else: open_panel()


func open_panel() -> void:
	if _open:
		return
	_open = true
	_panel.visible = true
	_entry.visible = false
	_main = get_tree().current_scene
	if _main and "panel_holder" in _main and _main.panel_holder:
		_hold = Control.new()
		_hold.name = "WerewolfHold"
		_hold.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_hold.custom_minimum_size = Vector2.ZERO
		_main.panel_holder.add_child(_hold)
	var vp := get_viewport().get_visible_rect().size
	_frame.custom_minimum_size = Vector2(minf(780, vp.x - 24), minf(640, vp.y - 24))
	Net.send({"t": "ww_state"})
	_state_at = Time.get_ticks_msec() / 1000.0
	_resync_at = _state_at + RESYNC_EVERY
	_render()


func close_panel() -> void:
	if not _open:
		return
	_open = false
	_panel.visible = false
	_entry.visible = true
	if is_instance_valid(_hold):
		if _hold.get_parent() != null:
			_hold.get_parent().remove_child(_hold)
		_hold.queue_free()
	_hold = null
	if _say_input:
		_say_input.release_focus()


func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey and event.pressed and not event.echo):
		return
	if event.keycode == OPEN_KEY:
		print("LABWW key T fired")
		if _say_input and _say_input.has_focus():
			return
		if _main and "chat_input" in _main and _main.chat_input and _main.chat_input.has_focus():
			return
		toggle_panel()
		get_viewport().set_input_as_handled()
	elif event.keycode == KEY_ESCAPE and _open:
		close_panel()
		get_viewport().set_input_as_handled()


# ------------------------------------------------------------------ 网络
func _on_net_state(state: String, _detail: String) -> void:
	if state == "open":
		Net.send({"t": "ww_state"})
	elif state == "login":
		close_panel()
		_state.clear()


func _on_message(m: Dictionary) -> void:
	match str(m.get("t", "")):
		"ww_state":
			_state = m
			_state_at = Time.get_ticks_msec() / 1000.0
			_left = float(m.get("left", 0.0))
			if _open:
				_render()
		"ww_error":
			var code := str(m.get("code", ""))
			_show_error(ERR_TEXT.get(code, code))
			if _open:
				Net.send({"t": "ww_state"})
		"ww_say":
			pass          # 服务端同时写进 log 并推送快照，这里不重复显示


func _show_error(text: String) -> void:
	_err = text
	_err_until = Time.get_ticks_msec() / 1000.0 + 3.5
	_err_label.text = text
	_err_label.visible = true


# 发送
func _send(msg: Dictionary) -> void:
	Net.send(msg)


func _send_target(kind: String, target: String) -> void:
	_send({"t": "ww_target", "kind": kind, "target": target})


func _send_skip(kind: String) -> void:
	_send({"t": "ww_skip", "kind": kind})


func _submit_say() -> void:
	var text := _say_input.text.strip_edges()
	if text == "":
		return
	_send({"t": "ww_say", "text": text})
	_say_input.text = ""
	_say_input.release_focus()


# ------------------------------------------------------------------ 绘制
func _render() -> void:
	if not _open:
		return
	var phase := str(_state.get("phase", "idle"))
	var rnd := int(_state.get("round", 0))
	_title.text = "狼人杀 · " + str(PHASE_NAME.get(phase, phase))
	if rnd > 0 and phase != "over":
		# 只有夜晚和白天发言/投票能确定日夜；猎人开枪可能发生在夜里也可能在白天，只报轮次
		var unit := "夜" if phase == "night" else ("天" if phase in ["speak", "vote"] else "轮")
		_title.text += "　第 %d %s" % [rnd, unit]
	var you = _state.get("you", null)
	if typeof(you) != TYPE_DICTIONARY:
		you = {}
	_render_seats(phase)
	_render_me(phase, you)
	_render_actions(you)
	_render_lobby(phase, you)
	_render_log()
	_say_button.disabled = not bool(you.get("can_speak", false))
	_say_input.editable = bool(you.get("can_speak", false))
	_say_input.placeholder_text = "轮到你发言时说两句" if you.get("can_speak", false) else "只有轮到你时才能发言"
	_settle_dump.call_deferred()


## 浏览器自动化测试用的状态与按钮矩形（和 main.gd 的 LABBUTTON 同一用途，正常游玩时只多几行控制台输出）。
func _settle_dump() -> void:
	# 容器布局要等这一帧结束才定，延后一帧再报按钮矩形，自动化才拿得到真坐标
	_debug_dump()


func _debug_dump() -> void:
	var phase := str(_state.get("phase", "idle"))
	var you = _state.get("you", {})
	if typeof(you) != TYPE_DICTIONARY:
		you = {}
	var buttons: Array = []
	for box in [_lobby_box, _act_box]:
		_collect_buttons(box, buttons)
	var nicks: Array = []
	var seats = _state.get("seats", [])
	if typeof(seats) == TYPE_ARRAY:
		for s in seats:
			if typeof(s) == TYPE_DICTIONARY:
				nicks.append(str(s.get("nick", "")))
	var vp := get_viewport().get_visible_rect().size
	print("LABWW " + JSON.stringify({
		"phase": phase, "round": int(_state.get("round", 0)), "left": roundi(_left),
		"seats": nicks, "you": str(you.get("role_name", "")) if not you.is_empty() else "",
		"spectator": you.is_empty(), "buttons": buttons,
		"viewport": [roundi(vp.x), roundi(vp.y)],
	}))


func _collect_buttons(node: Node, out: Array) -> void:
	for c in node.get_children():
		if c is Button:
			var gp: Vector2 = c.get_screen_position()
			var sz: Vector2 = c.size
			out.append({"text": c.text, "disabled": c.disabled,
				"x": roundi(gp.x), "y": roundi(gp.y),
				"w": roundi(sz.x), "h": roundi(sz.y)})
		else:
			_collect_buttons(c, out)


func _clear(box: Node) -> void:
	for c in box.get_children():
		box.remove_child(c)
		c.queue_free()


func _render_seats(phase: String) -> void:
	_clear(_seats)
	var seats = _state.get("seats", [])
	if typeof(seats) != TYPE_ARRAY:
		seats = []
	_seats_title.text = "座位 %d / %d～%d（至少 %d 人）" % [
		seats.size(), int(_state.get("min_players", 6)), int(_state.get("max_players", 10)),
		int(_state.get("min_players", 6))]
	var my_pid := _my_pid()
	for i in seats.size():
		var s: Dictionary = seats[i]
		var box := PanelContainer.new()
		var sb := StyleBoxFlat.new()
		var mine := str(s.get("pid", "")) == my_pid
		sb.bg_color = Color(0.16, 0.19, 0.16, 0.9) if s.get("alive", true) else Color(0.12, 0.12, 0.13, 0.9)
		if mine:
			sb.bg_color = Color(0.2, 0.22, 0.14, 0.95)
		sb.set_corner_radius_all(6)
		sb.set_content_margin_all(6)
		box.add_theme_stylebox_override("panel", sb)
		box.custom_minimum_size = Vector2(0, 44)
		_seats.add_child(box)
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)
		box.add_child(row)
		var no := Label.new()
		no.text = "%d" % (i + 1)
		no.custom_minimum_size.x = 16
		no.add_theme_font_size_override("font_size", 13)
		no.modulate = Color(1, 1, 1, 0.5)
		row.add_child(no)
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", -2)
		col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(col)
		var name := Label.new()
		var tags: Array = []
		if s.get("host", false): tags.append("房主")
		if not s.get("online", true): tags.append("离线")
		if phase == "lobby" and s.get("ready", false): tags.append("已准备")
		if not s.get("alive", true): tags.append("出局")
		name.text = str(s.get("nick", "?")) + ("" if tags.is_empty() else "　" + "·".join(tags))
		name.add_theme_font_size_override("font_size", 13)
		name.clip_text = true
		if not s.get("alive", true):
			name.modulate = Color(1, 1, 1, 0.45)
		col.add_child(name)
		var role := Label.new()
		var rn: String = _text_or(s.get("role_name", ""), "")
		role.text = rn if rn != "" else "身份未知"
		role.add_theme_font_size_override("font_size", 12)
		role.modulate = Color("ffe08a") if rn != "" and rn != "村民" else Color(1, 1, 1, 0.45)
		col.add_child(role)
	if seats.is_empty():
		var empty := Label.new()
		empty.text = "还没有人入座"
		empty.add_theme_font_size_override("font_size", 13)
		empty.modulate = Color(1, 1, 1, 0.5)
		_seats.add_child(empty)


func _render_me(phase: String, you: Dictionary) -> void:
	_clear(_me_box)
	if you.is_empty():
		var spec := Label.new()
		spec.text = "你是旁观者：%s" % ("这里有牌桌，点「入座」加入" if str(_state.get("space", "")) != "" and phase == "lobby" else "这里没有你的座位")
		spec.add_theme_font_size_override("font_size", 13)
		spec.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		spec.modulate = Color(1, 1, 1, 0.65)
		_me_box.add_child(spec)
		return
	var head := Label.new()
	var camp: String = {"wolf": "狼人阵营", "good": "好人阵营"}.get(str(you.get("camp", "")), "")
	head.text = "你的身份：%s（%s）%s" % [str(you.get("role_name", "?")), camp, "" if you.get("alive", true) else "　已出局"]
	head.add_theme_font_size_override("font_size", 15)
	head.add_theme_color_override("font_color", Color("ffe08a"))
	head.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_me_box.add_child(head)
	var desc := Label.new()
	desc.text = str(you.get("role_desc", ""))
	desc.add_theme_font_size_override("font_size", 12)
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	desc.modulate = Color(1, 1, 1, 0.7)
	_me_box.add_child(desc)
	for n in you.get("notes", []):
		if typeof(n) != TYPE_DICTIONARY:
			continue
		var l := Label.new()
		l.text = "· " + str(n.get("text", ""))
		l.add_theme_font_size_override("font_size", 13)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.modulate = Color("9ee0a0") if str(n.get("kind", "")) in ["knife", "speak", "team"] else Color(1, 1, 1, 0.75)
		_me_box.add_child(l)
		for c in n.get("checks", []):
			if typeof(c) != TYPE_DICTIONARY:
				continue
			var cl := Label.new()
			cl.text = "　　%s：%s" % [str(c.get("nick", "?")), str(c.get("camp_name", ""))]
			cl.add_theme_font_size_override("font_size", 13)
			cl.modulate = Color("ffb0a0") if str(c.get("camp", "")) == "wolf" else Color(1, 1, 1, 0.75)
			_me_box.add_child(cl)


func _render_actions(you: Dictionary) -> void:
	_clear(_act_box)
	if you.is_empty():
		return
	for a in you.get("actions", []):
		if typeof(a) != TYPE_DICTIONARY:
			continue
		var kind := str(a.get("kind", ""))
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		_act_box.add_child(row)
		var label := Label.new()
		label.text = str(a.get("label", kind))
		label.add_theme_font_size_override("font_size", 14)
		label.custom_minimum_size.x = 200 if _mobile else 180
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		row.add_child(label)
		var flow := HFlowContainer.new()
		flow.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		flow.add_theme_constant_override("h_separation", 6)
		row.add_child(flow)
		var targets = a.get("targets", [])
		if typeof(targets) != TYPE_ARRAY:
			targets = []
		var submitted = a.get("submitted", "")
		if kind == "save":
			var save := Button.new()
			save.text = "用解药" if not bool(submitted) else "已用解药"
			save.focus_mode = Control.FOCUS_NONE
			save.disabled = bool(submitted)
			save.pressed.connect(func(): _send_target("save", ""))
			flow.add_child(save)
		else:
			for t in targets:
				if typeof(t) != TYPE_DICTIONARY:
					continue
				var pid := str(t.get("pid", ""))
				var b := Button.new()
				b.text = str(t.get("nick", "?"))
				b.focus_mode = Control.FOCUS_NONE
				b.add_theme_font_size_override("font_size", 13)
				b.disabled = not bool(t.get("alive", true))
				b.button_pressed = str(submitted) == pid and submitted != ""
				b.toggle_mode = false
				if str(submitted) == pid and submitted != "":
					b.modulate = Color("ffe08a")
				b.pressed.connect(func(): _send_target(kind, pid))
				flow.add_child(b)
		var skip := Button.new()
		skip.text = "弃票" if kind == "vote" else "不动"
		skip.focus_mode = Control.FOCUS_NONE
		skip.add_theme_font_size_override("font_size", 12)
		skip.modulate = Color(1, 1, 1, 0.6)
		skip.pressed.connect(func(): _send_skip(kind))
		flow.add_child(skip)
		if str(submitted) != "" and kind != "save":
			var done := Label.new()
			done.text = "已提交"
			done.add_theme_font_size_override("font_size", 12)
			done.modulate = Color("9ee0a0")
			flow.add_child(done)


func _render_lobby(phase: String, you: Dictionary) -> void:
	_clear(_lobby_box)
	var seated := not you.is_empty()
	var host := bool(you.get("host", false)) if seated else false
	if phase == "idle":
		_button(_lobby_box, "在此开辟牌桌", func(): _send({"t": "ww_create"}))
		return
	if phase == "lobby":
		if not seated:
			_button(_lobby_box, "入座", func(): _send({"t": "ww_join"}))
		else:
			_button(_lobby_box, "取消准备" if you.get("ready", false) else "准备",
				func(): _send({"t": "ww_ready", "ready": not bool(you.get("ready", false))}))
			_button(_lobby_box, "离开座位", func(): _send({"t": "ww_leave"}))
			if host:
				var seats: Array = _state.get("seats", [])
				var ready_all: bool = seats.size() >= int(_state.get("min_players", 6))
				for s in seats:
					if not bool(s.get("ready", false)):
						ready_all = false
				var start := _button(_lobby_box, "开始游戏", func(): _send({"t": "ww_start"}))
				start.disabled = not ready_all
				if not ready_all:
					start.tooltip_text = "人数不够或还有人没准备"
		return
	# night / speak / vote / hunter / over
	if seated:
		_button(_lobby_box, "离开牌桌", func(): _send({"t": "ww_leave"}))
	else:
		var hint := Label.new()
		hint.text = "本局进行中，等结束后再入座"
		hint.add_theme_font_size_override("font_size", 13)
		hint.modulate = Color(1, 1, 1, 0.6)
		_lobby_box.add_child(hint)
	if phase == "over":
		var again := Label.new()
		again.text = "本局结束，房主可以重新开桌"
		again.add_theme_font_size_override("font_size", 13)
		again.modulate = Color(1, 1, 1, 0.6)
		_lobby_box.add_child(again)


func _button(parent: Node, text: String, cb: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(func() -> void:
		print("LABWW pressed [%s]" % text)
		cb.call())
	parent.add_child(b)
	return b


func _render_log() -> void:
	_clear(_log_box)
	var entries = _state.get("log", [])
	if typeof(entries) != TYPE_ARRAY:
		entries = []
	if entries.is_empty():
		var l := Label.new()
		l.text = "（还没有记录）"
		l.add_theme_font_size_override("font_size", 12)
		l.modulate = Color(1, 1, 1, 0.4)
		_log_box.add_child(l)
		return
	for e in entries:
		var text := ""
		if typeof(e) == TYPE_DICTIONARY:
			text = str(e.get("text", ""))
		else:
			text = str(e)
		var l := Label.new()
		l.text = text
		l.add_theme_font_size_override("font_size", 12)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_log_box.add_child(l)
	await get_tree().process_frame
	await get_tree().process_frame
	_log_scroll.scroll_vertical = int(_log_scroll.get_v_scroll_bar().max_value)


func _text_or(value, fallback: String) -> String:
	if value == null:
		return fallback
	return str(value)


func _my_pid() -> String:
	if _main and "world" in _main and _main.world:
		return str(_main.world.me_pid)
	var you = _state.get("you", null)
	if typeof(you) == TYPE_DICTIONARY:
		return str(you.get("pid", ""))
	return ""


# ------------------------------------------------------------------ 每帧
func _process(_delta: float) -> void:
	var now := Time.get_ticks_msec() / 1000.0
	if _err_until > 0.0 and now > _err_until:
		_err_until = 0.0
		_err_label.visible = false
	if not _state.is_empty():
		_left = maxf(0.0, _left - _delta)
	_entry.text = "狼人杀"
	var phase := str(_state.get("phase", "idle"))
	if phase != "idle" and not _state.is_empty():
		_entry.text = "%s %d" % [str(PHASE_NAME.get(phase, phase)), int(ceil(_left))]
	if not _open:
		return
	if _hold == null or not is_instance_valid(_hold) or not _hold.is_inside_tree():
		# main 的面板容器被清空（用户开了别的对话框）：跟着一起收起
		close_panel()
		return
	if now > _resync_at:
		_resync_at = now + RESYNC_EVERY
		Net.send({"t": "ww_state"})
	var phase2 := str(_state.get("phase", "idle"))
	if phase2 == "over":
		_timer.text = ""
	else:
		var total := float(_state.get("phase_seconds", 0.0))
		_timer.text = "%d:%02d" % [int(_left) / 60, int(_left) % 60]
		if total > 0.0 and _left <= 0.0:
			_timer.text = "等待中"
