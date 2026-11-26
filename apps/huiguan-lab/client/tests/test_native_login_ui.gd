extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var app := (load("res://scenes/main.tscn") as PackedScene).instantiate()
	root.add_child(app)
	await process_frame
	app.call("_native_login_form", "")
	await process_frame
	await process_frame
	var account := app.find_child("NativeAccountLogin", true, false) as Button
	var toggle := app.find_child("NativeLegacyToggle", true, false) as Button
	var code := app.find_child("NativeCode", true, false) as LineEdit
	var legacy := app.find_child("NativeLogin", true, false) as Button
	var server := app.find_child("NativeServer", true, false) as LineEdit
	if not (account and toggle and code and legacy and server):
		push_error("Missing login controls")
		quit(1)
		return
	if not (account.is_visible_in_tree() and toggle.is_visible_in_tree() and account.get_index() < toggle.get_index() and not code.is_visible_in_tree() and not code.has_focus() and not legacy.is_visible_in_tree() and not server.is_visible_in_tree()):
		push_error("Account-first or initially collapsed contract failed")
		quit(2)
		return
	toggle.button_pressed = true
	await process_frame
	if not (code.is_visible_in_tree() and legacy.is_visible_in_tree() and server.is_visible_in_tree() and code.secret):
		push_error("Legacy expansion contract failed")
		quit(3)
		return
	toggle.button_pressed = false
	await process_frame
	if code.is_visible_in_tree():
		push_error("Legacy re-collapse failed")
		quit(4)
		return
	app.call("_native_login_form", "Retry")
	await process_frame
	var retry := app.find_child("NativeCode", true, false) as LineEdit
	if retry.is_visible_in_tree():
		push_error("Legacy unexpectedly open after login screen rebuild")
		quit(5)
		return
	print("PASS: primary account action first, hidden masked code until expanded, and collapsed after retry")
	quit()
