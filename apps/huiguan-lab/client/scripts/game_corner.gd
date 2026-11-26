extends Control
## LAB lobby catalog. Website destinations are generated offline from the shared registries.

signal shoot_requested
signal closed

const DATA := "res://data/web_games.json"
const ROUTES := "res://data/web_game_routes.json"
const PAPER := Color("f9ecd3")
const MUTED := Color("b3c9c0")
const GOLD := Color("ffd99b")
const PANEL := Color("1e3738")

var can_play := false
var center: CenterContainer
var panel_body: VBoxContainer
var feedback: Label


func _ready() -> void:
	var shade := ColorRect.new()
	shade.color = Color(0.02, 0.045, 0.05, 0.74)
	add_child(shade)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var placement := MarginContainer.new()
	add_child(placement)
	placement.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		placement.add_theme_constant_override("margin_" + side, 12)
	center = CenterContainer.new()
	placement.add_child(center)
	var panel := PanelContainer.new()
	center.add_child(panel)
	var style := StyleBoxFlat.new()
	style.bg_color = PANEL
	style.border_color = Color("587671")
	style.set_border_width_all(1)
	style.set_corner_radius_all(10)
	style.set_content_margin_all(14)
	panel.add_theme_stylebox_override("panel", style)
	panel_body = VBoxContainer.new()
	panel_body.add_theme_constant_override("separation", 8)
	panel.add_child(panel_body)
	var header := HBoxContainer.new()
	panel_body.add_child(header)
	var heading := _label("会馆小游戏", 22, GOLD)
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(heading)
	header.add_child(_button("关闭", _close))
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel_body.add_child(scroll)
	var list := VBoxContainer.new()
	list.mouse_filter = Control.MOUSE_FILTER_PASS
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 6)
	scroll.add_child(list)
	var native := _button("省省海滩射击 · 在 LAB 游玩", func(): shoot_requested.emit())
	native.name = "PlayBeachShoot"
	native.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	native.disabled = not can_play
	list.add_child(native)
	list.add_child(_label("三波守滩，可在波间选加成；成绩只留在这台设备。", 14, MUTED))
	var data = JSON.parse_string(FileAccess.get_file_as_string(ROUTES))
	var web_games: Dictionary = data if data is Dictionary else {}
	var rows = JSON.parse_string(FileAccess.get_file_as_string(DATA))
	if rows is Array:
		for group: Dictionary in rows:
			list.add_child(HSeparator.new())
			list.add_child(_label(group.title, 16, GOLD))
			for entry: Dictionary in group.entries:
				var url := website_url(web_games.get(entry.key))
				var button := _button(entry.title + " · 网页", _open_web.bind(url))
				button.name = "WebGame_" + str(entry.key)
				button.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
				button.disabled = url.is_empty()
				list.add_child(button)
				list.add_child(_label(entry.hint, 13, MUTED))
	feedback = _label("网页条目会另开浏览器，使用对应站点自己的进度。" if not web_games.is_empty() else "当前构建未包含网页入口；LAB 内的玩法不受影响。", 13, MUTED)
	panel_body.add_child(feedback)
	resized.connect(_fit)
	_fit()


func _fit() -> void:
	panel_body.custom_minimum_size = Vector2(clampf(size.x - 64.0, 195.0, 480.0), clampf(size.y - 54.0, 140.0, 575.0))


func _label(text: String, font_size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	return label


func _button(text: String, action: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size.y = 44
	button.add_theme_font_size_override("font_size", 15)
	button.add_theme_color_override("font_color", PAPER)
	button.pressed.connect(action)
	return button


static func website_url(route: Variant) -> String:
	if not route is Dictionary:
		return ""
	var host := str(route.get("host", ""))
	var path := str(route.get("path", ""))
	var host_pattern := RegEx.create_from_string("^[a-z0-9.-]+$")
	if host.is_empty() or not host_pattern.search(host) or not path.begins_with("/") or path.begins_with("//"):
		return ""
	if path.contains("?") or path.contains("\\") or path.contains("\n") or path.contains("\r"):
		return ""
	return "https://" + host + path


func _open_web(url: String) -> void:
	if OS.has_feature("web"):
		var bridge = JavaScriptBridge.get_interface("zszmLab")
		if bridge != null and bridge.openPublicPage(url):
			feedback.text = "如果没有出现新标签，请允许此页打开弹窗后重试。"
		else:
			feedback.text = "当前网页未能打开门牌，请更新 LAB 网页包后重试。"
	elif OS.shell_open(url) != OK:
		feedback.text = "浏览器没有打开，请检查设备的默认浏览器设置。"


func _unhandled_key_input(event: InputEvent) -> void:
	if is_visible_in_tree() and event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		_close()
		get_viewport().set_input_as_handled()


func _close() -> void:
	closed.emit()
