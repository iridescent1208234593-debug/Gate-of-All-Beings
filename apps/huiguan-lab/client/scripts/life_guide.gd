extends CanvasLayer
## 新人引导 · 开始生活 (Onboarding Progress, chapter "life").
##
## Self-contained: the game shell only reports what the player just did with `on_event()`, and
## gives the guide a way to find HUD controls with `register_target()`. Every step appears the first
## time it becomes relevant, explains one thing in one or two lines, and finishes when the player
## actually does it. Nothing pauses the game or blocks input; the note never covers the centre of the
## scene. Progress is kept by the LAB server per player (welcome["guide"], message {"t":"guide"}), so
## Web, Windows and Android share it.
##
## Events: welcome, profile_ready, moved(distance), chatted, emoted, near_object(name), interacted,
## spaces_opened, space_entered(kind), view_toggled(mode), garden_tool(tool), planted,
## minigame_opened, journal_opened.
## Steps whose events an older client never sends simply never appear.

signal changed(status: String, seen: Array)

const ALL_REQUIRED := ["move", "chat", "interact", "spaces"]
const FINISHED := ["completed", "skipped", "veteran"]
## Notes answering something the player has just done; they take precedence over a waiting suggestion.
const IN_THE_MOMENT := ["interact", "space-rules", "view", "garden", "minigame", "journal"]
const PAPER := Color("fbf6e6")
const INK := Color("24352b")
const INK_SOFT := Color("4a5a4f")
const MOSS := Color("3f7d68")
const SUN := Color("f3d38b")

var status := "new"
var seen: Array = []
var font: Font
var send: Callable                      # func(msg: Dictionary)
var targets := {}                       # name -> Callable returning Rect2 in viewport coords, or Rect2()
var touch := false
var native := false
## What this client build offers on touch screens. The shell sets these; teaching a control that
## does not exist would be worse than saying nothing.
var has_joystick := false
var has_touch_interact := false

var _root: Control
var _note: PanelContainer
var _title: Label
var _body: Label
var _try: Label
var _primary: Button
var _quiet: Button
var _skip: Button
var _light: Control
var _ring: Control
var _current := {}                      # the step on screen
var _queue: Array = []
var _moved := 0.0
var _tween: Tween
var _ring_t := 0.0
var _session_generation := 0


func setup(p_font: Font, p_send: Callable) -> void:
	font = p_font
	send = p_send
	layer = 15                          # above the HUD, below panels opened by the shell (layer 20)
	touch = DisplayServer.is_touchscreen_available() or OS.has_feature("mobile")
	native = not OS.has_feature("web")
	_build()


func _required() -> Array:
	if touch and not has_touch_interact:
		return ALL_REQUIRED.filter(func(k): return k != "interact")
	return ALL_REQUIRED


func register_target(name: String, getter: Callable) -> void:
	targets[name] = getter


func apply_server_state(state: Dictionary) -> void:
	status = str(state.get("status", "new"))
	for k in state.get("seen", []):          # union: a late echo must not drop a newer local key
		if not k in seen:
			seen.append(k)
	changed.emit(status, seen)
	if is_finished() or status == "paused":
		_hide()


func reset_session() -> void:
	_session_generation += 1
	status = "new"
	seen.clear()
	_queue.clear()
	_moved = 0.0
	if _tween and _tween.is_running():
		_tween.kill()
	_hide()
	changed.emit(status, seen)


func is_finished() -> bool:
	return status in FINISHED


# ------------------------------------------------------------------ steps
func _step(key: String) -> Dictionary:
	var move_how := ("拖动左下角的摇杆，或点一下想去的地方" if has_joystick else "点一下想去的地方") if touch else "用 WASD / 方向键，或点一下想去的地方"
	var chat_how := "点下面的输入框，写一句话发送" if touch else "按 Enter，写一句话再按 Enter 发送"
	var act_how := "点屏幕上的「互动」" if touch else "按 E"     # touch without a button never gets this step
	match key:
		"move": return {"key": key, "target": "player", "title": "先走两步", "body": "这里是西木会馆的院子。" + move_how + "。", "done_text": "很好，就这样走。"}
		"chat": return {"key": key, "target": "chat", "title": "和大家打个招呼", "body": "院子里的人都能看到你说的话，头顶也会冒出气泡。" + chat_how + "。", "done_text": "大家都看到了。"}
		"emote": return {"key": key, "target": "emotes", "title": "不想打字时", "body": "这排动作可以挥手、鞠躬、表示喜欢。点一个试试。", "done_text": "对方会看到你的动作。"}
		"interact": return {"key": key, "target": "hint", "title": "靠近，就能互动", "body": "身边有能碰的东西时，下面会出现它的名字。" + act_how + "，看看会发生什么。", "done_text": "院子里的东西会记住大家留下的变化。"}
		"spaces": return {"key": key, "target": "spaces", "title": "还有一扇彩虹门", "body": "院子里的彩虹门通向灵质空间——一条只属于你的独立历史。点上面的「虹之间」看看。", "done_text": "想好了再开辟，不急。"}
		"space-rules": return {"key": key, "target": "top", "title": "这是你的灵质空间", "body": "它是世界的一条独立历史：只有你邀请的人能进来，你可以暂停或快进它的时间，会馆那边不受影响。随时可以从虹之间回去。", "ack": true}
		"view": return {"key": key, "target": "view", "title": "同一个世界，两种看法", "body": "2D 和 3D 只是换个角度看，大家站的位置、说的话都一样。" + ("" if touch else "也可以按 F3 切换。"), "ack": true}
		"garden": return {"key": key, "target": "garden", "title": "种点什么吧", "body": "先放一块泥土，再种下蘑菇；铲子能把自己种的收回成种子。", "ack": true}
		"minigame": return {"key": key, "target": "minigame", "title": "一起玩一局", "body": "小游戏的房间是大家共用的。人到齐了再开始，中途离开也没关系。", "ack": true}
		"journal": return {"key": key, "target": "journal", "title": "你的会馆手记", "body": "去过的地方、遇见的生灵和大家的约定都会记在这里，换设备也在。", "ack": true}
	return {}


func on_event(name: String, data = null) -> void:
	if is_finished() or status == "paused":
		return
	match name:
		"profile_ready", "welcome":
			if not "move" in seen:
				_offer("move", 1.2)
		"moved":
			_moved += float(data if data != null else 0.0)
			if _current.get("key", "") == "move" and _moved >= 2.0:
				_done("move")
				_offer("chat", 2.2)
		"chatted":
			if _current.get("key", "") == "chat" or not "chat" in seen:
				_done("chat")
				_offer("emote", 2.0)
		"emoted":
			_done("emote")
		"near_object":
			if not touch or has_touch_interact:
				_offer("interact", 0.4)
		"interacted":
			_done("interact")
		"spaces_opened":
			_done("spaces")
		"space_entered":
			if str(data) == "private":
				_offer("space-rules", 1.0)
		"view_toggled":
			_offer("view", 0.6)
		"garden_tool":
			_offer("garden", 0.3)
		"planted":
			if _current.get("key", "") == "garden":
				_done("garden")
		"minigame_opened":
			_offer("minigame", 0.3)
		"journal_opened":
			_offer("journal", 0.3)


func _offer(key: String, delay: float) -> void:
	if key in seen or _queue.has(key) or _current.get("key", "") == key:
		return
	_queue.append(key)
	var generation := _session_generation
	await get_tree().create_timer(delay).timeout
	if generation != _session_generation:
		return
	_queue.erase(key)
	if key in seen or is_finished() or status == "paused":
		return
	if not _current.is_empty():
		var waiting: String = _current.get("key", "")
		if key in IN_THE_MOMENT and not waiting in IN_THE_MOMENT:
			# the player just did this: explain it now, the waiting note comes back afterwards
			_queue.push_front(waiting)
			_show(_step(key))
			return
		_queue.append(key)              # wait for the current note to finish
		return
	_show(_step(key))


func _done(key: String) -> void:
	if key in seen:
		return
	seen.append(key)
	if status == "new":
		status = "active"
	var msg := {"t": "guide", "seen": [key]}
	if _required().all(func(k): return k in seen):
		status = "completed"
		msg["status"] = "completed"
	if send.is_valid():
		send.call(msg)
	changed.emit(status, seen)
	# once the everyday basics are done, point at 虹之间
	if not "spaces" in seen and _required().filter(func(k): return k != "spaces").all(func(k): return k in seen):
		_offer("spaces", 6.0)
	if _current.get("key", "") == key:
		var text: String = _current.get("done_text", "")
		if text != "":
			_body.text = text
			_body.add_theme_color_override("font_color", MOSS)
			_sprout()
			var generation := _session_generation
			await get_tree().create_timer(1.4).timeout
			if generation != _session_generation:
				return
		if _current.get("key", "") == key:
			_hide()
			_next_in_queue()


func _next_in_queue() -> void:
	while not _queue.is_empty():
		var k: String = _queue.pop_front()
		if not k in seen:
			_show(_step(k))
			return


# ------------------------------------------------------------------ menu actions (from the shell's guide panel)
func pause() -> void:
	status = "paused"
	_hide()
	if send.is_valid(): send.call({"t": "guide", "status": "paused"})
	changed.emit(status, seen)


func resume() -> void:
	status = "active"
	if send.is_valid(): send.call({"t": "guide", "status": "active"})
	changed.emit(status, seen)
	on_event("welcome")


func skip() -> void:
	status = "skipped"
	_hide()
	if send.is_valid(): send.call({"t": "guide", "status": "skipped"})
	changed.emit(status, seen)


func review() -> void:
	status = "active"
	seen = []
	_moved = 0.0
	if send.is_valid(): send.call({"t": "guide", "reset": true})   # the echo has seen = [] too
	changed.emit(status, seen)
	on_event("welcome")


func summary() -> String:
	var names := {"move": "走路", "chat": "聊天", "interact": "互动", "spaces": "虹之间"}
	var parts: Array = []
	for k in _required():
		parts.append(names[k] + ("（已会）" if k in seen else ""))
	var label := {"new": "还没开始", "active": "进行中", "paused": "已暂停", "completed": "已完成", "skipped": "已跳过", "veteran": "老玩家，已默认完成"}
	return "%s　%s" % [label.get(status, status), "  ".join(parts)]


# ------------------------------------------------------------------ view
func _build() -> void:
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)
	_ring = Control.new()
	_ring.set_anchors_preset(Control.PRESET_FULL_RECT)
	_ring.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ring.draw.connect(_draw_ring)
	_root.add_child(_ring)
	_light = Control.new()
	_light.size = Vector2(36, 36)
	_light.pivot_offset = Vector2(18, 18)
	_light.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_light.draw.connect(_draw_light)
	_light.visible = false
	_root.add_child(_light)

	_note = PanelContainer.new()
	_note.mouse_filter = Control.MOUSE_FILTER_STOP
	var sb := StyleBoxFlat.new()
	sb.bg_color = PAPER
	sb.set_corner_radius_all(12)
	sb.corner_radius_top_left = 4
	sb.border_color = Color(0.47, 0.39, 0.24, 0.25)
	sb.set_border_width_all(1)
	sb.shadow_color = Color(0, 0, 0, 0.28)
	sb.shadow_size = 14
	sb.shadow_offset = Vector2(0, 6)
	sb.content_margin_left = 18; sb.content_margin_right = 18
	sb.content_margin_top = 14; sb.content_margin_bottom = 12
	_note.add_theme_stylebox_override("panel", sb)
	_note.visible = false
	_root.add_child(_note)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	_note.add_child(box)
	var head := HBoxContainer.new()
	box.add_child(head)
	var kicker := Label.new()
	kicker.text = "开始生活"
	kicker.add_theme_font_size_override("font_size", 12)
	kicker.add_theme_color_override("font_color", Color("8a6a2a"))
	kicker.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(kicker)
	_skip = _flat_button("不需要引导", 12, Color("66716a"))
	_skip.pressed.connect(skip)
	head.add_child(_skip)
	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 20)
	_title.add_theme_color_override("font_color", INK)
	box.add_child(_title)
	_body = Label.new()
	_body.autowrap_mode = TextServer.AUTOWRAP_ARBITRARY
	_body.add_theme_font_size_override("font_size", 15)
	_body.add_theme_color_override("font_color", INK_SOFT)
	_body.add_theme_constant_override("line_spacing", 4)
	box.add_child(_body)
	_try = Label.new()
	_try.autowrap_mode = TextServer.AUTOWRAP_ARBITRARY
	_try.add_theme_font_size_override("font_size", 13)
	_try.add_theme_color_override("font_color", Color("6a5420"))
	_try.visible = false
	box.add_child(_try)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	box.add_child(row)
	_primary = Button.new()
	_primary.focus_mode = Control.FOCUS_NONE
	_primary.custom_minimum_size = Vector2(96, 44 if touch else 38)
	var pb := StyleBoxFlat.new()
	pb.bg_color = MOSS
	pb.set_corner_radius_all(22)
	pb.content_margin_left = 16; pb.content_margin_right = 16
	_primary.add_theme_stylebox_override("normal", pb)
	var ph := pb.duplicate(); ph.bg_color = Color("2f6655")
	_primary.add_theme_stylebox_override("hover", ph)
	_primary.add_theme_stylebox_override("pressed", ph)
	_primary.add_theme_color_override("font_color", Color.WHITE)
	_primary.add_theme_color_override("font_hover_color", Color.WHITE)
	_primary.pressed.connect(_dismiss)
	row.add_child(_primary)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(spacer)
	_quiet = _flat_button("收起", 14, INK_SOFT)
	_quiet.custom_minimum_size = Vector2(64, 44 if touch else 38)
	_quiet.pressed.connect(_dismiss)
	row.add_child(_quiet)
	get_viewport().size_changed.connect(_place)


func _flat_button(text: String, size: int, color: Color) -> Button:
	var b := Button.new()
	b.text = text
	b.flat = true
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", size)
	b.add_theme_color_override("font_color", color)
	b.add_theme_color_override("font_hover_color", INK)
	return b


func _show(step: Dictionary) -> void:
	if step.is_empty():
		return
	_current = step
	_title.text = step["title"]
	_body.text = step["body"]
	_body.remove_theme_color_override("font_color")
	_body.add_theme_color_override("font_color", INK_SOFT)
	_try.visible = false
	_primary.text = "知道了" if step.get("ack", false) else "好"
	_note.visible = true
	_note.modulate.a = 0.0
	_place()
	_place.call_deferred()              # once the wrapped text has been measured
	_light.visible = true
	var to := _anchor()
	if _tween: _tween.kill()
	_tween = create_tween().set_parallel(true)
	if _light.position == Vector2.ZERO:
		_light.position = to
	_tween.tween_property(_light, "position", to, 0.7).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	_tween.tween_property(_note, "modulate:a", 1.0, 0.35).set_delay(0.2)
	_ring_t = 0.0
	_tween.tween_method(_set_ring, 0.0, 1.0, 0.6).set_delay(0.55)


func _set_ring(v: float) -> void:
	_ring_t = v
	_ring.queue_redraw()


func _dismiss() -> void:
	# "好 / 收起": the player has read the note. An explanation (ack) is then learned; a do-it step
	# (walk, chat, emote, interact, 虹之间) stays open and finishes only when the player does it.
	if _current.get("ack", false):
		_done(_current.get("key", ""))     # hides and moves on by itself
		return
	_hide()
	_next_in_queue()


func _hide() -> void:
	_current = {}
	if _note:
		_note.visible = false
		_light.visible = false
		_ring_t = 0.0
		_ring.queue_redraw()


func _target_rect() -> Rect2:
	var t: String = _current.get("target", "")
	if targets.has(t):
		var r = targets[t].call()
		if r is Rect2 and r.size != Vector2.ZERO:
			return r
	return Rect2()


func _anchor() -> Vector2:
	var r := _target_rect()
	var vp := get_viewport().get_visible_rect().size
	if r.size == Vector2.ZERO:
		return Vector2(vp.x * 0.5, vp.y * 0.35)
	var y := r.position.y - 24.0 if r.position.y > 70 else r.end.y + 24.0
	return Vector2(clampf(r.position.x + minf(28.0, r.size.x * 0.25), 24.0, vp.x - 24.0), y)


func _place() -> void:
	if not _note or not _note.visible:
		return
	var vp := get_viewport().get_visible_rect().size
	var narrow := vp.x < 760.0
	var w := vp.x - 24.0 if narrow else 340.0
	_body.custom_minimum_size.x = w - 36.0
	_try.custom_minimum_size.x = w - 36.0
	_note.custom_minimum_size = Vector2(w, 0)
	_note.size = Vector2(w, _note.get_combined_minimum_size().y)
	# keep the centre of the scene clear: right edge on wide screens, top band on phones
	if narrow:
		_note.position = Vector2(12, 56)
	else:
		_note.position = Vector2(vp.x - w - 16.0, clampf(vp.y * 0.18, 64.0, 140.0))


func _process(delta: float) -> void:
	if _light and _light.visible:
		var t := Time.get_ticks_msec() / 1000.0
		_light.scale = Vector2.ONE * (1.0 + 0.06 * sin(t * 1.8))
		_light.queue_redraw()
		if not _tween or not _tween.is_running():
			var to := _anchor()
			_light.position = _light.position.lerp(to, minf(1.0, delta * 6.0))
			_ring.queue_redraw()


func _draw_light() -> void:
	var c := Vector2(18, 18)
	for i in range(6, 0, -1):
		_light.draw_circle(c, 3.0 + i * 2.4, Color(1.0, 0.95, 0.7, 0.05 + 0.02 * (6 - i)))
	_light.draw_circle(c, 5.0, Color("fffdf2"))


func _draw_ring() -> void:
	if _ring_t <= 0.0 or _current.is_empty():
		return
	var r := _target_rect()
	if r.size == Vector2.ZERO:
		return
	var vp := get_viewport().get_visible_rect()
	r = r.grow(8).intersection(vp.grow(-3))
	# a hand-drawn loop: points round the rectangle with a little wobble, drawn up to _ring_t
	var pts := PackedVector2Array()
	var n := 48
	for i in range(n + 4):
		var a := float(i) / n
		var p: Vector2
		if a < 0.25: p = r.position + Vector2(r.size.x * a * 4.0, 0)
		elif a < 0.5: p = Vector2(r.end.x, r.position.y + r.size.y * (a - 0.25) * 4.0)
		elif a < 0.75: p = Vector2(r.end.x - r.size.x * (a - 0.5) * 4.0, r.end.y)
		elif a <= 1.0: p = Vector2(r.position.x, r.end.y - r.size.y * (a - 0.75) * 4.0)
		else: p = r.position + Vector2(r.size.x * (a - 1.0) * 4.0, -3.0)
		p += Vector2(sin(i * 1.7) * 1.4, cos(i * 2.3) * 1.4)
		pts.append(p)
	var count := int(pts.size() * _ring_t)
	if count >= 2:
		_ring.draw_polyline(pts.slice(0, count), Color(SUN, 0.35), 6.0, true)
		_ring.draw_polyline(pts.slice(0, count), SUN, 2.2, true)


func _sprout() -> void:
	# two small leaves unfold beside the light: the only "well done" there is
	var leaf := Control.new()
	leaf.mouse_filter = Control.MOUSE_FILTER_IGNORE
	leaf.position = _light.position + Vector2(14, -6)
	leaf.size = Vector2(28, 28)
	leaf.pivot_offset = Vector2(0, 28)
	leaf.scale = Vector2(0.2, 0.2)
	leaf.rotation = -0.5
	leaf.draw.connect(func():
		var body := PackedVector2Array([Vector2(0, 28), Vector2(6, 12), Vector2(16, 3), Vector2(27, 0), Vector2(24, 11), Vector2(15, 22)])
		leaf.draw_colored_polygon(body, Color("b5d482"))
		leaf.draw_line(Vector2(0, 28), Vector2(20, 7), Color("5a8f4a"), 1.4, true))
	_root.add_child(leaf)
	var tw := create_tween()
	tw.tween_property(leaf, "scale", Vector2.ONE, 0.55).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(leaf, "rotation", 0.0, 0.55).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(leaf, "modulate:a", 0.0, 0.5).set_delay(0.5)
	tw.tween_callback(leaf.queue_free)
