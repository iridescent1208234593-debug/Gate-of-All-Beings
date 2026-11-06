extends Node
## Browser integration (file picker, downloads, logout). Desktop builds use FileDialog instead.

signal file_picked(name: String, data: PackedByteArray)

var _cb = null


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
