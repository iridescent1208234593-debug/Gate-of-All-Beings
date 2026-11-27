extends SceneTree

var failed := false

func _initialize() -> void:
	call_deferred("_run")

func _check(ok: bool, detail: String) -> void:
	if not ok:
		failed = true
		push_error(detail)

func _run() -> void:
	var app := (load("res://scenes/main.tscn") as PackedScene).instantiate()
	var profile := root.get_node("Profile")
	var image := Image.create(4, 4, false, Image.FORMAT_RGBA8)
	image.fill(Color.PINK)
	var original := image.save_png_to_buffer()
	profile.set_oc(original, "upload")
	profile.nick = ""
	root.add_child(app)
	await process_frame
	app.guide_enabled = true
	var guide = app.guide
	var updates: Array = []
	guide.send = func(message): updates.append(message)
	app._open_setup()
	var nick := app.find_child("Nick", true, false) as LineEdit
	nick.text = "新来的馆友"
	var setup_entry := app.find_child("Renmo", true, false) as Button
	_check(setup_entry.text == "捏人", "Setup entry should be named 捏人")
	setup_entry.pressed.emit()
	var motion := app.find_child("PreviewMotion", true, false) as OptionButton
	var editor := motion.get_parent().get_parent().get_parent().get_parent()
	_check(motion.get_item_text(0) == "待机", "Action labels should be localized")
	var wave_index := -1
	for i in range(motion.item_count):
		if motion.get_item_metadata(i) == "wave": wave_index = i
	_check(wave_index >= 0 and motion.get_item_text(wave_index) == "挥手", "Missing playable wave")
	motion.select(wave_index)
	motion.item_selected.emit(wave_index)
	_check(editor.preview.animation._pick(editor.pose, 0.0)[0] == "wave", "Wave is not playing in the avatar preview")
	await create_timer(0.12).timeout
	(app.find_child("ReplayMotion", true, false) as Button).pressed.emit()
	_check(editor.preview.animation._pick(editor.pose, 0.0) == ["wave", 0], "Replay did not restart from the first frame")
	_check(not profile.use_renmo and guide.seen.is_empty(), "Preview alone should not change OC or guide progress")
	(app.find_child("PartColorWheel", true, false) as ColorPicker).color_changed.emit(Color.BLUE)
	(app.find_child("SavePartColors", true, false) as Button).pressed.emit()
	_check(profile.use_renmo and profile.part_colors.values().has("0000ff"), "Saving did not apply the chosen color")
	_check(profile.oc_png == original, "Saving should preserve the uploaded OC for restoration")
	_check(app.find_child("Nick", true, false).text == "新来的馆友", "Setup nickname draft was lost")
	_check("character" in guide.seen and updates.back().seen == ["character"], "Saving did not record the guide step")
	(app.find_child("RestoreUploadedOC", true, false) as Button).pressed.emit()
	_check(not profile.use_renmo and profile.oc_png == original, "Restoring uploaded OC failed")
	guide.reset_session()
	guide.on_event("welcome")
	await create_timer(0.86).timeout
	_check(guide._current.get("key") == "character", "New-player guide should prompt for character setup")
	guide._primary.pressed.emit()
	_check(not profile.use_renmo and "character" in guide.seen, "Keeping the existing avatar should complete only the lesson")
	app.mobile = true
	app._open_guide()
	(app.find_child("GuideCharacterEditor", true, false) as Button).pressed.emit()
	_check(app.find_child("ReplayMotion", true, false) != null, "Tutorial should open the same touch-friendly action preview")
	var close := app.find_child("Dialog", true, false).get_child(0).get_child(0).get_child(0).get_child(1) as Button
	close.pressed.emit()
	_check(app.find_child("GuideCharacterEditor", true, false) != null, "Closing the tutorial should return to the guide menu")
	if not failed: print("PASS: unified character editor, localized motion replay, save/restore, onboarding and touch branch")
	quit(1 if failed else 0)
