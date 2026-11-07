extends SceneTree
## Run with Godot --headless --path client --script ../server/tests/client_regression.gd.

const Editor = preload("res://scripts/avatar_editor.gd")
const Joystick = preload("res://scripts/touch_joystick.gd")


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	root.size = Vector2i(1280, 720)
	await process_frame
	var image := Image.create(400, 300, false, Image.FORMAT_RGBA8)
	image.fill(Color.TRANSPARENT)
	image.fill_rect(Rect2i(160, 50, 80, 200), Color.WHITE)
	var texture := LabWorld.texture_from_png(image.save_png_to_buffer())
	assert(texture.get_size() == Vector2(80, 200), "Local OC must trim transparent margins")
	var large := Image.create(1000, 800, false, Image.FORMAT_RGBA8)
	large.fill(Color.WHITE)
	assert(LabWorld.texture_from_png(large.save_png_to_buffer()).get_size() == Vector2(512, 410))

	var editor := Editor.new()
	root.add_child(editor)
	editor.setup(null, {"hair": "123456", "outfit": "abcdef", "body": 3})
	assert(editor.config["hair"] is int and editor.config["outfit"] is int)
	assert(editor.config["colors"]["hair"] == "123456")
	assert(editor.config["colors"]["outfit"] == "abcdef")
	editor.find_child("Choice_hair", true, false).item_selected.emit(2)
	editor.find_child("Choice_outfit", true, false).item_selected.emit(1)
	editor.config["colors"]["hair"] = "112233"
	assert(editor.c("hair") == Color("112233"))
	assert(editor.config["hair"] == 2 and editor.config["outfit"] == 1)
	await process_frame
	await process_frame
	var center := editor.get_child(1) as CenterContainer
	var panel := center.get_child(0) as Control
	print("desktop layout ", panel.get_global_rect(), " viewport ", root.get_visible_rect(), " editor ", editor.size, " center ", center.size)
	assert(panel.get_global_rect().get_center().distance_to(root.get_visible_rect().get_center()) < 2)
	root.size = Vector2i(390, 844)
	await process_frame
	await process_frame
	print("portrait layout ", panel.get_global_rect(), " viewport ", root.get_visible_rect(), " editor ", editor.size)
	assert(panel.get_global_rect().get_center().distance_to(root.get_visible_rect().get_center()) < 2)
	assert(panel.size.x <= root.size.x - 20, "Portrait editor must fit the viewport")
	var saved := editor.config.duplicate(true)
	editor.queue_free()
	await process_frame
	editor = Editor.new()
	root.add_child(editor)
	editor.setup(null, saved)
	assert(editor.config["hair"] == 2 and editor.config["colors"]["hair"] == "112233")
	editor._randomize()
	assert(editor.config["hair"] is int and editor.config["outfit"] is int)
	assert(editor.config["colors"]["hair"] is String)
	editor.queue_free()

	var pad := Joystick.new()
	root.add_child(pad)
	pad.position = Vector2(16, 600)
	pad.size = Vector2(140, 140)
	var touch := InputEventScreenTouch.new()
	touch.index = 2
	touch.pressed = true
	touch.position = pad.global_position + pad.size * 0.5 + Vector2(60, 0)
	pad._input(touch)
	assert(pad.direction.is_equal_approx(Vector2.RIGHT))
	var drag := InputEventScreenDrag.new()
	drag.index = 2
	drag.position = Vector2(1000, 200)
	pad._input(drag)
	assert(pad.direction.length() <= 1.001)
	touch.index = 3
	touch.pressed = false
	pad._input(touch)
	assert(pad.direction != Vector2.ZERO, "A second finger must not release movement")
	touch.index = 2
	pad._input(touch)
	assert(pad.direction == Vector2.ZERO)
	touch.pressed = true
	pad._input(touch)
	pad.hide()
	assert(pad.direction == Vector2.ZERO, "Hiding a pad must release movement")
	pad.queue_free()
	await process_frame
	print("PASS client regressions: OC size, editor migration/layout/colors, joystick capture/release")
	quit(0)
