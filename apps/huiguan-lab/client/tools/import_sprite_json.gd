extends SceneTree
## Run with Godot --headless --editor --script ... -- metadata.json sheet.png output.res
## Uses the pinned upstream creator; no Aseprite executable needed for already exported sheets.

func _initialize() -> void:
	call_deferred("convert")

func convert() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() != 3:
		push_error("Expected metadata.json sheet.png output.res")
		quit(1)
		return
	var data = JSON.parse_string(FileAccess.get_file_as_string(args[0]))
	if not data is Dictionary or not data.get("frames") is Array or data.frames.is_empty():
		push_error("Expected Aseprite JSON-array export with frames")
		quit(1)
		return
	var image := Image.load_from_file(args[1])
	if image == null or image.is_empty():
		quit(1)
		return
	for frame in data.frames:
		if not frame is Dictionary or not frame.get("frame") is Dictionary:
			push_error("Frame must contain a rectangle")
			quit(1)
			return
		var rect: Dictionary = frame.get("frame", {})
		if float(frame.get("duration", 0)) <= 0 or bool(frame.get("trimmed", false)) or bool(frame.get("rotated", false)) or not Rect2(Vector2.ZERO, image.get_size()).encloses(Rect2(rect.get("x", -1), rect.get("y", -1), rect.get("w", 0), rect.get("h", 0))) or int(rect.get("w", 0)) <= 0 or int(rect.get("h", 0)) <= 0:
			push_error("Invalid frame duration/rectangle; use untrimmed, unrotated exports")
			quit(1)
			return
	var creator = load("res://addons/AsepriteWizard/creators/sprite_frames/sprite_frames_creator.gd").new()
	var result: Dictionary = creator.create_resources([{"data_file":args[0], "sprite_sheet":args[1]}], {"should_create_portable_texture":true, "should_round_fps":false})
	if not result.is_ok:
		push_error(str(result))
		quit(1)
		return
	var frames: SpriteFrames = result.content[0].resource
	if ResourceSaver.save(frames, args[2]) != OK:
		quit(1)
		return
	print("IMPORTED ", args[2], " animations=", frames.get_animation_names())
	quit(0)
