extends Control
## LAB client shell: connection, first-run profile/OC setup, HUD (chat, emotes, spaces, data),
## input and client prediction. The 2D and 3D views render the same LabWorld.

const SEND_HZ := 12.0
const Minigames = preload("res://scripts/minigames.gd")
const EMOTE_TEXT := {"idle": "待机", "idleCute": "可爱待机", "walk": "走路", "run": "跑步", "blink": "眨眼", "nod": "点头", "shake": "摇头", "crouch": "下蹲", "weightShift": "重心转移", "shy": "害羞", "wave": "挥手", "headTilt": "歪头", "cheer": "欢呼", "legKick": "踢腿", "sway": "摇摆"}
const BeachShoot = preload("res://scenes/beach_shoot.tscn")
const GameCorner = preload("res://scripts/game_corner.gd")
const SPEED := 4.0
var world := LabWorld.new()
var font: Font
var view2d: Node2D
var view3d: Control
var hud: CanvasLayer
var view_loading: Control
var status_label: Label
var top_label: Label
var chat_log: RichTextLabel
var chat_input: LineEdit
var hint_label: Label
var panel_holder: Control
var toast_label: Label
var setup_panel: Control
var admission_panel: VBoxContainer
var admission_label: Label
var admission_join: Button
var admission_enter: Button
var admission_cancel: Button
var admission_priority: HBoxContainer
var connected_once := false
var welcomed := false
var move_target = null
var last_sent := Vector3.ZERO
var last_anim := "idle"
var send_timer := 0.0
var seq := 0
var requested_oc := {}
var near_object := ""
var space_spaces: Array = []
var toast_until := 0.0
var auto_actions: Array = []       # --lab-auto=... scripted input for automated browser tests
var auto_t := 0.0
var pending_upload := false
var watch_every := 0.0
var watch_t := 0.0
const TEST_ACTION_FILE := "user://lab-actions.txt"
var local_test_driver := false
var next_test_read := 0
var mobile := false
var joystick: Control
var interact_button: Button
var fish_bar: HBoxContainer
var fish_action: Button
var fish_depth: Button
var bird_action: Button
var frog_action: Button
var pond_enabled := false
var pond_job := ""
var pond_hud: VBoxContainer
var pond_status: Label
var pond_action: Button
var pond_ranger: Button
var pond_gardener: Button
var trail_hud: HBoxContainer
var trail_status: Label
var trail_button: Button
var fish_meter: Label
var fish_send_timer := 0.0
var fish_pending := 0.0
var chat_panel: Control
var panel_scroll: ScrollContainer
var next_oc_request_at := 0.0
var garden_tool := ""
var inventory := {"seeds":1,"soil":1}
var garden_phase := 0
var action_buttons := {}
const ACTION_WAIT_SECONDS := 3.0
const ACTION_WAIT_TEXT := "动作确认中…"
var pending_action := ""
var pending_action_until := 0.0
var inventory_label: Label
var path_mode := false             # 铺路: clicks lay or lift dirt-path tiles instead of walking
var path_button: Button
var minigames := Minigames.new()
var guide := preload("res://scripts/life_guide.gd").new()
var guide_enabled := false
var guide_pid := ""
var guide_button: Button
var public_updater: CanvasLayer
var activity_layer: CanvasLayer


func _ready() -> void:
	local_test_driver = OS.is_debug_build() and not OS.has_feature("web") and FileAccess.file_exists(TEST_ACTION_FILE)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	mobile = WebBridge.is_mobile()
	if mobile:
		Engine.max_fps = 30
	if mobile or WebBridge.is_web():
		get_window().size_changed.connect(_layout_mobile)
		_layout_mobile()
	font = load("res://assets/fonts/NotoSansSC-lab.woff2")
	theme = UiTheme.make_theme(font)
	theme.default_font_size = 18 if mobile else 16
	set_anchors_preset(Control.PRESET_FULL_RECT)
	view2d = load("res://scripts/hall2d.gd").new()
	add_child(view2d)
	view2d.setup(world, font)
	_build_hud()
	add_child(guide)
	guide.setup(font, func(msg): Net.send(msg))
	guide.has_joystick = is_instance_valid(joystick)
	guide.has_touch_interact = is_instance_valid(interact_button)
	guide.register_target("chat", func(): return chat_input.get_global_rect())
	guide.register_target("hint", func():
		if mobile and interact_button.visible:
			return interact_button.get_global_rect()
		return hint_label.get_global_rect() if hint_label.text != "" else Rect2())
	guide.register_target("top", func(): return top_label.get_global_rect())
	guide.register_target("player", func():
		var c := get_viewport().get_visible_rect().size * 0.5
		return Rect2(c + Vector2(-42, -96), Vector2(84, 112)))
	_build_view_loading()
	add_child(minigames)
	if OS.has_feature("lab_public_release") and not OS.is_debug_build():
		public_updater = preload("res://scripts/lab_public_updater.gd").new()
		add_child(public_updater)
	elif OS.has_feature("android") and OS.has_feature("lab_android_updates") and not OS.is_debug_build():
		add_child(preload("res://scripts/lab_updater.gd").new())
	_apply_view()
	Net.message.connect(_on_message)
	Net.state_changed.connect(_on_net_state)
	Net.account_link_prompt.connect(_show_account_link)
	Net.account_link_result.connect(func(ok: bool):
		_clear_panels()
		toast("已绑定，游戏进度不变。" if ok else "未绑定。此测试码可能不在迁移名单，或会馆授权未完成。"))
	WebBridge.orientation_result.connect(func(_ok, detail): toast(detail, 6))
	WebBridge.chat_submitted.connect(_send_chat)
	WebBridge.file_error.connect(func(detail): toast(detail, 6))
	WebBridge.file_picked.connect(_on_file_picked)
	UiScale.changed.connect(_layout_panel)
	if Ota.feature_enabled():
		Ota.update_available.connect(_show_update)
		Ota.download_progress.connect(_on_download_progress)
		Ota.download_failed.connect(func(reason: String): _ota_fail(reason))
		Ota.download_ready.connect(_ota_ready)
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--lab-auto="):
			auto_actions = Array(arg.trim_prefix("--lab-auto=").split(";"))
	if OS.has_feature("web"):
		var q = JavaScriptBridge.get_interface("location")
		var search := str(q.search)
		if search.find("auto=") >= 0:
			auto_actions = Array(search.split("auto=")[1].split("&")[0].uri_decode().split(";"))
	Net.connect_to_server()


# ------------------------------------------------------------------ HUD
func _build_hud() -> void:
	hud = CanvasLayer.new()
	add_child(hud)
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.add_child(root)
	var top := PanelContainer.new()
	top.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top.add_theme_stylebox_override("panel", UiTheme.hud_pill())
	root.add_child(top)
	var header_stack := VBoxContainer.new()
	top.add_child(header_stack)
	var bar := VBoxContainer.new()
	header_stack.add_child(bar)
	top_label = Label.new()
	# 不要 EXPAND_FILL：那会把按钮全推到右边，整条就不对称了。
	top_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	top_label.add_theme_font_size_override("font_size", 15)
	top_label.add_theme_color_override("font_color", UiTheme.TEXT_DIM)
	top_label.text = "西木会馆 LAB"
	bar.add_child(top_label)
	var actions := HFlowContainer.new()
	top_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	bar.add_child(actions)
	var buttons := [["视图" if mobile else "2D / 3D", _toggle_view], ["空间" if mobile else "虹之间", _open_spaces], ["形象" if mobile else "我的形象", _open_setup], ["数据" if mobile else "本地数据", _open_data], ["退出", _logout]]
	if mobile:
		buttons.append(["聊天", _toggle_mobile_chat])
		if WebBridge.is_web():
			buttons.append(["横屏", WebBridge.landscape])
	buttons.append(["捏人", _open_character_editor])
	buttons.append(["铺路", _toggle_path_mode])
	buttons.append(["小游戏", func(): minigames.open(self); _guide_event("minigame_opened")])
	buttons.append(["网页玩法 / 海滩", _open_game_corner])
	buttons.append(["新手引导", _open_guide])
	if OS.has_feature("lab_public_release") and not OS.is_debug_build():
		buttons.append(["检查更新", func():
			if is_instance_valid(public_updater): public_updater.call("check_now")])
	for b in buttons:
		var btn := Button.new()
		btn.text = b[0]
		if b[0] == "横屏":
			btn.name = "Landscape"
		elif b[0] == "聊天":
			btn.name = "ChatToggle"
		elif b[0] == "捏人":
			btn.name = "CharacterEditorEntry"
		elif b[0] == "铺路":
			btn.name = "PathMode"
			btn.toggle_mode = true
			path_button = btn
		elif b[0] == "小游戏":
			btn.name = "MinigamesEntry"
			minigames.entry = btn
		elif b[0] == "网页玩法 / 海滩":
			btn.name = "GameCornerEntry"
		elif b[0] == "新手引导":
			guide_button = btn
			btn.hide()
		var guide_target: String = {"视图": "view", "2D / 3D": "view", "空间": "spaces", "虹之间": "spaces", "小游戏": "minigame", "捏人": "character"}.get(b[0], "")
		if not guide_target.is_empty():
			guide.register_target(guide_target, btn.get_global_rect)
		btn.focus_mode = Control.FOCUS_NONE
		if mobile:
			btn.custom_minimum_size.y = 40
		for state in ["normal", "hover", "pressed", "disabled"]:
			btn.add_theme_stylebox_override(state, UiTheme.button_box(state, UiTheme.R_PILL, 12))
		btn.pressed.connect(b[1])
		actions.add_child(btn)
	var garden_bar := HBoxContainer.new()
	header_stack.add_child(garden_bar)
	guide.register_target("garden", garden_bar.get_global_rect)
	inventory_label = Label.new()
	garden_bar.add_child(inventory_label)
	for tool in [["行走", ""], ["泥土地块", "soil"], ["种蘑菇", "plant"], ["铲子", "shovel"]]:
		var button := Button.new()
		button.text = tool[0]
		button.focus_mode = Control.FOCUS_NONE
		button.pressed.connect(func():
			garden_tool = tool[1]
			if not garden_tool.is_empty():
				_guide_event("garden_tool", garden_tool)
			path_mode = garden_tool != ""
			move_target = null
			toast({"":"已切换行走", "soil":"点附近地面放置泥土；再点空泥土可收回", "plant":"点附近的泥土种下蘑菇", "shovel":"点自己种的蘑菇，铲回一颗种子"}[garden_tool]))
		garden_bar.add_child(button)
	_add_button(garden_bar, "种植帮助", func():
		toast("没有固定农田：靠近空地，选「泥土地块」点地面；再选「种蘑菇」点泥土。用「铲子」铲自己的蘑菇，可收回种子。", 8.0), "GardenHelp").focus_mode = Control.FOCUS_NONE
	_refresh_inventory()
	fish_bar = HBoxContainer.new()
	fish_bar.hide()
	header_stack.add_child(fish_bar)
	fish_action = _add_button(fish_bar, "试游", _toggle_fish, "FishTrial")
	bird_action = _add_button(fish_bar, "桥栏试飞", func(): _enter_species("bird"), "BirdTrial")
	frog_action = _add_button(fish_bar, "荷边捕虫", func(): _enter_species("frog"), "FrogTrial")
	fish_depth = _add_button(fish_bar, "潜水", _toggle_fish_depth, "FishDepth")
	fish_meter = Label.new()
	fish_bar.add_child(fish_meter)
	for button in [fish_action, bird_action, frog_action, fish_depth]:
		button.focus_mode = Control.FOCUS_NONE
		if mobile: button.custom_minimum_size.y = 44
	pond_hud = VBoxContainer.new()
	pond_hud.hide()
	header_stack.add_child(pond_hud)
	pond_status = Label.new()
	pond_hud.add_child(pond_status)
	var pond_buttons := HBoxContainer.new()
	pond_hud.add_child(pond_buttons)
	pond_ranger = _add_button(pond_buttons, "巡林员", func(): _set_pond_job("ranger"), "PondRanger")
	pond_gardener = _add_button(pond_buttons, "园艺师", func(): _set_pond_job("gardener"), "PondGardener")
	pond_action = _add_button(pond_buttons, "巡查标记", _act_on_pond, "PondWork")
	var art := _add_button(pond_buttons, "美术需求", func():
		toast("占位：荷池边缘（坡岸）、巡查标杆、前后淤泥和荷叶组合。玩法可用，美术待换。", 9), "PondArtNeeds")
	for button in [pond_ranger, pond_gardener, pond_action, art]:
		button.focus_mode = Control.FOCUS_NONE
		if mobile: button.custom_minimum_size.y = 44
	trail_hud = HBoxContainer.new()
	trail_hud.hide()
	header_stack.add_child(trail_hud)
	trail_button = _add_button(trail_hud, "松风径", _travel_outskirts, "TrailTravel")
	trail_button.focus_mode = Control.FOCUS_NONE
	if mobile: trail_button.custom_minimum_size.y = 44
	trail_status = Label.new()
	trail_hud.add_child(trail_status)
	var left := VBoxContainer.new()
	left.anchor_top = 1.0; left.anchor_bottom = 1.0
	left.offset_left = 12; left.offset_top = -340; left.offset_right = 430; left.offset_bottom = -12
	root.add_child(left)
	chat_panel = left
	if mobile:
		left.visible = false
	chat_log = RichTextLabel.new()
	chat_log.custom_minimum_size = Vector2(410, 170)
	if mobile:
		chat_log.custom_minimum_size.x = 0
	chat_log.scroll_following = true
	chat_log.bbcode_enabled = false
	chat_log.add_theme_color_override("default_color", Color.WHITE)
	chat_log.add_theme_constant_override("outline_size", 4)
	chat_log.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.7))
	chat_log.mouse_filter = Control.MOUSE_FILTER_IGNORE
	chat_log.add_theme_stylebox_override("normal", UiTheme.chat_box())
	left.add_child(chat_log)
	var crow := HBoxContainer.new()
	left.add_child(crow)
	chat_input = LineEdit.new()
	chat_input.placeholder_text = "按 Enter 聊天"
	chat_input.max_length = 200
	chat_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	chat_input.custom_minimum_size.y = UiScale.min_touch
	chat_input.text_submitted.connect(_send_chat)
	crow.add_child(chat_input)
	if not WebBridge.is_web():
		var send_button := _add_button(crow, "发送", func(): _send_chat(chat_input.text), "ChatSend")
		send_button.focus_mode = Control.FOCUS_NONE
		if mobile:
			send_button.custom_minimum_size = Vector2(68, 44)
	if mobile:
		chat_input.custom_minimum_size.y = 44
		if WebBridge.is_web():
			chat_input.editable = false
			chat_input.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var emotes := GridContainer.new()
	emotes.columns = 5
	left.add_child(emotes)
	guide.register_target("emotes", emotes.get_global_rect)
	for e in EMOTE_TEXT:
		if e in ["walk", "run"]: continue
		var eb := Button.new()
		eb.text = EMOTE_TEXT[e]
		eb.name = "Action_" + e
		eb.tooltip_text = "播放" + EMOTE_TEXT[e]
		eb.custom_minimum_size = Vector2(76,32)
		eb.focus_mode = Control.FOCUS_NONE
		eb.add_theme_font_size_override("font_size", 13)
		eb.pressed.connect(func(): _request_action(e))
		action_buttons[e] = eb
		emotes.add_child(eb)
	hint_label = Label.new()
	hint_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	hint_label.offset_top = -90; hint_label.offset_left = -200; hint_label.offset_right = 200
	hint_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint_label.add_theme_constant_override("outline_size", 6)
	hint_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	root.add_child(hint_label)
	toast_label = Label.new()
	toast_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	toast_label.offset_top = 130; toast_label.offset_left = -300; toast_label.offset_right = 300
	toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast_label.add_theme_font_size_override("font_size", 18)
	toast_label.add_theme_constant_override("outline_size", 6)
	toast_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	root.add_child(toast_label)
	status_label = Label.new()
	status_label.set_anchors_preset(Control.PRESET_CENTER)
	status_label.offset_left = -300; status_label.offset_right = 300
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status_label.add_theme_font_size_override("font_size", 22)
	status_label.add_theme_constant_override("outline_size", 8)
	status_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	status_label.text = "正在连接西木会馆…"
	root.add_child(status_label)
	panel_holder = Control.new()
	panel_holder.set_anchors_preset(Control.PRESET_FULL_RECT)
	panel_holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(panel_holder)
	if mobile:
		joystick = load("res://scripts/touch_joystick.gd").new()
		joystick.name = "TouchPad"
		joystick.anchor_top = 1.0
		joystick.anchor_bottom = 1.0
		joystick.offset_left = 16
		joystick.offset_right = 156
		joystick.offset_top = -156
		joystick.offset_bottom = -16
		root.add_child(joystick)
	# Touch screens have no E key: a button appears while standing next to something interactive.
	interact_button = Button.new()
	interact_button.name = "InteractButton"
	interact_button.focus_mode = Control.FOCUS_NONE
	interact_button.anchor_left = 1.0
	interact_button.anchor_right = 1.0
	interact_button.anchor_top = 1.0
	interact_button.anchor_bottom = 1.0
	interact_button.offset_left = -196 if mobile else -220
	interact_button.offset_right = -20
	interact_button.offset_top = -120 if mobile else -84
	interact_button.offset_bottom = -24
	interact_button.add_theme_font_size_override("font_size", 24 if mobile else 18)
	interact_button.visible = false
	interact_button.pressed.connect(_interact)
	root.add_child(interact_button)


func _toggle_path_mode() -> void:
	garden_tool = ""
	path_mode = not path_mode
	if path_button:
		path_button.set_pressed_no_signal(path_mode)
		path_button.text = "铺路中" if path_mode else "铺路"
	move_target = null
	if path_mode:
		toast("铺路：点地面铺一格泥土路，点自己铺的那格就拿掉" + ("" if mobile else "；R 键在脚下铺／拆"), 5)
	else:
		view2d.path_cursor = null


## Lay a dirt-path tile on the 1 m cell at p, or lift it if it is already there.
func _pave_at(p: Vector2) -> void:
	var cell := LabWorld.cell_of(p)
	if garden_tool in ["plant", "shovel"]:
		Net.send({"t":"garden", "action":garden_tool, "x":cell.x,"z":cell.y})
		return
	if world.tiles.has(cell):
		if world.can_lift(cell):
			Net.send({"t": "tile", "x": cell.x, "z": cell.y, "on": false})
		else:
			toast("这格是别人铺的，只能拿掉自己铺的路")
	else:
		Net.send({"t": "tile", "x": cell.x, "z": cell.y, "on": true, "kind": "dirt"})


func _interact() -> void:
	if near_object != "":
		Net.send({"t": "interact", "object": near_object})
		_guide_event("interacted")


func _layout_mobile() -> void:
	var window := get_window()
	var pixels := Vector2(WebBridge.viewport_size())
	if pixels.x <= 0 or pixels.y <= 0:
		return
	var ratio := minf(1.0, 1280.0 / maxf(pixels.x, pixels.y))
	if window.content_scale_mode != Window.CONTENT_SCALE_MODE_VIEWPORT:
		window.content_scale_mode = Window.CONTENT_SCALE_MODE_VIEWPORT
	var render_size := Vector2i(pixels * ratio)
	if window.content_scale_size != render_size:
		window.content_scale_size = render_size
	_layout_panel.call_deferred()


func _toggle_mobile_chat() -> void:
	chat_panel.visible = not chat_panel.visible


func _layout_panel() -> void:
	if not is_instance_valid(panel_scroll):
		return
	var pad := UiScale.insets
	var available := get_viewport_rect().size - Vector2(pad.x + pad.z + 32.0, pad.y + pad.w + 32.0)
	var content := panel_scroll.get_child(0) as Control
	panel_scroll.custom_minimum_size = Vector2(minf(float(panel_scroll.get_meta("width")), available.x), minf(content.get_combined_minimum_size().y, available.y))


func toast(text: String, seconds := 3.5) -> void:
	toast_label.text = text
	toast_until = Time.get_ticks_msec() / 1000.0 + seconds


func _clear_panels() -> void:
	panel_scroll = null
	for c in panel_holder.get_children():
		panel_holder.remove_child(c)
		c.queue_free()


func _panel(title: String, width := 520.0, closable := true, on_close := Callable()) -> VBoxContainer:
	_clear_panels()
	var vp := get_viewport().get_visible_rect().size
	var pad := UiScale.insets
	# 可用区域（虚拟像素）：安全区内留 12 的余量。
	var avail_w := vp.x - pad.x - pad.z - 24.0
	var avail_h := vp.y - pad.y - pad.w - 24.0
	width = clampf(width, 240.0, avail_w)
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.35) if closable else Color(0.11, 0.16, 0.13)
	panel_holder.add_child(shade)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var center := CenterContainer.new()
	panel_holder.add_child(center)
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var p := PanelContainer.new()
	p.name = "Dialog"
	center.add_child(p)
	panel_scroll = ScrollContainer.new()
	panel_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
	panel_scroll.set_meta("width", width)
	p.add_child(panel_scroll)
	var box := VBoxContainer.new()
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	box.add_theme_constant_override("separation", 8)
	panel_scroll.add_child(box)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 10)
	box.add_child(head)
	var l := Label.new(); l.text = title; l.add_theme_font_size_override("font_size", 20)
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size.x = width - 140.0
	head.add_child(l)
	if closable:
		var x := Button.new(); x.text = "关闭"; x.pressed.connect(on_close if on_close.is_valid() else _clear_panels); head.add_child(x)
	_layout_panel.call_deferred()
	return box


func _add_button(box: Control, text: String, cb: Callable, name := "") -> Button:
	var b := Button.new()
	b.text = text
	if mobile:
		b.custom_minimum_size.y = 40
	if name != "":
		b.name = name
	b.pressed.connect(cb)
	box.add_child(b)
	return b


# ------------------------------------------------------------------ setup / OC
func _open_setup(draft_nick := "") -> void:
	var box := _panel("你的昵称与 OC", 560)
	var info := Label.new()
	info.text = "OC 原图只保存在本机。联机时服务器临时转发一份缩小的展示副本给同一空间的玩家。"
	info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.custom_minimum_size = Vector2(minf(520, get_viewport_rect().size.x - 64), 0)
	box.add_child(info)
	var nick := LineEdit.new()
	nick.name = "Nick"
	nick.placeholder_text = "昵称（1-16 字）"
	nick.max_length = 16
	nick.text = draft_nick if not draft_nick.is_empty() else Profile.nick
	box.add_child(nick)
	if mobile and WebBridge.is_web():
		_add_button(box, "输入昵称", func():
			var value = WebBridge.prompt_text("输入昵称（1–16 字）", nick.text)
			if value != null:
				nick.text = str(value).strip_edges().substr(0, 16)
				Profile.nick = nick.text, "NativeNick")
	var preview := TextureRect.new()
	preview.custom_minimum_size = Vector2(160, 200)
	preview.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	preview.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	if Profile.use_renmo or Profile.oc_png.is_empty():
		var view = preload("res://scripts/renmo_avatar_view.gd").new()  # body + face layers
		view.colors = Profile.part_colors
		view.pose = {"anim":"idle","face":Profile.face}
		view.set_anchors_preset(Control.PRESET_FULL_RECT)
		preview.add_child(view)
	else:
		preview.texture = LabWorld.texture_from_png(Profile.oc_png)
	box.add_child(preview)
	var row: BoxContainer = VBoxContainer.new() if mobile else HBoxContainer.new()
	box.add_child(row)
	_add_button(row, "上传 PNG / JPG / WebP（≤8 MB）", func(): Profile.nick = nick.text.strip_edges(); _pick_oc(preview), "Upload")
	_add_button(row, "捏人", func():
		var current_nick := nick.text.strip_edges()
		_open_character_editor(true, current_nick), "Renmo")
	if Profile.use_renmo and Profile.oc_source == "upload" and not Profile.oc_png.is_empty():
		_add_button(box, "使用原来的 OC 图片", func():
			Profile.use_renmo = false
			Profile.save_local()
			if welcomed: _send_oc()
			_open_setup(nick.text), "RestoreUploadedOC")
	var go := _add_button(box, "进入会馆", func():
		var n := nick.text.strip_edges()
		if n == "":
			toast("先起一个昵称")
			return
		if Profile.oc_png.size() == 0:
			Profile.use_renmo = true
		Profile.nick = n
		Profile.save_local()
		_send_profile()
		_clear_panels()
		_guide_event("profile_ready"), "Enter")
	go.add_theme_font_size_override("font_size", 18)
	setup_panel = box


func _pick_oc(preview: TextureRect) -> void:
	WebBridge.pick_file("image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp")


func _on_file_picked(name: String, data: PackedByteArray) -> void:
	if name.to_lower().ends_with(".json"):
		if Profile.import_json(data.get_string_from_utf8()):
			toast("已导入本地数据")
			_send_profile()
		else:
			toast("这不是 LAB 导出的数据文件")
		return
	var err := _check_image(data)
	if err != "":
		toast(err)
		return
	Profile.set_oc(data, "upload")
	toast("形象已保存在本机")
	if welcomed:
		_send_oc()
	_open_setup()


func _check_image(data: PackedByteArray) -> String:
	if data.size() > 8 * 1024 * 1024:
		return "图片超过 8 MB"
	var img := Image.new()
	var is_png := data.size() > 8 and data[0] == 0x89 and data[1] == 0x50
	var is_webp := data.size() > 12 and data[0] == 0x52 and data[8] == 0x57
	var is_jpg := data.size() > 3 and data[0] == 0xff and data[1] == 0xd8 and data[2] == 0xff
	if not (is_png or is_webp or is_jpg):
		return "只支持 PNG、JPG 或 WebP"
	var e := img.load_jpg_from_buffer(data) if is_jpg else (img.load_png_from_buffer(data) if is_png else img.load_webp_from_buffer(data))
	if e != OK:
		return "图片无法解码"
	if img.get_width() > 4096 or img.get_height() > 4096:
		return "图片边长不能超过 4096"
	if not img.detect_alpha():
		toast("提示：这张图没有透明背景，在场景里会显示成方块", 5)
	return ""


func _send_profile() -> void:
	if Profile.nick != "":
		Net.send({"t": "profile", "nick": Profile.nick, "part_colors":Profile.part_colors, "face":Profile.face})
	_send_oc()


func _send_oc() -> void:
	if Profile.use_renmo:
		if Profile.nick != "": Net.send({"t":"profile","nick":Profile.nick,"part_colors":Profile.part_colors,"face":Profile.face})
		world.my_texture = null
		Net.send({"t": "oc_clear"})
		return
	if Profile.oc_png.size() > 0:
		world.my_texture = LabWorld.texture_from_png(Profile.oc_png)
		if world.my_texture == null:
			toast("形象无法解码，请重新选择图片")
			return
		# Keep the original on this device and transmit only the bounded display copy.
		var display_png := world.my_texture.get_image().save_png_to_buffer()
		Net.send({"t": "oc_set", "data": Marshalls.raw_to_base64(display_png), "source": Profile.oc_source})


# ------------------------------------------------------------------ data panel
func _open_data() -> void:
	var box := _panel("本地数据", 520)
	var l := Label.new()
	l.text = "昵称、OC 图片和显示设置保存在本机，可导出备份。清除应用或浏览器数据会移除它们。公共世界和灵质空间保存在 LAB 服务器上。"
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(0, 0)
	box.add_child(l)
	_add_button(box, "导出本地数据", func(): WebBridge.download_text("zszm-lab-profile.json", Profile.export_json()); toast("已导出"))
	_add_button(box, "导入本地数据", func():
		WebBridge.pick_file("application/json,.json"))
	_add_button(box, "绑定旧测试码进度", _confirm_account_link)
	# 自更新暂时关闭（包体 145 MB，OTA 下载体验差）。实现保留在 scripts/ota.gd，
	# 把那里的 FEATURE_ENABLED 改回 true 即可恢复，这里不用动。
	if Ota.feature_enabled():
		_add_button(box, "检查更新", _check_update_manual, "CheckUpdate")
	var names := CheckBox.new(); names.text = "显示名字"; names.button_pressed = Profile.show_names
	names.toggled.connect(func(on): Profile.show_names = on; Profile.save_local())
	box.add_child(names)
	_add_button(box, "清除本机个人数据", func():
		Profile.clear_local()
		Net.send({"t": "oc_clear"})
		world.my_texture = null
		toast("已清除本机数据，公共世界不受影响")
		_open_setup())


func _confirm_account_link() -> void:
	var box := _panel("绑定旧测试码进度", 520)
	var note := Label.new()
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.custom_minimum_size.x = 0
	note.text = "绑定成功后，旧进度和 OC 归入会馆账号；旧测试码不再单独登录。已有两个档案时不会合并。"
	box.add_child(note)
	_add_button(box, "确认开始绑定", func():
		if WebBridge.is_web():
			JavaScriptBridge.get_interface("window").open("/account-link", "_self")
		else:
			Net.login_account_native(Net.http_base(), true))


func _show_account_link(match_code: String) -> void:
	var box := _panel("到会馆确认绑定，匹配码：" + match_code, 500, false)
	_add_button(box, "打开会馆网站", func(): OS.shell_open(Net.account_approval_url))
	_add_button(box, "取消", func():
		Net.cancel_account_login(true)
		_clear_panels())


func _logout() -> void:
	if WebBridge.is_web():
		Net.close()
		WebBridge.logout()
	elif not Net.cookie.is_empty():
		Net.logout_native()


# ------------------------------------------------------------------ OTA
var _ota_box: VBoxContainer
var _ota_progress: ProgressBar
var _ota_note: Label


func _show_update(info: Dictionary) -> void:
	var ver := str(info.get("versionName", ""))
	var box := _panel("发现新版本 %s" % ver, 460.0)
	_ota_box = box
	var body := Label.new()
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var lines := PackedStringArray()
	lines.append("当前版本：%s（%d）" % [Ota.local_name, Ota.local_code])
	lines.append("新版本：%s（%d）" % [ver, int(info.get("versionCode", 0))])
	var notes := Ota.changelog_of(info)
	if notes.size() > 0:
		lines.append("")
		for n in notes:
			lines.append("· " + str(n))
	var size := int(info.get("size", 0))
	if size > 0:
		lines.append("")
		lines.append("安装包约 %.1f MB" % (float(size) / 1048576.0))
	body.text = "\n".join(lines)
	box.add_child(body)
	_ota_note = Label.new()
	_ota_note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_ota_note.text = ""
	box.add_child(_ota_note)
	_ota_progress = ProgressBar.new()
	_ota_progress.min_value = 0
	_ota_progress.max_value = 100
	_ota_progress.custom_minimum_size.y = 18
	_ota_progress.visible = false
	box.add_child(_ota_progress)
	_add_button(box, "立即更新", _ota_begin, "OtaNow")
	# force 时不给「稍后」，与拾灵一致：只有确实必须才这么发版。
	if not Ota.is_forced(info):
		_add_button(box, "稍后", func(): _clear_panels(), "OtaLater")


func _ota_begin() -> void:
	if _ota_progress != null:
		_ota_progress.visible = true
	if _ota_note != null:
		_ota_note.text = "正在下载，可在通知栏查看进度。"
	Ota.start_download()


func _on_download_progress(percent: int) -> void:
	if _ota_progress != null:
		_ota_progress.value = percent
	if _ota_note != null:
		_ota_note.text = "正在下载 %d%%" % percent


func _ota_ready() -> void:
	if _ota_note != null:
		_ota_note.text = "下载完成，校验通过。按系统提示安装即可。"
	Ota.install()


func _ota_fail(reason: String) -> void:
	if _ota_note != null:
		_ota_note.text = reason
	else:
		toast(reason)


func _check_update_manual() -> void:
	Ota.check_manual(func(latest: String): toast("已是最新版本 %s" % latest, 4))


func _native_login_form(detail: String) -> void:
	var box := _panel("登录西木会馆", 460.0, false)
	panel_holder.move_to_front()
	var server := LineEdit.new()
	server.name = "NativeServer"
	server.placeholder_text = "服务器地址（https://…）"
	server.text = Net.http_base()

	var account := _add_button(box, "使用西木会馆账户登录", func():
		if Net.can_direct_native(server.text):
			Net.login_account_direct(server.text)
		else:
			Net.login_account_native(server.text), "NativeAccountLogin")
	account.custom_minimum_size.y = UiScale.min_touch
	if not detail.is_empty():
		var hint := Label.new()
		hint.text = detail
		hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		box.add_child(hint)

	var legacy := VBoxContainer.new()
	legacy.name = "NativeLegacyOptions"
	legacy.hide()
	var toggle := Button.new()
	toggle.name = "NativeLegacyToggle"
	toggle.text = "有旧测试码？展开其他登录方式"
	toggle.toggle_mode = true
	toggle.custom_minimum_size.y = UiScale.min_touch
	box.add_child(toggle)
	box.add_child(legacy)
	toggle.toggled.connect(func(expanded: bool):
		legacy.visible = expanded
		toggle.text = "收起其他登录方式" if expanded else "有旧测试码？展开其他登录方式")

	var code := LineEdit.new()
	code.name = "NativeCode"
	code.placeholder_text = "输入 LAB 测试码"
	code.secret = true
	code.max_length = 64
	legacy.add_child(code)
	var submit := func(): Net.login_native(server.text, code.text)
	_add_button(legacy, "用测试码登录", submit, "NativeLogin")
	code.text_submitted.connect(func(_value): submit.call())
	legacy.add_child(server)
	_add_button(box, "在 GitHub 给项目点 Star", func(): OS.shell_open("https://github.com/iridescent1208234593-debug/Gate-of-All-Beings"), "GitHubStar")
	if local_test_driver:
		server.text_changed.connect(func(value: String):
			_write_test_json("user://lab-loopback.json", {"endpoint": value if value.begins_with("http://127.0.0.1:") else ""}))
		# Native controls are drawn by Godot. Give the packaged UI test their hit rectangles.
		await get_tree().process_frame
		await get_tree().process_frame
		var layout := {"viewport": [get_viewport_rect().size.x, get_viewport_rect().size.y],
			"pixels": [get_window().size.x, get_window().size.y]}
		for control_name in ["NativeServer", "NativeCode", "NativeLogin"]:
			layout[control_name] = _ui_rect(control_name)
		_write_test_json("user://lab-login-layout.json", layout)


# ------------------------------------------------------------------ spaces
func _open_spaces() -> void:
	Net.send({"t": "spaces"})
	_render_spaces()
	_guide_event("spaces_opened")


func _guide_event(event: String, data: Variant = null) -> void:
	if guide_enabled:
		guide.on_event(event, data)


# ------------------------------------------------------------------ guide panel (pause / resume / review)
func _open_guide() -> void:
	if not guide_enabled:
		return
	var box := _panel("新手引导 · 开始生活", 520)
	var l := Label.new()
	l.text = "边玩边学：捏人、走路、聊天、互动、虹之间。每样东西第一次用到时，会有一点灵光来提示。
" + guide.summary()
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(0, 0)
	box.add_child(l)
	_add_button(box, "捏人教程", func(): _open_character_editor(false, "", _open_guide), "GuideCharacterEditor")
	var row := HBoxContainer.new()
	box.add_child(row)
	if guide.status == "paused":
		_add_button(row, "继续引导", func(): _clear_panels(); guide.resume(), "GuideResume")
	elif not guide.is_finished():
		_add_button(row, "暂停引导", func(): _clear_panels(); guide.pause(), "GuidePause")
	_add_button(row, "重新查看", func(): _clear_panels(); guide.review(), "GuideReview")
	if not guide.is_finished():
		_add_button(row, "不需要引导", func(): _clear_panels(); guide.skip(), "GuideSkip")


func _open_game_corner() -> void:
	if not welcomed or activity_layer != null:
		return
	_clear_panels()
	chat_input.release_focus()
	move_target = null
	var corner := GameCorner.new()
	corner.theme = theme
	corner.can_play = Profile.has_profile()
	corner.shoot_requested.connect(_open_beach_shoot)
	corner.closed.connect(_clear_panels)
	panel_holder.add_child(corner)
	corner.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	guide.on_event("minigame_opened")


func _open_beach_shoot() -> void:
	if not _begin_activity():
		return
	var game = BeachShoot.instantiate()
	game.theme = theme
	game.exited.connect(_close_activity)
	activity_layer.add_child(game)


func _begin_activity() -> bool:
	if activity_layer != null or not welcomed or not Profile.has_profile():
		return false
	_clear_panels()
	chat_input.release_focus()
	move_target = null
	world.me["anim"] = "idle"
	view2d.activate(false)
	if view3d:
		view3d.activate(false)
	hud.hide()
	guide.hide()
	activity_layer = CanvasLayer.new()
	activity_layer.layer = 30
	add_child(activity_layer)
	return true


func _close_activity() -> void:
	if activity_layer == null:
		return
	var closing := activity_layer
	activity_layer = null
	closing.hide()
	closing.queue_free()
	move_target = null
	guide.show()
	hud.show()
	_apply_view()


func _render_spaces() -> void:
	var box := _panel("虹之间 · 灵质空间", 600)
	var l := Label.new()
	l.text = "馆长虹把开辟灵质空间的能力分享给了每位访客。在会馆的「虹之间」彩虹门前，可以开辟自己的空间（世界的一条独立历史分支），邀请朋友，或返回会馆。"
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(0, 0)
	box.add_child(l)
	var mine = null
	for s in space_spaces:
		var row := HBoxContainer.new()
		box.add_child(row)
		var name := Label.new()
		name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var tag := "公共" if s["kind"] == "public" else ("我的" if s["mine"] else "受邀")
		name.text = "%s ·【%s】 在线 %d%s" % [s["title"], tag, int(s["online"]), "" if s["kind"] == "public" or s.get("r4_branch", false) else " · 历史分支准备中"]
		row.add_child(name)
		if s["id"] != world.space.get("id", ""):
			_add_button(row, "前往", func(): Net.send({"t": "space_enter", "space": s["id"]}); _clear_panels(), "Go_" + str(s["id"]))
		else:
			var here := Label.new(); here.text = "（你在这里）"; row.add_child(here)
		if s.get("mine", false):
			mine = s
	if mine == null:
		_add_button(box, "在此开辟我的灵质空间", func(): Net.send({"t": "space_create"}), "CreateSpace")
	else:
		var sub := Label.new(); sub.text = "邀请当前空间里的玩家："; box.add_child(sub)
		for pid in world.players:
			var row := HBoxContainer.new()
			box.add_child(row)
			var n := Label.new(); n.text = world.players[pid].get("nick", pid); n.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			row.add_child(n)
			if pid in mine.get("guests", []):
				_add_button(row, "撤销访问", func(): Net.send({"t": "space_revoke", "pid": pid}))
			else:
				_add_button(row, "邀请", func(): Net.send({"t": "space_invite", "pid": pid}), "Invite_" + pid)
		for g in mine.get("guests", []):
			if not world.players.has(g):
				var row := HBoxContainer.new()
				box.add_child(row)
				var n := Label.new(); n.text = "已邀请 " + g; n.size_flags_horizontal = Control.SIZE_EXPAND_FILL; row.add_child(n)
				_add_button(row, "撤销访问", func(): Net.send({"t": "space_revoke", "pid": g}))
		if world.space.get("id", "") == mine["id"]:
			var trow := HBoxContainer.new()
			box.add_child(trow)
			var tl := Label.new(); tl.text = "这条历史的时间："; trow.add_child(tl)
			_add_button(trow, "暂停", func(): Net.send({"t": "space_time", "action": "pause"}))
			_add_button(trow, "继续", func(): Net.send({"t": "space_time", "action": "resume"}))
			_add_button(trow, "快进 6 小时", func(): Net.send({"t": "space_time", "action": "advance", "ticks": 6}))


# ------------------------------------------------------------------ messages
func _render_native_admission(snapshot: Dictionary, note: String) -> void:
	if Net.state != "admission" or not is_instance_valid(admission_panel):
		return
	var kind := str(snapshot.get("state", ""))
	var text := "正在核对入场状态…"
	match kind:
		"idle": text = "当前未排队。你可以重新加入。"
		"queued": text = "正在排队，当前第 %d 位。" % int(snapshot.get("position", 0))
		"ready": text = "轮到你了，请尽快进入会馆。"
		"full": text = "等候区已满，点下方按钮再试一次。"
		"playing": text = "这个账户已在游玩；请先退出另一台设备。"
	admission_label.text = note if kind.is_empty() and not note.is_empty() else text + ("\n" + note if not note.is_empty() else "")
	admission_join.visible = kind in ["idle", "full"]
	admission_enter.visible = kind == "ready"
	admission_cancel.visible = kind in ["queued", "ready"]
	admission_priority.visible = Net.can_use_admission_priority() and kind in ["idle", "queued", "full"]


func _native_admission_panel() -> void:
	if not Net.admission_changed.is_connected(_render_native_admission):
		Net.admission_changed.connect(_render_native_admission)
	admission_panel = _panel("会馆入场", 460.0, false)
	admission_label = Label.new()
	admission_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	admission_panel.add_child(admission_label)
	admission_enter = _add_button(admission_panel, "进入会馆", Net.enter_admission, "AdmissionEnter")
	admission_join = _add_button(admission_panel, "加入排队", Net.join_admission, "AdmissionJoin")
	admission_cancel = _add_button(admission_panel, "取消排队", Net.cancel_admission, "AdmissionCancel")
	admission_priority = HBoxContainer.new()
	admission_panel.add_child(admission_priority)
	var code := LineEdit.new()
	code.placeholder_text = "测试码（可选）"
	code.secret = true
	code.max_length = 64
	code.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	admission_priority.add_child(code)
	_add_button(admission_priority, "优先入场", func() -> void:
		var proof := code.text.strip_edges()
		if not proof.is_empty() and Net.join_admission(proof):
			code.clear(), "AdmissionPriority")
	_add_button(admission_panel, "退出登录", _logout, "AdmissionLogout")
	_render_native_admission({}, "")


func _on_net_state(state: String, detail: String) -> void:
	if state != "open":
		_finish_action()
	if activity_layer != null and state in ["login", "account_approval", "authenticating", "logging_out", "unauthorized"]:
		_close_activity()
	match state:
		"login":
			welcomed = false
			guide_enabled = false
			guide_pid = ""
			guide_button.hide()
			guide.reset_session()
			hud.layer = 20
			status_label.visible = false
			_native_login_form(detail)
		"account_approval":
			welcomed = false
			hud.layer = 20
			var box := _panel("请在会馆网站确认，并输入匹配码：" + Net.account_match_code, 460.0, false)
			_add_button(box, "打开会馆网站", func(): OS.shell_open(Net.account_approval_url))
			_add_button(box, "取消", Net.cancel_account_login)
		"direct_check", "direct_browser", "direct_redeeming":
			welcomed = false
			hud.layer = 20
			var caption: String = {"direct_check": "正在核对免码入口…", "direct_browser": "请在浏览器登录会馆并同意，然后回到游戏。", "direct_redeeming": "正在完成会馆授权…"}[state]
			var box := _panel(caption, 460.0, false)
			_add_button(box, "取消", Net.cancel_direct_native)
		"admission":
			welcomed = false
			hud.layer = 20
			status_label.visible = false
			_native_admission_panel()
		"authenticating", "logging_out":
			welcomed = false
			hud.layer = 20
			_panel("正在登录…" if state == "authenticating" else "正在退出…", 460.0, false)
		"connecting", "reconnecting":
			welcomed = false
			status_label.text = "正在连接西木会馆…" if not connected_once else "连接中断，正在重连…"
			status_label.visible = true
			if not WebBridge.is_web():
				hud.layer = 20
				var box := _panel(status_label.text, 460.0, false)
				_add_button(box, "返回登录", _logout)
		"open":
			connected_once = true
		"unauthorized":
			if not WebBridge.is_web():
				Net.require_login("会话已过期或服务器拒绝连接，请重新登录")
				return
			status_label.text = "测试码已失效或会话已过期，请重新输入测试码"
			status_label.visible = true
			await get_tree().create_timer(2.0).timeout
			WebBridge.goto_login()


func _on_message(m: Dictionary) -> void:
	match m.get("t"):
		"welcome":
			_finish_action()
			if not welcomed:
				hud.layer = 1
				_clear_panels()
			var first_welcome := not welcomed
			welcomed = true
			requested_oc.clear()
			next_oc_request_at = 0.0
			status_label.visible = false
			world.me_pid = m["pid"]
			world.set_space(m["space"])
			world.outskirts = m.get("outskirts", {})
			pond_enabled = m.has("east_bank_job")
			pond_job = str(m.get("east_bank_job", ""))
			world.species_enabled = m.has("species_trials")
			world.species_trials = m.get("species_trials", {})
			fish_pending = 0.0
			world.me["x"] = float(m["you"]["x"]); world.me["z"] = float(m["you"]["z"])
			world.authoritative_position = Vector2(world.me["x"], world.me["z"])
			for p in m["players"]:
				world.upsert_player(p)
			world.objects = m["objects"]
			world.set_npcs(m["npcs"])
			world.set_tiles(m.get("tiles", []))
			garden_phase = int(m.get("garden_phase",0))
			inventory = m.get("inventory", {"seeds":1,"soil":1})
			_refresh_inventory()
			world.clock = m.get("clock", {})
			space_spaces = m.get("spaces", [])
			move_target = null
			chat_log.clear()
			for c in m.get("chat", []):
				_chat_line(c)
			if Profile.nick == "" and m.get("nick", "") != "":
				Profile.nick = m["nick"]
			guide_enabled = m.get("guide") is Dictionary
			guide_button.visible = guide_enabled
			if guide_enabled:
				if guide_pid != str(m["pid"]):
					guide.reset_session()
					guide_pid = str(m["pid"])
				guide.apply_server_state(m["guide"])
			else:
				guide.reset_session()
				guide_pid = ""
			if Profile.has_profile():
				if first_welcome:
					_send_profile()
				_guide_event("welcome")
			else:
				_open_setup()
			_refresh_top()
			toast("来到 " + str(m["space"]["title"]))
			_guide_event("space_entered", m["space"].get("kind", "public"))
		"join":
			world.upsert_player(m["player"])
			_chat_sys("%s 来了" % (m["player"].get("nick", "") if m["player"].get("nick", "") != "" else "一位旅人"))
		"east_bank_job":
			pond_job = str(m.get("job", ""))
		"species_state":
			var pid := str(m["pid"])
			if m["state"] is Dictionary:
				world.species_trials[pid] = m["state"]
			else:
				world.species_trials.erase(pid)
			if m.get("effect", {}).get("kind") == "tongue":
				var effect: Dictionary = m["effect"].duplicate()
				effect["expires"] = Time.get_ticks_msec() + 320
				world.species_effects[pid] = effect
			if pid == world.me_pid:
				fish_pending = 0.0
				move_target = null
		"leave":
			world.species_effects.erase(m["pid"])
			world.species_trials.erase(m["pid"])
			requested_oc.erase(m["pid"])
			if world.players.has(m["pid"]):
				world.players.erase(m["pid"])
				if m.get("reason") != "replaced":
					_chat_sys("%s 离开了" % (m.get("nick", "") if m.get("nick", "") != "" else "一位旅人"))
		"profile":
			if world.players.has(m["pid"]):
				world.players[m["pid"]]["nick"] = m["nick"]
				world.players[m["pid"]]["part_colors"] = m.get("part_colors",{})
				world.players[m["pid"]]["face"] = m.get("face",{})
		"s":
			world.apply_snapshot(m["p"], float(m.get("time", -1.0)))
			if m.get("full", false):
				for r in m["p"]:
					if r[0] != world.me_pid and not world.players.has(r[0]):
						world.upsert_player({"pid": r[0], "x": r[1], "z": r[2], "dir": r[3], "anim": r[4]})
		"correct":
			world.me["x"] = float(m["x"]); world.me["z"] = float(m["z"])
			world.authoritative_position = Vector2(world.me["x"], world.me["z"])
			last_sent = Vector3(world.me["x"], world.me["z"], world.me["dir"])
			print("LABCORRECT " + str(m.get("reason")))
		"chat":
			_chat_line(m)
			if world.players.has(m["pid"]):
				world.players[m["pid"]]["bubble"] = m["text"]
				world.players[m["pid"]]["bubble_until"] = Time.get_ticks_msec() / 1000.0 + 5.0
			elif m["pid"] == world.me_pid:
				world.me["bubble"] = m["text"]
				world.me["bubble_until"] = Time.get_ticks_msec() / 1000.0 + 5.0
		"emote_cancel":
			var target: Dictionary = world.me if m["pid"] == world.me_pid else world.players.get(m["pid"],{})
			target["emote_until"] = 0.0
		"emote":
			if m["pid"] == world.me_pid and m["id"] == pending_action:
				_finish_action()
				_guide_event("emoted")
			var target: Dictionary = world.me if m["pid"] == world.me_pid else world.players.get(m["pid"], {})
			if not target.is_empty():
				target["emote_id"] = m["id"]
				target["emote_started"] = Time.get_ticks_msec() / 1000.0
				target["emote"] = EMOTE_TEXT.get(m["id"], m["id"])
				var motions: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://assets/renmo1/body/animations.json"))
				var duration: float = motions.get(m["id"], {}).get("duration", 2.5)
				if m["id"] in ["walk", "run"]: duration = 2.5
				target["emote_until"] = Time.get_ticks_msec() / 1000.0 + duration
		"oc_changed":
			world.oc_digest[m["pid"]] = m["digest"]
			requested_oc.erase(m["pid"])
		"oc":
			var tx := LabWorld.texture_from_png(Marshalls.base64_to_raw(m["png"]))
			if tx:
				world.textures[m["digest"]] = tx
				world.oc_digest[m["pid"]] = m["digest"]
				requested_oc.erase(m["pid"])
				if m["pid"] == world.me_pid:
					world.my_texture = tx
		"oc_result":
			if m.get("ok"):
				world.oc_digest[world.me_pid] = m["digest"]
				Net.send({"t": "oc_get", "pid": world.me_pid})
				toast("形象已同步给同一空间的玩家")
			else:
				toast("形象没有通过检查：" + str(m.get("reason")))
		"npcs":
			world.set_npcs(m["npcs"])
			world.clock = m.get("clock", world.clock)
			_refresh_top()
		"npc_motion":
			world.apply_npc_motion(m)
		"asset":
			var texture := LabWorld.texture_from_png(Marshalls.base64_to_raw(m.get("png", "")))
			if texture:
				world.art_textures[m["id"]] = texture
			world.requested_art.erase(m["id"])
		"clock":
			world.clock = m["clock"]
			_refresh_top()
		"inventory":
			var previous_phase := garden_phase
			garden_phase = int(m.get("garden_phase",garden_phase))
			if garden_phase > previous_phase and garden_tool == "plant":
				_guide_event("planted")
			inventory = {"seeds":int(m["seeds"]),"soil":int(m["soil"])}
			_refresh_inventory()
		"tile":
			world.set_tile(int(m["x"]), int(m["z"]), bool(m["on"]), str(m.get("kind", "dirt")), str(m.get("by", "")))
		"object":
			world.objects[m["id"]] = m["state"]
			if m["state"].has("rings"):
				world.objects[m["id"]]["_rung_at"] = Time.get_ticks_msec() / 1000.0
		"minigame_open":
			minigames.open(self)
			_guide_event("minigame_opened")
		"guide":
			if guide_enabled:
				guide.apply_server_state(m)
		"board":
			var box := _panel("会馆告示", 480)
			var l := Label.new(); l.text = m["text"]; l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			l.custom_minimum_size = Vector2(0, 0); box.add_child(l)
		"portal", "spaces":
			space_spaces = m["spaces"]
			if m["t"] == "portal" or panel_holder.get_child_count() > 0:
				_render_spaces()
		"space_created":
			space_spaces = m["spaces"]
			toast("灵质空间「%s」已开辟" % m["space"]["title"])
			_render_spaces()
		"invited":
			toast("%s 邀请你去「%s」，到虹之间前往" % [m["from"], m["space"]["title"]], 6)
		"notice":
			if m.get("code") == "access_revoked":
				toast("空间主人收回了访问权限，你回到了会馆", 5)
		"kicked":
			_close_activity()
			if m.get("reason") == "replaced":
				status_label.text = "你在另一个窗口进入了会馆，这里已断开"
				status_label.visible = true
				Net.stopped = true
			elif str(m.get("reason", "")).begins_with("code_") or m.get("reason") == "session_ended":
				if not WebBridge.is_web():
					Net.require_login("会话已过期或测试码已停用，请重新登录")
					return
				status_label.text = "测试码已失效，请重新输入"
				status_label.visible = true
				Net.stopped = true
				await get_tree().create_timer(2.0).timeout
				WebBridge.goto_login()
		"error":
			if m.get("code") in ["emote_while_moving", "crouch_locked"]:
				_finish_action()
			var msgs := {"go_to_rainbow_door": "要在会馆的「虹之间」彩虹门前操作", "space_forbidden": "你没有这个空间的访问权限",
				"too_far": "再走近一点", "chat_rate_limited": "说得太快啦", "space_exists": "你已经有自己的灵质空间了",
				"not_space_owner": "只有空间主人可以调整时间", "tile_too_far": "太远了，走近一点再铺",
				"tile_blocked": "这里不能铺路（房子或水里）", "tile_not_yours": "只能拿掉自己铺的路",
				"tile_rate_limited": "铺得太快啦，歇一下", "tile_limit": "这里的路已经铺满了",
				"no_soil":"没有泥土地块了，可收回自己放的空地块", "no_seeds":"没有蘑菇种子了，可用铲子收回自己种的蘑菇",
				"need_dirt":"先在这里放一块泥土", "plant_occupied":"这格已经种了蘑菇", "no_mushroom":"这格没有可铲的蘑菇",
				"plant_not_yours":"只能铲自己种的蘑菇", "soil_has_mushroom":"先用铲子收回蘑菇，再收泥土", "plant_limit":"这个空间的物件已经满了", "emote_while_moving":"先停下来再做动作", "crouch_locked":"完成种蘑菇→铲回种子→再种蘑菇后解锁下蹲"}
			msgs["outskirts_too_far"] = "请靠近松风径路标再出发"
			msgs["outskirts_use_waypost"] = "只能从路标往返会馆和松风径"
			msgs["outskirts_unavailable"] = "请先结束物种试炼，再用路标"
			msgs["pond_wrong_job"] = "先选对应职业；同一职业再点一次即可卸下"
			msgs["pond_too_far"] = "沿木桥到东岸南侧，靠近荷池圆标"
			msgs["pond_wrong_stage"] = "荷池阶段已变化，请看当前步骤"
			msgs["species_blocked"] = "这里走不了"
			msgs["species_out_of_reach"] = "走近桥头；捕虫要到东岸"
			msgs["species_perch_too_far"] = "靠近任一桥栏端点再落栖"
			toast(msgs.get(m.get("code"), "操作未完成：" + str(m.get("code"))))


func _chat_line(c: Dictionary) -> void:
	chat_log.append_text("%s：%s\n" % [c.get("nick", "旅人"), c.get("text", "")])


func _chat_sys(text: String) -> void:
	chat_log.append_text("· " + text + "\n")


func _send_chat(text: String) -> void:
	text = text.strip_edges()
	if text != "":
		Net.send({"t": "chat", "text": text})
		_guide_event("chatted")
	chat_input.text = ""
	chat_input.release_focus()


func _refresh_top() -> void:
	var c: Dictionary = world.clock
	var time_text := ""
	if c.get("available", false):
		var pops: Dictionary = c.get("populations", {})
		time_text = " · 世界时间 第%d天 %02d:00 · 羊 %d 狼 %d%s" % [int(c.get("day", 1)), int(c.get("hour", 0)),
			int(pops.get("Sheep", 0)), int(pops.get("Wolf", 0)), "（暂停）" if c.get("paused", false) or not c.get("running", true) else ""]
	top_label.text = "%s%s · 在线 %d · %s · %d ms" % [world.space.get("title", "西木会馆"), time_text, world.players.size() + 1,
		"3D 像素" if Profile.view_mode == "3d" else "2D", int(Net.rtt_ms)]


func _build_view_loading() -> void:
	var overlay := CanvasLayer.new()
	overlay.layer = 30
	add_child(overlay)
	view_loading = Control.new()
	view_loading.name = "ViewLoading"
	overlay.add_child(view_loading)
	view_loading.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	view_loading.mouse_filter = Control.MOUSE_FILTER_STOP
	view_loading.theme = theme
	var shade := ColorRect.new()
	shade.color = Color(0.015, 0.027, 0.023, 0.82)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	view_loading.add_child(shade)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var center := CenterContainer.new()
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	view_loading.add_child(center)
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var label := Label.new()
	label.text = "正在切换视角…"
	label.add_theme_color_override("font_color", Color.WHITE)
	label.add_theme_font_size_override("font_size", 24)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	center.add_child(label)
	view_loading.hide()


func _toggle_view() -> void:
	if view_loading.visible:
		return
	move_target = null
	if joystick:
		joystick.hide() # Visibility change releases the captured finger.
	view_loading.show()
	if DisplayServer.get_name() == "headless":
		await get_tree().process_frame
	else:
		# Let the old view + loading overlay render before creating the 3D scene.
		await RenderingServer.frame_post_draw
		await get_tree().process_frame
	Profile.view_mode = "3d" if Profile.view_mode == "2d" else "2d"
	Profile.save_local()
	_apply_view()
	Net.send({"t": "hello_view", "client": Profile.view_mode})
	view_loading.hide()
	_guide_event("view_toggled", Profile.view_mode)


func _apply_view() -> void:
	var use_3d := Profile.view_mode == "3d"
	view2d.activate(not use_3d)
	if use_3d and view3d == null:
		var layer3d := CanvasLayer.new()  # Keep the 2D camera transform out of the 3D picture.
		layer3d.layer = 0
		add_child(layer3d)
		view3d = load("res://scripts/hall3d.gd").new()
		layer3d.add_child(view3d)
		view3d.setup(world, font)
	if view3d:
		view3d.activate(use_3d)
	if top_label:
		_refresh_top()


# ------------------------------------------------------------------ input + prediction
func _input(event: InputEvent) -> void:
	if view_loading and view_loading.visible:
		get_viewport().set_input_as_handled()
		return
	if activity_layer != null:
		return
	if event is InputEventMouseButton and event.pressed and pending_upload:
		pending_upload = false
		_pick_oc(null)


func _travel_outskirts() -> void:
	if world.outskirts.is_empty() or trail_button.disabled:
		return
	move_target = null
	Net.send({"t": "outskirts_travel", "destination": world.outskirts["destination"]})

func _update_trail_hud() -> void:
	trail_hud.visible = not world.outskirts.is_empty()
	if not trail_hud.visible:
		return
	var entry: Array = world.outskirts["entry"]
	var here := Vector2(world.me["x"], world.me["z"])
	var marker := Vector2(entry[0], entry[1])
	var reach := float(world.outskirts["radius"])
	var close_enough := here.distance_to(marker) <= reach and world.authoritative_position.distance_to(marker) <= reach
	trail_button.disabled = not close_enough or not world.local_trial().is_empty()
	var returning: bool = world.outskirts["destination"] == "hall"
	trail_button.text = "返回会馆" if returning else "进入松风径"
	if returning:
		var manifest: Dictionary = world.template.get("generated", {})
		trail_status.text = "松风径 · 沿土径向东到望台，西端路标返回 · 种子%d / 生成v%d" % [int(manifest.get("seed", 0)), int(manifest.get("version", 0))]
	else:
		trail_status.text = "靠近东岸最东侧路标再进入" if not close_enough else "可进入松风径"

func _set_pond_job(job: String) -> void:
	Net.send({"t": "east_bank_job", "job": "" if pond_job == job else job})

func _act_on_pond() -> void:
	var stages := ["survey", "clean", "plant"]
	var phase := world.pond_stage()
	if phase < stages.size():
		Net.send({"t": "east_bank_pond", "action": stages[phase]})

func _update_pond_hud() -> void:
	pond_hud.visible = pond_enabled and world.space.get("id", "") == "hall" and world.template.has("lily_pond")
	if not pond_hud.visible:
		return
	var phase := world.pond_stage()
	var reachable := world.pond_in_range()
	var work := ["巡查标记", "清理淤泥", "补种荷苗", "已修复"]
	var required := "ranger" if phase == 0 else "gardener"
	var selected: String = {"ranger": "巡林员", "gardener": "园艺师"}.get(pond_job, "未选")
	pond_ranger.text = "卸下巡林员" if pond_job == "ranger" else "巡林员"
	pond_gardener.text = "卸下园艺师" if pond_job == "gardener" else "园艺师"
	pond_action.text = work[phase]
	pond_action.disabled = phase == 3 or not reachable or pond_job != required
	var instruction := "过木桥，往东岸南侧找圆标"
	if reachable:
		instruction = ("先选巡林员" if phase == 0 else "先选园艺师") if pond_job != required else ("可" + work[phase])
	pond_status.text = "东岸荷池 %d/3 · %s · %s" % [phase, selected, "大家已修复" if phase == 3 else instruction]

func _fish_near_bank() -> bool:
	if not world.species_enabled or not world.river.has_area():
		return false
	var x: float = world.me["x"]
	var bank := world.river.position.x - x if x <= world.river.position.x else x - world.river.end.x
	return bank >= 0.0 and bank <= 2.4 and absf(float(world.me["z"]) - world.bridge.get_center().y) <= 4.0

func _update_fish_hud() -> void:
	var trial := world.local_trial()
	var active := not trial.is_empty()
	fish_bar.visible = active or _fish_near_bank()
	fish_action.text = "离开试炼" if active else "东岸试游"
	bird_action.visible = not active
	frog_action.visible = not active and world.me["x"] > world.river.end.x
	fish_depth.visible = active
	fish_meter.visible = active
	if active:
		interact_button.hide()
		if trial.get("form") == "bird":
			var flying: bool = trial.get("flight") == "flying"
			fish_depth.text = "落栖" if flying else "起飞"
			fish_depth.disabled = false
			fish_meter.text = ("离地 %.2f 米" % float(trial["y"])) if flying else "栖于桥栏"
			return
		if trial.get("form") == "frog":
			var fed: bool = trial.get("fed", false)
			fish_depth.text = "吐舌" if not fed else "已捕到"
			fish_depth.disabled = fed
			fish_meter.text = "本次练习完成" if fed else "靠近练习飞虫"
			return
		var dive: bool = trial.get("depth") == "dive"
		var z := float(trial["z"])
		var under := z >= world.bridge.position.y - 0.20 and z <= world.bridge.end.y + 0.20
		fish_depth.text = "浮出" if dive else "潜水"
		fish_depth.disabled = dive and under
		fish_meter.text = ("桥下 · " if under else "") + ("水深 0.65 米" if dive else "水面")

func _toggle_fish() -> void:
	move_target = null
	var trial := world.local_trial()
	if trial.is_empty():
		_enter_species("fish")
	else:
		Net.send({"t": "species_exit"})

func _enter_species(form: String) -> void:
	move_target = null
	Net.send({"t": "species_start", "form": form})

func _toggle_fish_depth() -> void:
	var trial := world.local_trial()
	if trial.is_empty() or fish_depth.disabled or fish_pending > 0.0:
		return
	fish_pending = 0.6
	fish_send_timer = 0.0
	if trial.get("form") == "bird":
		Net.send({"t": "species_action", "action": "land" if trial.get("flight") == "flying" else "takeoff"})
		return
	if trial.get("form") == "frog":
		Net.send({"t": "species_action", "action": "tongue"})
		return
	Net.send({"t": "species_move", "x": trial["x"], "z": trial["z"],
		"depth": "surface" if trial["depth"] == "dive" else "dive"})

func _swim_fish(wish: Vector2, delta: float) -> void:
	fish_send_timer += delta
	fish_pending = maxf(0.0, fish_pending - delta)
	if wish.length_squared() < 0.0001 or fish_send_timer < 0.10 or fish_pending > 0.0:
		return
	var trial := world.local_trial()
	var bird: bool = trial.get("form") == "bird"
	var frog: bool = trial.get("form") == "frog"
	if bird and trial.get("flight") != "flying":
		return
	var from := Vector2(trial["x"], trial["z"])
	var step := wish.limit_length() * (2.7 if bird else 1.9) * minf(fish_send_timer, 0.15)
	var nxt := from + step
	if bird:
		nxt.x = clampf(nxt.x, world.river.position.x - 2.5, world.river.end.x + 2.5)
		nxt.y = clampf(nxt.y, world.bridge.position.y - 3.0, world.bridge.end.y + 3.0)
	elif frog:
		nxt.x = clampf(nxt.x, world.river.end.x + 0.35, world.river.end.x + 3.0)
		nxt.y = clampf(nxt.y, world.bridge.position.y - 0.5, world.bridge.end.y + 4.0)
	else:
		nxt.x = clampf(nxt.x, world.river.position.x + 0.35, world.river.end.x - 0.35)
		nxt.y = clampf(nxt.y, world.river.position.y + 0.4, world.river.end.y - 0.4)
	fish_send_timer = 0.0
	if nxt.distance_to(from) < 0.004:
		return
	if trial.get("depth") == "surface" and maxf(nxt.y, from.y) >= world.bridge.position.y - 0.20 and minf(nxt.y, from.y) <= world.bridge.end.y + 0.20:
		return
	fish_pending = 0.6
	Net.send({"t": "species_move", "x": nxt.x, "z": nxt.y})

func _unhandled_input(event: InputEvent) -> void:
	if not welcomed or activity_layer != null:
		return
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ENTER and not chat_input.has_focus():
			chat_input.grab_focus()
			get_viewport().set_input_as_handled()
		elif event.keycode == KEY_SPACE and not world.local_trial().is_empty() and not chat_input.has_focus() and panel_holder.get_child_count() == 0:
			_toggle_fish_depth()
			get_viewport().set_input_as_handled()
		elif event.keycode == KEY_E and near_object != "" and world.local_trial().is_empty():
			_interact()
		elif event.keycode == KEY_R and path_mode:
			_pave_at(Vector2(world.me["x"], world.me["z"]))
		elif event.keycode == KEY_F3:
			get_viewport().set_input_as_handled()
			_toggle_view()

	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT and welcomed and watch_every == 0.0:
		if panel_holder.get_child_count() == 0:
			var p: Vector2 = view2d.screen_to_world(event.position) if Profile.view_mode == "2d" else view3d.screen_to_world(event.position)
			if not world.local_trial().is_empty():
				return  # swim by keyboard or the existing touch joystick
			if path_mode:
				_pave_at(p)
			else:
				move_target = p


func _process(delta: float) -> void:
	_check_action_timeout(Time.get_ticks_msec() / 1000.0)
	var active_color_ids := world.players.keys()
	active_color_ids.append(world.me_pid)
	RenmoColors.release_unused(active_color_ids)
	if chat_panel:
		chat_panel.position.y = maxf(120.0, get_viewport_rect().size.y - chat_panel.size.y - (104.0 if WebBridge.is_web() else 12.0))
	if mobile and chat_panel:
		chat_panel.offset_right = minf(430, get_viewport_rect().size.x - 12)
	if mobile and chat_input:
		WebBridge.chat_rect(chat_input.get_global_rect(), welcomed and chat_panel.visible and panel_holder.get_child_count() == 0, get_viewport_rect().size)
	if joystick:
		joystick.visible = welcomed and not view_loading.visible and panel_holder.get_child_count() == 0 and not chat_panel.visible
	if Time.get_ticks_msec() / 1000.0 > toast_until:
		toast_label.text = ""
	if not welcomed or activity_layer != null:
		fish_bar.hide()
		pond_hud.hide()
		trail_hud.hide()
		return
	_update_fish_hud()
	_update_pond_hud()
	_update_trail_hud()
	for n in world.npc_view.values():
		var aid: String = n.get("asset", "")
		if aid.begins_with("a_") and world.art_texture(aid) == null:
			var now_art := Time.get_ticks_msec() / 1000.0
			if now_art >= float(world.requested_art.get(aid, 0.0)):
				world.requested_art[aid] = now_art + 4.0
				Net.send({"t": "asset_get", "id": aid})
				break
	_run_auto(delta)
	if view_loading.visible:
		world.interpolate()
		return
	var wish := Vector2.ZERO
	if not chat_input.has_focus() and not WebBridge.chat_focused() and panel_holder.get_child_count() == 0:
		wish = Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
		if Input.is_key_pressed(KEY_A): wish.x -= 1
		if Input.is_key_pressed(KEY_D): wish.x += 1
		if Input.is_key_pressed(KEY_W): wish.y -= 1
		if Input.is_key_pressed(KEY_S): wish.y += 1
		if joystick and joystick.visible and joystick.finger != -1:
			move_target = null
			wish = joystick.direction
	if not world.local_trial().is_empty():
		_swim_fish(wish, delta)
		world.interpolate()
		return
	if wish != Vector2.ZERO:
		move_target = null
	elif move_target != null:
		var to: Vector2 = move_target - Vector2(world.me["x"], world.me["z"])
		if to.length() < 0.1:
			move_target = null
		else:
			wish = to
	var moving := wish.length() > 0.01
	if moving: world.me["emote_until"] = 0.0
	for action in action_buttons:
		var locked: bool = action == "crouch" and garden_phase < 3
		action_buttons[action].disabled = moving or locked or pending_action != ""
		if action == "crouch":
			action_buttons[action].text = "下蹲（锁定）" if locked else "下蹲"
			action_buttons[action].tooltip_text = "种蘑菇 → 铲回种子 → 再种蘑菇（%d/3）" % garden_phase if locked else "播放下蹲"
	if moving:
		var running := Input.is_key_pressed(KEY_SHIFT)
		var step := wish.limit_length(1.0) * (6.0 if running else SPEED) * minf(delta, 0.1)
		var from := Vector2(world.me["x"], world.me["z"])
		var nxt := world.step_toward(from, step)
		if nxt == from:
			move_target = null
		_guide_event("moved", from.distance_to(nxt))
		world.me["x"] = nxt.x; world.me["z"] = nxt.y
		world.me["dir"] = atan2(wish.y, wish.x)
		world.me["anim"] = "run" if running else "walk"
	else:
		world.me["anim"] = "idle"
	send_timer += delta
	var cur := Vector3(world.me["x"], world.me["z"], world.me["dir"])
	if send_timer >= 1.0 / SEND_HZ and (cur.distance_to(last_sent) > 0.01 or world.me["anim"] != last_anim):
		send_timer = 0.0
		seq += 1
		last_sent = cur
		last_anim = world.me["anim"]
		Net.send({"t": "move", "x": snappedf(cur.x, 0.001), "z": snappedf(cur.y, 0.001), "dir": snappedf(cur.z, 0.01), "anim": world.me["anim"], "seq": seq})
	world.interpolate()
	var now := Time.get_ticks_msec() / 1000.0
	if Net.state == "open" and now >= next_oc_request_at:
		for pid in world.players:
			var digest = world.oc_digest.get(pid, null)
			var request: Dictionary = requested_oc.get(pid, {})
			if digest != null and not world.textures.has(digest) and (request.get("digest") != digest or now >= float(request.get("retry_at", 0.0))):
				requested_oc[pid] = {"digest": digest, "retry_at": now + maxf(3.0, Net.rtt_ms / 500.0)}
				next_oc_request_at = now + 0.2
				Net.send({"t": "oc_get", "pid": pid})
				break
	var old_near := near_object
	near_object = ""
	var nearest := INF
	for o in world.template.get("objects", []):
		var distance := Vector2(world.me["x"], world.me["z"]).distance_to(Vector2(o["position"][0], o["position"][2]))
		if distance <= float(o["radius"]) and distance < nearest:
			nearest = distance
			near_object = o["id"]
			# On phones the button itself names the object; the hint line would overlap the joystick.
			hint_label.text = "" if mobile else "按 E 或点按钮互动：" + o["name"]
			interact_button.text = "互动 · " + o["name"]
	for n in world.npc_view.values():
		if n.get("kind", "") != "plant": continue
		var distance := Vector2(world.me["x"], world.me["z"]).distance_to(Vector2(n["x"], n["z"]))
		if distance <= 1.6 and distance < nearest:
			nearest = distance
			near_object = n["id"]
			hint_label.text = "" if mobile else "按 E 或点按钮：照料花花"
			interact_button.text = "照料花花"
	if near_object == "":
		hint_label.text = ""
		if path_mode and not mobile:
			hint_label.text = "点附近地面使用工具；R 键用在脚下；点行走退出"
	if path_mode and not mobile and Profile.view_mode == "2d" and panel_holder.get_child_count() == 0:
		view2d.path_cursor = LabWorld.cell_of(view2d.screen_to_world(get_viewport().get_mouse_position()))
	else:
		view2d.path_cursor = null
	interact_button.visible = near_object != "" and panel_holder.get_child_count() == 0
	if near_object != "" and old_near == "":
		_guide_event("near_object", near_object)
	if Engine.get_process_frames() % 30 == 0:
		_refresh_top()


# ------------------------------------------------------------------ scripted input (automated tests)
func _write_test_json(path: String, data: Dictionary) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data))


func _ui_rect(name: String) -> Array:
	var node := find_child(name, true, false)
	if node is Window and node.visible:
		return [node.position.x, node.position.y, node.size.x, node.size.y]
	var control := node as Control
	if control == null or not control.is_visible_in_tree():
		return []
	var rect := control.get_global_rect()
	var ancestor := control.get_parent()
	while ancestor:
		if ancestor is Control and ancestor.clip_contents:
			rect = rect.intersection(ancestor.get_global_rect())
		ancestor = ancestor.get_parent()
	if not rect.has_area():
		return []
	return [rect.position.x, rect.position.y, rect.size.x, rect.size.y]


func _run_auto(delta: float) -> void:
	if local_test_driver and auto_actions.is_empty() and Time.get_ticks_msec() >= next_test_read:
		next_test_read = Time.get_ticks_msec() + 500
		if FileAccess.file_exists(TEST_ACTION_FILE):
			var actions := FileAccess.get_file_as_string(TEST_ACTION_FILE).strip_edges()
			DirAccess.remove_absolute(ProjectSettings.globalize_path(TEST_ACTION_FILE))
			if not actions.is_empty():
				auto_actions = Array(actions.split(";", false))
	if watch_every > 0.0:
		watch_t -= delta
		if watch_t <= 0.0:
			watch_t = watch_every
			auto_actions.push_front("report")
			auto_t = 0.0
	if auto_actions.is_empty():
		return
	auto_t -= delta
	if auto_t > 0:
		return
	var a: String = auto_actions.pop_front()
	var parts := a.split(":")
	match parts[0]:
		"wait": auto_t = float(parts[1])
		"goto": move_target = Vector2(float(parts[1]), float(parts[2])); auto_t = 0.1
		"chat": Net.send({"t": "chat", "text": parts[1].uri_decode()})
		"emote": _request_action(parts[1])
		"interact": Net.send({"t": "interact", "object": parts[1]})
		"pave": _pave_at(Vector2(float(parts[1]) + 0.5, float(parts[2]) + 0.5))
		"path":
			if (parts[1] == "on") != path_mode:
				_toggle_path_mode()
		"button_rect":
			var r := interact_button.get_global_rect()
			print("LABBUTTON " + JSON.stringify({"visible": interact_button.visible, "x": r.position.x, "y": r.position.y,
				"w": r.size.x, "h": r.size.y, "viewport": [get_viewport_rect().size.x, get_viewport_rect().size.y]}))
		"view":
			if parts[1] in ["2d", "3d"] and Profile.view_mode != parts[1]:
				_toggle_view()
		"create": Net.send({"t": "space_create"})
		"enter": Net.send({"t": "space_enter", "space": parts[1]})
		"invite_all":
			for pid in world.players:
				Net.send({"t": "space_invite", "pid": pid})
		"invite", "revoke":
			for pid in world.players:
				if world.players[pid].get("nick") == parts[1]:
					Net.send({"t": "space_invite" if parts[0] == "invite" else "space_revoke", "pid": pid})
		"revoke_guest":
			Net.send({"t": "space_revoke", "pid": parts[1]})
		"enter_invited":
			for s in space_spaces:
				if s["kind"] == "private" and not s.get("mine", false):
					Net.send({"t": "space_enter", "space": s["id"]})
		"enter_mine":
			for s in space_spaces:
				if s.get("mine", false):
					Net.send({"t": "space_enter", "space": s["id"]})
		"nick":
			Profile.nick = parts[1].uri_decode()
			Profile.save_local()
		"upload":
			pending_upload = true        # browsers only open a file chooser right after a real click
		"renmo":
			Profile.use_renmo = true
			Profile.save_local()
			_send_profile()
			_clear_panels()
		"arrive":
			if move_target != null:
				auto_actions.push_front("arrive")
				auto_t = 0.2
		"watch":
			watch_every = float(parts[1]) if parts.size() > 1 else 1.0
		"done":
			_clear_panels()
			_send_profile()
			_guide_event("profile_ready")
		"report":
			var seen := {}
			var controls := {}
			for name in ["Dialog", "AvatarDialog", "NativeNick", "Editor", "UseAvatar", "Enter", "Choice_hair", "Choice_outfit", "Menu_hair", "Menu_outfit", "TouchPad", "Landscape", "ChatToggle", "PathMode"]:
				controls[name] = _ui_rect(name)
			for pid in world.players:
				var p: Dictionary = world.players[pid]
				var texture := world.texture_for(pid)
				seen[pid] = {"nick": p.get("nick", ""), "x": snappedf(p["x"], 0.01), "z": snappedf(p["z"], 0.01),
					"has_oc_texture": texture != null, "texture_size": [texture.get_width(), texture.get_height()] if texture else [],
					"anim": p.get("anim", ""), "emote": p.get("emote_id", "")}
			var report := {"pid": world.me_pid, "space": world.space.get("id", ""),
				"guide": {"enabled": guide_enabled, "status": guide.status, "seen": guide.seen, "showing": guide._current.get("key", "")},
				"me": {"x": snappedf(world.me["x"], 0.01), "z": snappedf(world.me["z"], 0.01)}, "players": seen,
				"view": Profile.view_mode, "npcs": world.npc_view.size(), "npc_assets": world.npc_view, "art_loaded": world.art_textures.keys(), "clock": world.clock,
				"objects": world.objects, "chat": chat_log.get_parsed_text().right(300), "nick": Profile.nick,
				"oc_bytes": Profile.oc_png.size(), "pending_upload": pending_upload, "fps": Engine.get_frames_per_second(), "rtt": Net.rtt_ms,
				"mobile": mobile, "viewport_size": [get_viewport_rect().size.x, get_viewport_rect().size.y],
				"texture_size": [world.my_texture.get_width(), world.my_texture.get_height()] if world.my_texture else [],
				"editor_config": Profile.editor_config, "controls": controls}
			print("LABSTATE " + JSON.stringify(report))
			if local_test_driver:
				_write_test_json("user://lab-state.json", report)


func _refresh_inventory() -> void:
	if inventory_label:
		inventory_label.text = "种子 %d · 泥土 %d  " % [inventory.get("seeds",0),inventory.get("soil",0)]





func _request_action(action: String) -> void:
	if not welcomed or Net.state != "open" or pending_action != "":
		return
	if world.me.get("anim","idle") != "idle":
		toast("先停下来再做动作")
		return
	if action == "crouch" and garden_phase < 3:
		toast("先完成种蘑菇 → 铲回种子 → 再种蘑菇")
		return
	pending_action = action
	pending_action_until = Time.get_ticks_msec() / 1000.0 + ACTION_WAIT_SECONDS
	toast(ACTION_WAIT_TEXT, ACTION_WAIT_SECONDS + 0.2)
	Net.send({"t":"emote","id":action})


func _finish_action() -> void:
	if pending_action == "":
		return
	pending_action = ""
	if toast_label.text == ACTION_WAIT_TEXT:
		toast("", 0.0)


func _check_action_timeout(now: float) -> void:
	if pending_action != "" and now >= pending_action_until:
		_finish_action()
		toast("暂未收到动作确认，可以重试。")


func _open_character_editor(from_setup := false, draft_nick := "", return_to := Callable()) -> void:
	if from_setup:
		return_to = _open_setup.bind(draft_nick)
	var box := _panel("捏人", 900, true, return_to)
	var hint := Label.new()
	hint.text = "① 选部件、换颜色或调整五官。\n② 在「动作试玩」里试走路、跑步和挥手，只在这里预览。\n③ 满意后点「保存并使用」，才会换成你捏的形象。"
	hint.autowrap_mode = TextServer.AUTOWRAP_ARBITRARY
	box.add_child(hint)
	var editor = preload("res://scripts/part_color_editor.gd").new()
	box.add_child(editor)
	editor.setup(Profile.part_colors,mobile or get_viewport_rect().size.x < 760,Profile.face)
	editor.applied.connect(func(colors):
		Profile.part_colors = colors
		Profile.face = editor.face.duplicate()
		Profile.use_renmo = true
		Profile.save_local()
		if welcomed and not Profile.nick.is_empty(): _send_oc()
		_guide_event("character_saved")
		if return_to.is_valid():
			return_to.call()
		else:
			_clear_panels()
		toast("捏人形象已保存"))
	_layout_panel.call_deferred()
