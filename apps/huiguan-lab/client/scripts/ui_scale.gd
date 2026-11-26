extends Node
## 屏幕适配：虚拟分辨率、刘海/圆角安全区、触控尺寸。
##
## 电脑版按 1280×720 设计；手机上同一份 HUD 会显得很小，所以这里把「虚拟分辨率」
## 换成更小的基准，让界面元素在物理像素上占得更大，同时把安全区（挖孔屏、圆角）
## 换算成虚拟坐标，交给 HUD 当边距用。
##
## 用法：
##   UiScale.touch          当前是否为触屏设备
##   UiScale.insets         Vector4(left, top, right, bottom)，单位为虚拟像素
##   UiScale.min_touch      触控最小点击尺寸（虚拟像素）
##   UiScale.changed        安全区或方向变化时发出，HUD 重新排版

signal changed

## 手机横屏/竖屏的虚拟分辨率。比 1280×720 小，等于把 UI 放大。
const BASE_LANDSCAPE := Vector2i(1024, 576)
const BASE_PORTRAIT := Vector2i(576, 1024)
## 电脑端保持原设计基准，不改观感。
const BASE_DESKTOP := Vector2i(1280, 720)

var touch := false
var insets := Vector4.ZERO          ## left, top, right, bottom（虚拟像素）
var min_touch := 44

var _last_size := Vector2i.ZERO
var _last_orientation := -1


func _ready() -> void:
	# 「mobile」feature 在 Android/iOS 导出时存在；触屏也可由 DisplayServer 报出。
	touch = OS.has_feature("mobile") or DisplayServer.is_touchscreen_available()
	min_touch = 44 if touch else 38
	get_window().size_changed.connect(_on_size_changed)
	apply()


func _on_size_changed() -> void:
	var size := get_window().size
	var orientation := 1 if size.x >= size.y else 0
	# 方向真的变了才重设基准；纯窗口拉伸只更新安全区，避免画面跳变。
	if size != _last_size or orientation != _last_orientation:
		_last_size = size
		_last_orientation = orientation
		apply()
	else:
		_refresh_insets()


func apply() -> void:
	var win := get_window()
	var size := win.size
	if size.x <= 0 or size.y <= 0:
		return
	_last_size = size
	_last_orientation = 1 if size.x >= size.y else 0
	var base := _base_for(size)
	win.content_scale_mode = Window.CONTENT_SCALE_MODE_CANVAS_ITEMS
	win.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
	win.content_scale_size = base
	_refresh_insets()
	changed.emit()


func _base_for(size: Vector2i) -> Vector2i:
	if not touch:
		return BASE_DESKTOP
	return BASE_LANDSCAPE if size.x >= size.y else BASE_PORTRAIT


## 把物理屏幕的安全区换算成虚拟坐标下的四边留白。
func _refresh_insets() -> void:
	if not touch:
		insets = Vector4.ZERO
		return
	var win := get_window()
	var win_size := win.size
	var safe := DisplayServer.get_display_safe_area()
	# 桌面或取不到时返回零矩形，此时不裁切。
	if safe.size.x <= 0 or safe.size.y <= 0:
		insets = Vector4.ZERO
		return
	# 窗口可能只占屏幕一部分（分屏、桌面窗口），按窗口在屏幕上的位置平移。
	var screen_pos := DisplayServer.screen_get_position(DisplayServer.window_get_current_screen())
	var local_x := safe.position.x - screen_pos.x
	var local_y := safe.position.y - screen_pos.y
	if local_x <= 0 and local_y <= 0 and safe.size == win_size:
		# 已经是整屏且无缺口
		insets = Vector4.ZERO
		return
	var base := _base_for(win_size)
	var scale := minf(float(win_size.x) / float(base.x), float(win_size.y) / float(base.y))
	if scale <= 0.0:
		insets = Vector4.ZERO
		return
	var left := maxf(0.0, float(local_x) / scale)
	var top := maxf(0.0, float(local_y) / scale)
	var right := maxf(0.0, float(win_size.x - (local_x + safe.size.x)) / scale)
	var bottom := maxf(0.0, float(win_size.y - (local_y + safe.size.y)) / scale)
	# 圆角与状态栏：即使系统报 0，触屏上也留一点余量，避免文字贴边。
	var slack := 8.0 if touch else 0.0
	insets = Vector4(maxf(left, slack), maxf(top, slack), maxf(right, slack), maxf(bottom, slack))


## 视口尺寸（虚拟像素），HUD 排版用。
func view_size() -> Vector2:
	return get_viewport().get_visible_rect().size
