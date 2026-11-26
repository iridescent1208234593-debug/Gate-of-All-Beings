extends RefCounted
class_name UiTheme
## 统一的视觉样式：圆角、描边、层次与状态反馈。
##
## 全站的圆角与配色只在这里定义，改一处即可让 HUD、面板、按钮、输入框一起变。
## 配色沿用项目既有设计语言（life_guide.gd 的 PAPER / INK / MOSS），
## 保持「深绿底 + 苔绿强调 + 米白文字」，不引入第二种强调色。
##
## Godot 4 的 Theme API 是 set_stylebox(name, type, box)：先状态名，再控件类型。

## 底色与面
const BG_DEEP := Color("131e18")
const BG_PANEL := Color("18251e")
const SURFACE := Color("22332a")
const SURFACE_HI := Color("2b3f34")
const SURFACE_ON := Color("37503f")
const EDGE := Color("35493c")
const EDGE_SOFT := Color("27372e")

## 文字
const TEXT := Color("e8efe9")
const TEXT_DIM := Color("9cb0a3")

## 强调色（苔绿），只用来表示「可操作 / 当前态」
const ACCENT := Color("6fa885")
const ACCENT_SOFT := Color("4d7a5f")

## 圆角尺度：面板 > 按钮 > 细边
const R_PANEL := 14
const R_BTN := 10
const R_PILL := 22


static func _box(bg: Color, radius: int, border := 0, border_color := EDGE) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.corner_radius_top_left = radius
	s.corner_radius_top_right = radius
	s.corner_radius_bottom_left = radius
	s.corner_radius_bottom_right = radius
	s.corner_detail = 10
	s.anti_aliasing = true
	if border > 0:
		s.border_width_left = border
		s.border_width_top = border
		s.border_width_right = border
		s.border_width_bottom = border
		s.border_color = border_color
	return s


## 面板：大圆角、细描边、轻投影，让浮层与场景分开。
static func panel() -> StyleBoxFlat:
	var s := _box(BG_PANEL, R_PANEL, 1, EDGE)
	s.content_margin_left = 20
	s.content_margin_right = 20
	s.content_margin_top = 16
	s.content_margin_bottom = 16
	s.shadow_color = Color(0, 0, 0, 0.45)
	s.shadow_size = 14
	s.shadow_offset = Vector2(0, 6)
	return s


## 顶部菜单条 / 聊天区这类悬浮 HUD：半透明、胶囊圆角。
static func hud_pill(radius := R_PILL) -> StyleBoxFlat:
	var s := _box(Color(BG_PANEL, 0.92), radius, 1, EDGE_SOFT)
	s.content_margin_left = 18
	s.content_margin_right = 10
	s.content_margin_top = 6
	s.content_margin_bottom = 6
	s.shadow_color = Color(0, 0, 0, 0.35)
	s.shadow_size = 10
	s.shadow_offset = Vector2(0, 4)
	return s


## 聊天记录：不要描边，只要一层柔和底色。
static func chat_box() -> StyleBoxFlat:
	var s := _box(Color(BG_DEEP, 0.55), R_BTN)
	s.content_margin_left = 12
	s.content_margin_right = 12
	s.content_margin_top = 8
	s.content_margin_bottom = 8
	return s


## 输入框：常态细边，聚焦时换成强调色。
static func input_box(focused := false) -> StyleBoxFlat:
	var edge := ACCENT if focused else EDGE
	var s := _box(Color(BG_DEEP, 0.72), R_BTN, 1, edge)
	s.content_margin_left = 14
	s.content_margin_right = 14
	s.content_margin_top = 8
	s.content_margin_bottom = 8
	return s


## 一个按钮状态的样式盒。
static func button_box(state: String, radius := R_BTN, pad_x := 14) -> StyleBoxFlat:
	var bg := SURFACE
	var border := 0
	var border_color := EDGE_SOFT
	match state:
		"hover":
			bg = SURFACE_HI
			border = 1
		"pressed":
			bg = SURFACE_ON
			border = 1
			border_color = ACCENT_SOFT
		"disabled":
			bg = Color(SURFACE, 0.4)
	var s := _box(bg, radius, border, border_color)
	s.content_margin_left = pad_x
	s.content_margin_right = pad_x
	s.content_margin_top = 8
	s.content_margin_bottom = 8
	return s


## 构建整套主题。字体从外部传入，不在这里依赖资源路径。
static func make_theme(font: Font) -> Theme:
	var t := Theme.new()
	t.default_font = font
	t.default_font_size = 16

	# 按钮：常态 / 悬停 / 按下 / 禁用
	for state in ["normal", "hover", "pressed", "disabled"]:
		t.set_stylebox(state, "Button", button_box(state))
	# 键盘焦点用强调色描边，不用 outline:none 抹掉可达性
	t.set_stylebox("focus", "Button", _box(Color(0, 0, 0, 0), R_BTN, 2, ACCENT))
	t.set_font_size("font_size", "Button", 16)
	t.set_color("font_color", "Button", TEXT)
	t.set_color("font_hover_color", "Button", Color.WHITE)
	t.set_color("font_pressed_color", "Button", Color.WHITE)
	t.set_color("font_disabled_color", "Button", Color(TEXT_DIM, 0.6))

	# 面板容器
	t.set_stylebox("panel", "PanelContainer", panel())

	# 输入框
	t.set_stylebox("normal", "LineEdit", input_box(false))
	t.set_stylebox("focus", "LineEdit", input_box(true))
	t.set_stylebox("read_only", "LineEdit", input_box(false))
	t.set_color("font_color", "LineEdit", TEXT)
	t.set_color("font_placeholder_color", "LineEdit", Color(TEXT_DIM, 0.8))
	t.set_color("caret_color", "LineEdit", ACCENT)
	t.set_color("selection_color", "LineEdit", Color(ACCENT, 0.35))
	t.set_font_size("font_size", "LineEdit", 16)

	# 聊天记录
	t.set_stylebox("normal", "RichTextLabel", chat_box())
	t.set_color("default_color", "RichTextLabel", TEXT)

	# 滚动条：细、低对比，不抢视线
	var grabber := _box(Color(TEXT_DIM, 0.35), 4)
	grabber.content_margin_left = 3
	grabber.content_margin_right = 3
	t.set_stylebox("grabber", "VScrollBar", grabber)
	t.set_stylebox("grabber_highlight", "VScrollBar", _box(Color(ACCENT, 0.6), 4))
	t.set_stylebox("grabber_pressed", "VScrollBar", _box(ACCENT, 4))
	t.set_stylebox("scroll", "VScrollBar", _box(Color(0, 0, 0, 0.18), 4))

	# 勾选框
	t.set_color("font_color", "CheckBox", TEXT)
	t.set_color("font_hover_color", "CheckBox", Color.WHITE)

	# 进度条
	t.set_stylebox("background", "ProgressBar", _box(Color(BG_DEEP, 0.8), 6))
	t.set_stylebox("fill", "ProgressBar", _box(ACCENT, 6))

	# 标签
	t.set_color("font_color", "Label", TEXT)

	return t
