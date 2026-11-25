extends Control
## Single-player native/Web scene. Best score stays on this device, not on the LAB server.

signal exited

const Run = preload("res://scripts/beach_shoot_run.gd")
const Arena = preload("res://scripts/beach_shoot_arena.gd")
const RECORD := "user://beach_shoot_v1.cfg"
const UI_FONT := preload("res://assets/fonts/NotoSansSC-lab.woff2")
const INK := Color("182d37")
const PANEL := Color("274651")
const GOLD := Color("ffd48f")
const PAPER := Color("fbecd6")
const HELP := "WASD / 方向键、点地面或触屏拖动。移动时自动单发，按住空格或点「定身」会停步散射。"

var run: Run
var arena: Arena
var stats: Label
var tip: Label
var brace_button: Button
var menu: Control
var scroll: ScrollContainer
var menu_body: VBoxContainer
var best := 0
var braced := false
var pointer := -1
var press_origin := Vector2.ZERO
var drag_wish := Vector2.ZERO
var moved_pointer := false
var target = null
var quit_requested := false


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	if theme == null:
		theme = Theme.new()
		theme.default_font = UI_FONT
	var record := ConfigFile.new()
	if record.load(RECORD) == OK:
		best = clampi(int(record.get_value("record", "kills", 0)), 0, Run.MAX_SCORE)
	_build()
	_restart(false)


func _build() -> void:
	var bg := ColorRect.new()
	bg.color = INK
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var frame := MarginContainer.new()
	add_child(frame)
	frame.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		frame.add_theme_constant_override("margin_" + side, 12)
	var body := VBoxContainer.new()
	frame.add_child(body)
	var header := HBoxContainer.new()
	body.add_child(header)
	var title := _label("省省海滩射击", 21)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	header.add_child(_button("暂停", _pause))
	stats = _label("", 15, GOLD)
	body.add_child(stats)
	tip = _label("", 13)
	body.add_child(tip)
	arena = Arena.new()
	arena.size_flags_vertical = Control.SIZE_EXPAND_FILL
	arena.pointer_pressed.connect(_on_pointer_press)
	body.add_child(arena)
	brace_button = _button("定身散射", _toggle_brace, true)
	body.add_child(brace_button)
	menu = Control.new()
	add_child(menu)
	menu.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var tint := ColorRect.new()
	tint.color = Color(0.037, 0.11, 0.15, 0.91)
	menu.add_child(tint)
	tint.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	scroll = ScrollContainer.new()
	menu.add_child(scroll)
	scroll.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	scroll.offset_left = 8
	scroll.offset_right = -8
	scroll.offset_top = 8
	scroll.offset_bottom = -8
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var centered := CenterContainer.new()
	centered.mouse_filter = Control.MOUSE_FILTER_PASS
	centered.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	centered.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.add_child(centered)
	var style := StyleBoxFlat.new()
	style.bg_color = PANEL
	style.border_color = Color("689a9e")
	style.set_border_width_all(1)
	style.set_corner_radius_all(10)
	style.set_content_margin_all(12)
	var panel := PanelContainer.new()
	panel.mouse_filter = Control.MOUSE_FILTER_PASS
	panel.add_theme_stylebox_override("panel", style)
	centered.add_child(panel)
	menu_body = VBoxContainer.new()
	menu_body.mouse_filter = Control.MOUSE_FILTER_PASS
	menu_body.add_theme_constant_override("separation", 8)
	panel.add_child(menu_body)
	resized.connect(_resize_menu)
	_resize_menu()


func _resize_menu() -> void:
	menu_body.custom_minimum_size.x = clampf(size.x - 70.0, 180.0, 460.0)
	_reset_pointer()


func _label(text: String, font_size: int, color := PAPER) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return label


func _button(text: String, callback: Callable, primary := false) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size.y = 44
	button.focus_mode = Control.FOCUS_NONE
	button.pressed.connect(callback)
	if primary:
		var style := StyleBoxFlat.new()
		style.bg_color = GOLD
		style.set_corner_radius_all(7)
		style.set_content_margin_all(6)
		button.add_theme_stylebox_override("normal", style)
		button.add_theme_stylebox_override("hover", style)
		button.add_theme_stylebox_override("pressed", style)
		for c in ["font_color", "font_hover_color", "font_pressed_color"]:
			button.add_theme_color_override(c, INK)
	return button


func _restart(start: bool) -> void:
	run = Run.new(randi())
	arena.run = run
	_reset_pointer()
	_reset_brace()
	if start:
		_start()
	else:
		_open_menu("守住这道海岸", "右侧会出现三波雾影。别让它们越过左侧防线。\n" + HELP)
		menu_body.add_child(_button("开始守滩", _start, true))
		menu_body.add_child(_button("返回会馆", _leave))
	_refresh()
	arena.queue_redraw()


func _start() -> void:
	run.begin()
	menu.hide()
	_refresh()


func _open_menu(title: String, detail: String) -> void:
	_reset_pointer()
	_reset_brace()
	for child in menu_body.get_children():
		menu_body.remove_child(child)
		child.queue_free()
	menu_body.add_child(_label(title, 24, GOLD))
	menu_body.add_child(_label(detail, 15))
	scroll.scroll_vertical = 0
	menu.show()
	arena.queue_redraw()


func _pause() -> void:
	if run == null or run.phase != "play" or menu.visible:
		return
	_open_menu("本局暂停", HELP)
	menu_body.add_child(_button("继续守滩", menu.hide, true))
	menu_body.add_child(_button("返回会馆 · 结束本局", _leave))


func _show_choices() -> void:
	_open_menu("第 %d 波已守住" % run.wave, "喘口气，挑一项加成后再开下一波。")
	for i in run.offers.size():
		var id: String = run.offers[i]
		var item: Array = Run.UPGRADES[id]
		menu_body.add_child(_button("%d · %s" % [i + 1, item[0]], _claim.bind(id), true))
		menu_body.add_child(_label(item[1], 13))
	menu_body.add_child(_button("返回会馆 · 结束本局", _leave))


func _claim(id: String) -> void:
	if run.choose(id):
		menu.hide()
		_refresh()


func _show_end() -> void:
	var won := run.phase == "won"
	var reason := "守住了三波，也击退了最后的守潮灵。"
	if not won:
		match run.loss_reason:
			"tide": reason = "守潮灵冲破了防线。躲过潮圈后，找机会定身输出。"
			"line": reason = "防线失守。优先击退已经靠近左边的雾影。"
			_: reason = "体力耗尽。先换道走位，再定身散射。"
	var saved := true
	if run.kills > best:
		var record := ConfigFile.new()
		record.set_value("record", "kills", run.kills)
		saved = record.save(RECORD) == OK
		if saved:
			best = run.kills
	var result := "\n本局击退 %d · 本机最好 %d" % [run.kills, best]
	if not saved:
		result += "\n本机存储不可用，这次未保存。"
	_open_menu("守滩成功" if won else "守滩结束", reason + result)
	menu_body.add_child(_button("再来一局", _restart.bind(true), true))
	menu_body.add_child(_button("返回会馆", _leave))


func _leave() -> void:
	if quit_requested:
		return
	quit_requested = true
	if exited.get_connections().is_empty():
		get_tree().quit()
	else:
		exited.emit()


func _toggle_brace() -> void:
	braced = not braced
	_reset_pointer()
	_refresh()


func _reset_brace() -> void:
	braced = false
	arena.braced = false


func _reset_pointer() -> void:
	pointer = -1
	drag_wish = Vector2.ZERO
	moved_pointer = false
	target = null
	arena.touch_origin = null
	arena.waypoint = null


func _on_pointer_press(local_point: Vector2, id: int) -> void:
	if menu.visible or pointer != -1:
		return
	braced = false
	if id == -2:
		target = arena.to_field(local_point)
	else:
		pointer = id
		press_origin = local_point
		arena.touch_origin = local_point
		arena.touch_offset = Vector2.ZERO
		target = null


func _input(event: InputEvent) -> void:
	if run == null or not is_visible_in_tree():
		return
	# Capture a tracked finger after it leaves the arena, so the joystick cannot stick.
	if pointer != -1:
		var touch_drag: bool = event is InputEventScreenDrag and event.index == pointer
		var mouse_drag: bool = event is InputEventMouseMotion and pointer == -3 and event.device == InputEvent.DEVICE_ID_EMULATION
		var touch_up: bool = event is InputEventScreenTouch and not event.pressed and event.index == pointer
		var mouse_up: bool = event is InputEventMouseButton and pointer == -3 and not event.pressed and event.button_index == MOUSE_BUTTON_LEFT
		if touch_drag or mouse_drag:
			var offset := arena.from_screen(event.position) - press_origin
			if moved_pointer or offset.length_squared() >= 64.0:
				moved_pointer = true
				drag_wish = (offset / 34.0).limit_length()
				arena.touch_offset = drag_wish * 21.0
			get_viewport().set_input_as_handled()
		elif touch_up or mouse_up:
			if not moved_pointer and not (touch_up and event.canceled):
				target = arena.to_field(arena.from_screen(event.position))
			pointer = -1
			moved_pointer = false
			drag_wish = Vector2.ZERO
			arena.touch_origin = null
			get_viewport().set_input_as_handled()
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ESCAPE:
			if run.phase == "play" and menu.visible:
				menu.hide()
			elif run.phase == "play":
				_pause()
			else:
				_leave()
			get_viewport().set_input_as_handled()
		elif event.keycode in [KEY_1, KEY_2, KEY_3] and run.phase == "choice":
			var index: int = event.keycode - KEY_1
			if index < run.offers.size():
				_claim(run.offers[index])
				get_viewport().set_input_as_handled()


func _physics_process(delta: float) -> void:
	if run == null or menu.visible or not is_visible_in_tree():
		return
	var dt := minf(delta, 1.0 / 30.0)
	var wish := Vector2(
		float(Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT)) - float(Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT)),
		float(Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN)) - float(Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP)))
	if wish != Vector2.ZERO or drag_wish != Vector2.ZERO:
		target = null
		braced = false
		wish = drag_wish if drag_wish != Vector2.ZERO else wish
	elif target != null:
		var diff: Vector2 = target - run.player
		if diff.length_squared() < 4.0:
			target = null
		else:
			wish = diff / (run.speed * dt)
	arena.braced = braced or Input.is_key_pressed(KEY_SPACE)
	arena.waypoint = target
	run.step(dt, wish, arena.braced)
	_refresh()
	arena.queue_redraw()
	if run.phase == "choice":
		_show_choices()
	elif run.phase in ["won", "lost"]:
		_show_end()


func _refresh() -> void:
	stats.text = "第 %d/3 波   ·   防线 %d/3   ·   体力 %d/4   ·   击退 %d" % [maxi(run.wave, 1), run.line, run.hp, run.kills]
	tip.text = "脚下有潮圈，先解除定身离开红圈。" if run.surge_left > 0.0 else "别让雾影越过左侧灯线。"
	brace_button.text = "已定身 · 点按解除" if braced else "定身散射 · 空格 / 点按"


func _notification(what: int) -> void:
	if (what == NOTIFICATION_APPLICATION_FOCUS_OUT or what == NOTIFICATION_APPLICATION_PAUSED) and run != null:
		_pause()
