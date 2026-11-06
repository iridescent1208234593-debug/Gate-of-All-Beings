extends Node
## Personal data kept only on this device (user:// is IndexedDB in the browser).
## Nickname preference, OC image, avatar-editor config, display settings.
## The server never stores these; it only sees a normalized display copy while you are online.

const FILE := "user://profile.json"
const OC_FILE := "user://oc.png"
var nick := ""
var view_mode := "2d"
var oc_source := ""            # "upload" | "editor" | ""
var editor_config := {}
var show_names := true
var oc_png := PackedByteArray()


func _ready() -> void:
	load_local()


func load_local() -> void:
	if FileAccess.file_exists(FILE):
		var data = JSON.parse_string(FileAccess.get_file_as_string(FILE))
		if typeof(data) == TYPE_DICTIONARY:
			nick = str(data.get("nick", ""))
			view_mode = "3d" if data.get("view_mode", "2d") == "3d" else "2d"
			oc_source = str(data.get("oc_source", ""))
			editor_config = data.get("editor_config", {}) if typeof(data.get("editor_config", {})) == TYPE_DICTIONARY else {}
			show_names = bool(data.get("show_names", true))
	if FileAccess.file_exists(OC_FILE):
		oc_png = FileAccess.get_file_as_bytes(OC_FILE)
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--lab-view="):
			view_mode = arg.trim_prefix("--lab-view=")


func save_local() -> void:
	var f := FileAccess.open(FILE, FileAccess.WRITE)
	f.store_string(JSON.stringify({"nick": nick, "view_mode": view_mode, "oc_source": oc_source,
		"editor_config": editor_config, "show_names": show_names, "schema": 1}))
	f.close()


func set_oc(png: PackedByteArray, source: String) -> void:
	oc_png = png
	oc_source = source
	var f := FileAccess.open(OC_FILE, FileAccess.WRITE)
	f.store_buffer(png)
	f.close()
	save_local()


func has_profile() -> bool:
	return nick != "" and oc_png.size() > 0


func export_json() -> String:
	return JSON.stringify({"schema": "zszm-lab-profile/1", "nick": nick, "view_mode": view_mode,
		"oc_source": oc_source, "editor_config": editor_config, "show_names": show_names,
		"oc_png": Marshalls.raw_to_base64(oc_png)})


func import_json(text: String) -> bool:
	var data = JSON.parse_string(text)
	if typeof(data) != TYPE_DICTIONARY or data.get("schema") != "zszm-lab-profile/1":
		return false
	nick = str(data.get("nick", "")).substr(0, 16)
	view_mode = "3d" if data.get("view_mode") == "3d" else "2d"
	editor_config = data.get("editor_config", {}) if typeof(data.get("editor_config")) == TYPE_DICTIONARY else {}
	show_names = bool(data.get("show_names", true))
	var png := Marshalls.base64_to_raw(str(data.get("oc_png", "")))
	if png.size() > 0:
		set_oc(png, str(data.get("oc_source", "upload")))
	save_local()
	return true


func clear_local() -> void:
	nick = ""
	oc_source = ""
	editor_config = {}
	oc_png = PackedByteArray()
	if FileAccess.file_exists(OC_FILE):
		DirAccess.remove_absolute(OC_FILE)
	if FileAccess.file_exists(FILE):
		DirAccess.remove_absolute(FILE)
