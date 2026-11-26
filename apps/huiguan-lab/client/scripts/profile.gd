extends Node
## Personal data kept only on this device (user:// is IndexedDB in the browser).
## Nickname preference, OC image, avatar-editor config, display settings.
## The server never stores these; it only sees a normalized display copy while you are online.

const FILE := "user://profile.json"
const OC_FILE := "user://oc.png"
var part_colors := {}
var face := {}                 # 动画素体表情 {slot: option}，可选项见 assets/renmo1/variants.json
var use_renmo := true
var nick := ""
var view_mode := "2d"
var oc_source := ""            # "upload" | "editor" | ""
var editor_config := {}
var show_names := true
var oc_png := PackedByteArray()


func _ready() -> void:
	face = _load_face({})
	load_local()


func load_local() -> void:
	if FileAccess.file_exists(FILE):
		var data = JSON.parse_string(FileAccess.get_file_as_string(FILE))
		if typeof(data) == TYPE_DICTIONARY:
			part_colors = data.get("part_colors",{}) if data.get("part_colors",{}) is Dictionary else {}
			face = _load_face(data)
			use_renmo = bool(data.get("use_renmo", data.get("oc_source", "") != "upload"))
			if data.get("oc_source", "") == "editor": use_renmo = true
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
		"editor_config": editor_config, "show_names": show_names, "part_colors":part_colors, "face": face, "use_renmo": use_renmo, "schema": 1}))
	f.close()


func set_oc(png: PackedByteArray, source: String) -> void:
	oc_png = png
	oc_source = source
	use_renmo = source != "upload"
	var f := FileAccess.open(OC_FILE, FileAccess.WRITE)
	f.store_buffer(png)
	f.close()
	save_local()


func has_profile() -> bool:
	return nick != "" and (use_renmo or oc_png.size() > 0)


func export_json() -> String:
	return JSON.stringify({"schema": "zszm-lab-profile/1", "nick": nick, "view_mode": view_mode,
		"oc_source": oc_source, "editor_config": editor_config, "show_names": show_names,
		"part_colors":part_colors, "face": face, "use_renmo": use_renmo, "oc_png": Marshalls.raw_to_base64(oc_png)})


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
	part_colors = data.get("part_colors",{}) if data.get("part_colors",{}) is Dictionary else {}
	face = _load_face(data)
	use_renmo = bool(data.get("use_renmo", oc_source != "upload"))
	if oc_source == "editor": use_renmo = true
	save_local()
	return true


func clear_local() -> void:
	part_colors = {}
	face = _load_face({})
	use_renmo = true
	nick = ""
	oc_source = ""
	editor_config = {}
	oc_png = PackedByteArray()
	if FileAccess.file_exists(OC_FILE):
		DirAccess.remove_absolute(OC_FILE)
	if FileAccess.file_exists(FILE):
		DirAccess.remove_absolute(FILE)


func _load_face(data: Dictionary) -> Dictionary:
	## Older profiles stored only "mouth" (closed/open); keep that choice.
	var anim = preload("res://scripts/renmo_animation.gd")
	var raw = data.get("face", {})
	var f: Dictionary = raw.duplicate() if raw is Dictionary else {}
	if not f.has("mouth") and data.has("mouth"): f["mouth"] = str(data["mouth"])
	return anim.valid_face(f)
