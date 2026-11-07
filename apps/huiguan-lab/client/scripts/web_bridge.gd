extends Node
## Browser integration (file picker, downloads, logout). Desktop builds use FileDialog instead.

signal file_picked(name: String, data: PackedByteArray)
signal orientation_result(ok: bool, detail: String)

var _cb = null
var _orientation_cb = null


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
		return
	var lab = JavaScriptBridge.get_interface("zszmLab")
	if lab == null:
		return
	_cb = JavaScriptBridge.create_callback(_on_picked)
	lab.pick(accept, _cb)


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
