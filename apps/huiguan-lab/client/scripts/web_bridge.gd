extends Node
## Browser integration (file picker, downloads, logout). Desktop builds use FileDialog instead.

signal file_picked(name: String, data: PackedByteArray)
signal file_error(detail: String)
signal orientation_result(ok: bool, detail: String)
signal chat_submitted(text: String)

var _cb = null
var _orientation_cb = null
var _chat_cb = null


func chat_rect(rect: Rect2, show_input: bool, viewport: Vector2) -> void:
	if is_web():
		var lab = JavaScriptBridge.get_interface("zszmLab")
		if lab:
			if _chat_cb == null:
				_chat_cb = JavaScriptBridge.create_callback(func(args):
					if args.size() > 0: chat_submitted.emit(str(args[0])))
			var css := Vector2(viewport_size()) / viewport
			lab.chatRect(rect.position.x * css.x, rect.position.y * css.y, rect.size.x * css.x, rect.size.y * css.y, show_input, _chat_cb)


func chat_focused() -> bool:
	if is_web():
		var lab = JavaScriptBridge.get_interface("zszmLab")
		return lab != null and bool(lab.chatFocused())
	return false


func is_mobile() -> bool:
	if is_web():
		var lab = JavaScriptBridge.get_interface("zszmLab")
		return lab != null and bool(lab.isMobile())
	return OS.has_feature("android") or OS.has_feature("ios")


func viewport_size() -> Vector2i:
	if is_web():
		var browser = JavaScriptBridge.get_interface("window")
		return Vector2i(int(browser.innerWidth), int(browser.innerHeight))
	return get_window().size


func prompt_text(title: String, initial: String):
	if is_web():
		var lab = JavaScriptBridge.get_interface("zszmLab")
		if lab:
			return lab.promptText(title, initial)
	return null


func landscape() -> void:
	if is_web():
		var lab = JavaScriptBridge.get_interface("zszmLab")
		if lab:
			_orientation_cb = JavaScriptBridge.create_callback(_on_orientation)
			lab.landscape(_orientation_cb)


func _on_orientation(args: Array) -> void:
	if args.size() >= 2:
		orientation_result.emit(bool(args[0]), str(args[1]))


func is_web() -> bool:
	return OS.has_feature("web")


func pick_file(accept: String) -> void:
	if not is_web():
		var dialog := FileDialog.new()
		dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
		dialog.access = FileDialog.ACCESS_FILESYSTEM
		dialog.use_native_dialog = true
		if accept.contains(".json"):
			dialog.add_filter("*.json", "LAB 数据", "application/json")
		else:
			dialog.add_filter("*.png,*.jpg,*.jpeg,*.webp", "OC 图片", "image/*")
		add_child(dialog)
		dialog.file_selected.connect(func(path: String):
			_read_native_file(path, accept.contains(".json"))
			dialog.queue_free())
		dialog.canceled.connect(dialog.queue_free)
		dialog.popup_file_dialog()
		return
	var lab = JavaScriptBridge.get_interface("zszmLab")
	if lab == null:
		return
	_cb = JavaScriptBridge.create_callback(_on_picked)
	lab.pick(accept, _cb)


func _read_native_file(path: String, profile: bool) -> void:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		file_error.emit("无法读取所选文件")
		return
	var size := file.get_length()
	var limit := 12 * 1024 * 1024 if profile else 8 * 1024 * 1024
	if size <= 0 or size > limit:
		file_error.emit("文件为空或超过大小限制")
		return
	file_picked.emit("profile.json" if profile else path.get_file(), file.get_buffer(size))


func _on_picked(args: Array) -> void:
	if args.size() < 3:
		return
	file_picked.emit(str(args[0]), Marshalls.base64_to_raw(str(args[2])))


func download_text(filename: String, text: String) -> void:
	if is_web():
		JavaScriptBridge.download_buffer(text.to_utf8_buffer(), filename, "application/json")
	else:
		var f := FileAccess.open("user://" + filename, FileAccess.WRITE)
		f.store_string(text)
		f.close()


func logout() -> void:
	if is_web():
		var lab = JavaScriptBridge.get_interface("zszmLab")
		if lab:
			lab.logout()
	else:
		get_tree().quit()


func goto_login() -> void:
	if is_web():
		var lab = JavaScriptBridge.get_interface("zszmLab")
		if lab:
			lab.gotoLogin()
