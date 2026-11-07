extends Control
## Built-in layered OC maker. All parts are drawn procedurally by this script (no third-party art),
## so the output carries no extra licence. Supports non-human bodies (beast, spirit, mouse).
## The result is rendered to a transparent PNG and goes through the same pipeline as an upload.

signal finished(png: PackedByteArray, config: Dictionary)
signal cancelled

const W := 256
const H := 384
const OPTIONS := {
	"body": ["人形", "兽形", "灵体", "小鼠"],
	"ears": ["无", "猫耳", "兔耳", "狐耳", "鹿角"],
	"eyes": ["圆眼", "眯眼", "星眼", "单眼"],
	"hair": ["无", "短发", "长发", "双髻"],
	"outfit": ["长衫", "斗篷", "围巾", "无"],
	"tail": ["无", "狐尾", "猫尾", "灵焰"],
	"accessory": ["无", "花冠", "灯笼", "铃铛"],
	"expression": ["微笑", "平静", "惊讶", "开心"],
}
const COLORS := {"skin": "f3dcc4", "fur": "c98b5a", "hair": "3b2f2a", "outfit": "5f8a55", "accent": "e0b04a", "eye": "2b3a4a"}
var config := {}
var viewport: SubViewport
var canvas: Node2D
var pickers := {}
var font: Font
var saving := false
var scroll: ScrollContainer
var row: BoxContainer
var touch_ui := false


func setup(f: Font, initial: Dictionary, mobile := false) -> void:
	font = f
	touch_ui = mobile
	config = {"body": 0, "ears": 1, "eyes": 0, "hair": 1, "outfit": 0, "tail": 0, "accessory": 0, "expression": 0}
	config["colors"] = COLORS.duplicate()
	for k in OPTIONS:
		if initial.get(k) is int or initial.get(k) is float:
			config[k] = clampi(int(initial[k]), 0, OPTIONS[k].size() - 1)
	var saved_colors: Dictionary = initial.get("colors", {}) if initial.get("colors") is Dictionary else {}
	for k in COLORS:
		# Older profiles stored colors and choices under the same hair/outfit keys.
		var value = saved_colors.get(k, initial.get(k, COLORS[k]))
		if value is String and Color.html_is_valid(value):
			config["colors"][k] = value
	_build()


func _build() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color(0.1, 0.12, 0.1, 0.72)
	add_child(bg)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var center := CenterContainer.new()
	add_child(center)
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var panel := PanelContainer.new()
	panel.name = "AvatarDialog"
	center.add_child(panel)
	scroll = ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	panel.add_child(scroll)
	row = BoxContainer.new()
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_theme_constant_override("separation", 18)
	scroll.add_child(row)
	viewport = SubViewport.new()
	viewport.size = Vector2i(W, H)
	viewport.transparent_bg = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ONCE
	canvas = Node2D.new()
	canvas.draw.connect(_paint)
	viewport.add_child(canvas)
	add_child(viewport)
	var preview_box := VBoxContainer.new()
	row.add_child(preview_box)
	var checker := ColorRect.new()
	checker.color = Color("d9e3cf")
	checker.custom_minimum_size = Vector2(W, H)
	preview_box.add_child(checker)
	var preview := TextureRect.new()
	preview.texture = viewport.get_texture()
	preview.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	preview.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	checker.add_child(preview)
	preview.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var hint := Label.new()
	hint.text = "预览（透明背景）"
	preview_box.add_child(hint)
	var form := VBoxContainer.new()
	form.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(form)
	var title := Label.new()
	title.text = "捏一个 OC"
	title.add_theme_font_size_override("font_size", 22)
	form.add_child(title)
	var grid := GridContainer.new()
	grid.columns = 2
	form.add_child(grid)
	var labels := {"body": "体型", "ears": "耳朵", "eyes": "眼睛", "hair": "头发", "outfit": "衣着", "tail": "尾巴", "accessory": "饰物", "expression": "表情"}
	for k in OPTIONS:
		var l := Label.new(); l.text = labels[k]; grid.add_child(l)
		var ob := OptionButton.new()
		ob.name = "Choice_" + k
		ob.get_popup().name = "Menu_" + k
		if touch_ui:
			ob.custom_minimum_size.y = 40
		for item in OPTIONS[k]:
			ob.add_item(item)
		ob.selected = int(config[k])
		ob.item_selected.connect(func(i): config[k] = i; _redraw_preview())
		grid.add_child(ob)
	var clabels := {"skin": "肤色", "fur": "毛色", "hair": "发色", "outfit": "衣色", "accent": "点缀", "eye": "瞳色"}
	var cgrid := GridContainer.new()
	cgrid.columns = 6
	form.add_child(cgrid)
	for k in COLORS:
		var l := Label.new(); l.text = clabels[k]; cgrid.add_child(l)
		var cp := ColorPickerButton.new()
		cp.color = Color(config["colors"][k])
		cp.custom_minimum_size = Vector2(40, 28)
		cp.edit_alpha = false
		cp.color_changed.connect(func(color): config["colors"][k] = color.to_html(false); _redraw_preview())
		cgrid.add_child(cp)
	var rnd := Button.new(); rnd.text = "随机一个"; rnd.pressed.connect(_randomize); form.add_child(rnd)
	var buttons := HBoxContainer.new()
	form.add_child(buttons)
	var ok := Button.new(); ok.text = "就用这个形象"; ok.name = "UseAvatar"; ok.pressed.connect(_finish); buttons.add_child(ok)
	var cancel := Button.new(); cancel.text = "取消"; cancel.pressed.connect(func(): cancelled.emit()); buttons.add_child(cancel)
	resized.connect(_layout)
	_layout()
	_redraw_preview()


func _layout() -> void:
	var available := get_viewport_rect().size - Vector2(32, 32)
	scroll.custom_minimum_size = Vector2(minf(760, available.x), minf(520, available.y))
	row.vertical = available.x < 700


func _redraw_preview() -> void:
	canvas.queue_redraw()
	viewport.render_target_update_mode = SubViewport.UPDATE_ONCE


func _randomize() -> void:
	for k in OPTIONS:
		config[k] = randi() % OPTIONS[k].size()
	for k in ["fur", "hair", "outfit", "accent"]:
		config["colors"][k] = Color.from_hsv(randf(), randf_range(0.25, 0.6), randf_range(0.45, 0.9)).to_html(false)
	_redraw_preview()


func _finish() -> void:
	if saving:
		return
	saving = true
	_redraw_preview()
	await RenderingServer.frame_post_draw
	var img := viewport.get_texture().get_image()
	finished.emit(img.save_png_to_buffer(), config.duplicate(true))


func c(key: String) -> Color:
	return Color(config["colors"][key])


func _ellipse(center: Vector2, radii: Vector2, color: Color) -> void:
	var pts := PackedVector2Array()
	for i in 28:
		var a := TAU * i / 28.0
		pts.append(center + Vector2(cos(a) * radii.x, sin(a) * radii.y))
	canvas.draw_colored_polygon(pts, color)


func _paint() -> void:
	var body := int(config["body"])
	var skin := c("skin") if body == 0 else c("fur")
	if body == 2:
		skin = Color(c("fur"), 0.85).lightened(0.35)
	var cx := W * 0.5
	var head_y := 120.0 if body != 3 else 170.0
	var head_r := 58.0 if body != 3 else 66.0
	# tail behind
	match int(config["tail"]):
		1:
			canvas.draw_colored_polygon(PackedVector2Array([Vector2(cx + 30, 300), Vector2(cx + 120, 250), Vector2(cx + 110, 200), Vector2(cx + 40, 270)]), c("fur"))
			_ellipse(Vector2(cx + 108, 205), Vector2(18, 14), Color.WHITE)
		2:
			canvas.draw_polyline(PackedVector2Array([Vector2(cx + 30, 310), Vector2(cx + 80, 300), Vector2(cx + 100, 250), Vector2(cx + 90, 215)]), c("fur"), 12.0, true)
		3:
			for i in 3:
				_ellipse(Vector2(cx + 70 + i * 12, 280 - i * 26), Vector2(20 - i * 4, 26 - i * 5), Color(c("accent"), 0.7 - i * 0.15))
	# body
	if body == 2:
		canvas.draw_colored_polygon(PackedVector2Array([Vector2(cx - 50, 200), Vector2(cx + 50, 200), Vector2(cx + 70, 340), Vector2(cx + 30, 320), Vector2(cx, 360), Vector2(cx - 30, 320), Vector2(cx - 70, 340)]), skin)
	elif body == 3:
		_ellipse(Vector2(cx, 300), Vector2(72, 64), skin)
		_ellipse(Vector2(cx, 312), Vector2(44, 40), skin.lightened(0.3))
	else:
		var torso := Rect2(cx - 46, 175, 92, 130) if body == 0 else Rect2(cx - 56, 180, 112, 120)
		canvas.draw_rect(torso, skin)
		canvas.draw_rect(Rect2(cx - 40, 300, 30, 70), skin.darkened(0.1))
		canvas.draw_rect(Rect2(cx + 10, 300, 30, 70), skin.darkened(0.1))
	# outfit
	match int(config["outfit"]):
		0:
			if body != 3:
				canvas.draw_colored_polygon(PackedVector2Array([Vector2(cx - 52, 180), Vector2(cx + 52, 180), Vector2(cx + 70, 340), Vector2(cx - 70, 340)]), c("outfit"))
				canvas.draw_line(Vector2(cx, 182), Vector2(cx, 340), c("outfit").darkened(0.25), 3)
				canvas.draw_rect(Rect2(cx - 54, 250, 108, 12), c("accent"))
		1:
			canvas.draw_colored_polygon(PackedVector2Array([Vector2(cx - 40, 172), Vector2(cx + 40, 172), Vector2(cx + 90, 350), Vector2(cx - 90, 350)]), c("outfit").darkened(0.1))
			_ellipse(Vector2(cx, 178), Vector2(12, 10), c("accent"))
		2:
			canvas.draw_rect(Rect2(cx - 50, 172, 100, 22), c("outfit"))
			canvas.draw_rect(Rect2(cx + 18, 186, 20, 60), c("outfit").darkened(0.15))
	# head + ears
	var ear_color := skin.darkened(0.1)
	match int(config["ears"]):
		1:
			for s in [-1, 1]:
				canvas.draw_colored_polygon(PackedVector2Array([Vector2(cx + s * 22, head_y - 40), Vector2(cx + s * 56, head_y - 92), Vector2(cx + s * 58, head_y - 26)]), ear_color)
		2:
			for s in [-1, 1]:
				_ellipse(Vector2(cx + s * 26, head_y - 86), Vector2(14, 44), ear_color)
				_ellipse(Vector2(cx + s * 26, head_y - 84), Vector2(7, 32), Color("f2b9b9"))
		3:
			for s in [-1, 1]:
				canvas.draw_colored_polygon(PackedVector2Array([Vector2(cx + s * 18, head_y - 44), Vector2(cx + s * 60, head_y - 100), Vector2(cx + s * 62, head_y - 30)]), c("fur"))
				canvas.draw_colored_polygon(PackedVector2Array([Vector2(cx + s * 32, head_y - 44), Vector2(cx + s * 54, head_y - 78), Vector2(cx + s * 54, head_y - 40)]), Color.WHITE)
		4:
			for s in [-1, 1]:
				canvas.draw_polyline(PackedVector2Array([Vector2(cx + s * 24, head_y - 44), Vector2(cx + s * 40, head_y - 96), Vector2(cx + s * 64, head_y - 120)]), Color("8a6a4a"), 7.0, true)
				canvas.draw_line(Vector2(cx + s * 38, head_y - 88), Vector2(cx + s * 60, head_y - 90), Color("8a6a4a"), 6.0)
	if body == 3:
		for s in [-1, 1]:
			_ellipse(Vector2(cx + s * 54, head_y - 54), Vector2(30, 30), skin)
			_ellipse(Vector2(cx + s * 54, head_y - 54), Vector2(18, 18), Color("f2b9b9"))
	_ellipse(Vector2(cx, head_y), Vector2(head_r, head_r * 0.95), skin)
	# hair
	match int(config["hair"]):
		1:
			canvas.draw_colored_polygon(PackedVector2Array([Vector2(cx - head_r, head_y - 4), Vector2(cx - head_r + 6, head_y - 44), Vector2(cx, head_y - head_r - 6), Vector2(cx + head_r - 6, head_y - 44), Vector2(cx + head_r, head_y - 4), Vector2(cx + 30, head_y - 30), Vector2(cx - 20, head_y - 26)]), c("hair"))
		2:
			canvas.draw_colored_polygon(PackedVector2Array([Vector2(cx - head_r - 6, head_y + 110), Vector2(cx - head_r, head_y - 40), Vector2(cx, head_y - head_r - 8), Vector2(cx + head_r, head_y - 40), Vector2(cx + head_r + 6, head_y + 110), Vector2(cx + head_r - 18, head_y - 10), Vector2(cx - head_r + 18, head_y - 10)]), c("hair"))
		3:
			for s in [-1, 1]:
				_ellipse(Vector2(cx + s * 44, head_y - 58), Vector2(22, 22), c("hair"))
			canvas.draw_colored_polygon(PackedVector2Array([Vector2(cx - head_r, head_y - 6), Vector2(cx, head_y - head_r - 4), Vector2(cx + head_r, head_y - 6), Vector2(cx, head_y - 28)]), c("hair"))
	# face
	var eye := c("eye")
	var ey := head_y + 2
	match int(config["eyes"]):
		0:
			for s in [-1, 1]:
				_ellipse(Vector2(cx + s * 20, ey), Vector2(8, 10), eye)
				_ellipse(Vector2(cx + s * 20 - 2, ey - 4), Vector2(3, 3), Color.WHITE)
		1:
			for s in [-1, 1]:
				canvas.draw_arc(Vector2(cx + s * 20, ey + 4), 9, PI * 1.1, PI * 1.9, 10, eye, 3.0)
		2:
			for s in [-1, 1]:
				var p := Vector2(cx + s * 20, ey)
				canvas.draw_colored_polygon(PackedVector2Array([p + Vector2(0, -11), p + Vector2(3, -3), p + Vector2(11, 0), p + Vector2(3, 3), p + Vector2(0, 11), p + Vector2(-3, 3), p + Vector2(-11, 0), p + Vector2(-3, -3)]), eye)
		3:
			_ellipse(Vector2(cx, ey), Vector2(14, 16), eye)
			_ellipse(Vector2(cx - 4, ey - 5), Vector2(4, 4), Color.WHITE)
	match int(config["expression"]):
		0: canvas.draw_arc(Vector2(cx, ey + 20), 10, PI * 0.15, PI * 0.85, 10, Color("8a4a3a"), 3.0)
		1: canvas.draw_line(Vector2(cx - 8, ey + 26), Vector2(cx + 8, ey + 26), Color("8a4a3a"), 3.0)
		2: _ellipse(Vector2(cx, ey + 26), Vector2(6, 8), Color("8a4a3a"))
		3:
			canvas.draw_colored_polygon(PackedVector2Array([Vector2(cx - 12, ey + 20), Vector2(cx + 12, ey + 20), Vector2(cx, ey + 34)]), Color("8a4a3a"))
	for s in [-1, 1]:
		_ellipse(Vector2(cx + s * 36, ey + 16), Vector2(9, 6), Color(1.0, 0.6, 0.6, 0.45))
	# accessory
	match int(config["accessory"]):
		1:
			for i in 7:
				var a := PI + PI * i / 6.0
				_ellipse(Vector2(cx, head_y - 10) + Vector2(cos(a) * head_r * 0.95, sin(a) * head_r * 0.8), Vector2(9, 9), Color.from_hsv(fmod(0.95 + i * 0.07, 1.0), 0.45, 1.0))
		2:
			canvas.draw_line(Vector2(cx - 70, 230), Vector2(cx - 70, 270), Color("6b5338"), 3)
			_ellipse(Vector2(cx - 70, 290), Vector2(18, 24), c("accent"))
			_ellipse(Vector2(cx - 70, 290), Vector2(10, 14), Color(1, 0.95, 0.7))
		3:
			_ellipse(Vector2(cx, 194), Vector2(12, 12), c("accent"))
			canvas.draw_line(Vector2(cx - 4, 200), Vector2(cx + 4, 200), Color("6b5338"), 2)
