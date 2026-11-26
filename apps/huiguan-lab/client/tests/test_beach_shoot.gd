extends SceneTree
## godot --headless --path <client> --script res://tests/test_beach_shoot.gd

const Rules = preload("res://scripts/beach_shoot_run.gd")
const Game = preload("res://scenes/beach_shoot.tscn")
const Corner = preload("res://scripts/game_corner.gd")
const DT := 1.0 / 60.0
var failures := 0


func _initialize() -> void:
	_run_tests.call_deferred()


func _check(condition: bool, description: String) -> void:
	if not condition:
		failures += 1
		printerr("FAIL: " + description)


func _run_tests() -> void:
	_test_move_and_fire()
	_test_defense_damage()
	_test_surge()
	_test_waves()
	_test_links()
	await _test_corner()
	await _test_scene()
	await _test_hall_entry()
	if failures == 0:
		print("Beach shooting: all checks passed")
	quit(0 if failures == 0 else 1)


func _test_move_and_fire() -> void:
	var run := Rules.new(8)
	run.step(DT, Vector2.DOWN, false)
	_check(run.elapsed == 0.0 and run.player == Rules.START, "ready screen does not advance the run")
	run.begin()
	run.enemies.append(Rules._enemy("tide", run.player + Vector2(120, 0)))
	run.enemies[0].warning = 0.0
	run.step(DT, Vector2.DOWN, false)
	_check(run.player.y > Rules.START.y and run.shots.size() == 1, "walking and shooting are simultaneous")
	var start := run.player
	run.shot_left = 0.0
	run.shots.clear()
	run.step(DT, Vector2.DOWN, true)
	_check(run.player == start and run.shots.size() == 3, "brace locks movement and fires three rays")
	run.shots.clear()
	run.shot_left = 0.0
	run.wider = true
	run.step(DT, Vector2.ZERO, true)
	_check(run.shots.size() == 5, "spread upgrade changes braced fire")


func _test_defense_damage() -> void:
	var run := Rules.new(40)
	run.begin()
	var enemy := Rules._enemy("scout", Vector2(Rules.LINE_X + 0.1, 233))
	enemy.warning = 0.0
	run.enemies.append(enemy)
	run.step(DT, Vector2.ZERO, false)
	_check(run.line == Rules.MAX_LINE - 1 and run.kills == 0 and run.enemies.is_empty(), "a leak damages the line without granting a kill")
	var collision := Rules._enemy("scout", run.player)
	collision.warning = 0.0
	run.enemies.append(collision)
	run.step(DT, Vector2.ZERO, false)
	_check(run.hp == Rules.MAX_HP - 1, "collision costs hp, not line")
	run.enemies[0].at = run.player
	run.step(DT, Vector2.ZERO, false)
	_check(run.hp == Rules.MAX_HP - 1, "collision grace blocks double damage")
	run.line = 1
	# A shot from the first step is still in flight toward the line; clear it so it cannot intercept.
	run.shots.clear()
	run.enemies[0].at = Vector2(Rules.LINE_X + 0.1, 233)
	run.step(DT, Vector2.ZERO, false)
	_check(run.phase == "lost" and run.loss_reason == "line", "losing the final line ends the run")
	var final_run := Rules.new(41)
	final_run.begin()
	var boss := Rules._enemy("tide", Vector2(Rules.LINE_X + 0.1, 233))
	boss.warning = 0.0
	final_run.enemies.append(boss)
	final_run.step(DT, Vector2.ZERO, false)
	_check(final_run.phase == "lost" and final_run.loss_reason == "tide", "letting the guardian through cannot count as a victory")


func _test_surge() -> void:
	var run := Rules.new(42)
	var foe := Rules._enemy("tide", run.player + Vector2(300, 0))
	foe.warning = 0.0
	run.enemies.append(foe)
	run._update_surge(DT)
	_check(run.surge_left > 0.0 and run.surge_at == run.player and run.hp == Rules.MAX_HP, "the tide warning is visible before any damage")
	run.player.x += Rules.SURGE_RADIUS + 1.0
	run._update_surge(Rules.SURGE_WARNING)
	_check(run.hp == Rules.MAX_HP, "leaving the marked circle avoids damage")
	run.surge_timer = 0.0
	run._update_surge(DT)
	run._update_surge(Rules.SURGE_WARNING)
	_check(run.hp == Rules.MAX_HP - 1, "staying in the circle costs hp")
	run.hurt_left = 0.0
	run.surge_timer = 0.0
	run._update_surge(DT)
	run.enemies.clear()
	run._update_surge(Rules.SURGE_WARNING)
	_check(run.surge_left == 0.0 and run.hp == Rules.MAX_HP - 1, "defeating the tide guardian cancels the warning")


func _test_waves() -> void:
	var run := Rules.new(53)
	run.begin()
	var spawned_total := 0
	for wave_index in Rules.LAST_WAVE:
		spawned_total += Rules.CAMPAIGN[wave_index].size()
	_check(spawned_total == Rules.MAX_SCORE, "local record bound matches the campaign")
	for i in 60 * 140:
		if run.phase == "choice":
			var elapsed := run.elapsed
			run.step(DT, Vector2.RIGHT, false)
			_check(run.elapsed == elapsed, "upgrade selection freezes time")
			_check(not run.choose("not_offered"), "an unknown bonus does not start the next wave")
			_check(run.offers.size() == 3 and run.offers[0] != run.offers[1] and run.offers[1] != run.offers[2] and run.offers[0] != run.offers[2], "wave choices are distinct")
			var offer := "power" if "power" in run.offers else run.offers[0]
			run.choose(offer)
		elif run.phase == "won" or run.phase == "lost":
			break
		else:
			var wish := Vector2.ZERO
			var brace := true
			if run.surge_left > 0.1:
				wish = Vector2.UP if run.surge_at.y > 234 else Vector2.DOWN
				brace = false
			run.step(DT, wish, brace)
			# This checks progression; real-device play is still needed for balance.
			if run.phase == "play":
				run.line = Rules.MAX_LINE
				run.hp = Rules.MAX_HP
	_check(run.phase == "won" and run.wave == Rules.LAST_WAVE and run.kills > 0, "the finite campaign reaches a victory screen")


func _test_links() -> void:
	var routes: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(Corner.ROUTES))
	_check(Corner.website_url(routes.get("cards")) == "https://zszm.iridescently.cn/#journal", "card table preserves the journal's origin and route")
	_check(Corner.website_url(routes.get("management")).ends_with("/#management"), "management goes to the existing account/save entry")
	_check(Corner.website_url(routes.get("juling")).ends_with("/app/shell/m/juling"), "juling uses the existing module shell")
	_check(Corner.website_url(routes.get("shengsheng-shoot")) == "https://iridescently.cn/playtest/shengsheng-shoot/", "old beach route remains available")
	_check(Corner.website_url({"host":"example.org@local", "path":"/"}).is_empty(), "only generated host and path can be opened")
	_check(Corner.website_url({"host":"example.org", "path":"//payload"}).is_empty(), "a path cannot designate a different host")


func _test_corner() -> void:
	var corner := Corner.new()
	var opened := {"count": 0}
	corner.can_play = true
	corner.shoot_requested.connect(func(): opened.count += 1)
	root.add_child(corner)
	await process_frame
	var play := corner.find_child("PlayBeachShoot", true, false) as Button
	var journal := corner.find_child("WebGame_cards", true, false) as Button
	_check(play != null and not play.disabled, "an existing profile can use the local game entry")
	_check(journal != null and not journal.disabled, "the published game route enables its website entry")
	if play != null:
		play.pressed.emit()
	_check(opened.count == 1, "local entry asks the host to mount the game")
	corner.queue_free()
	await process_frame


func _test_scene() -> void:
	var scene = Game.instantiate()
	var exited := {"count": 0}
	scene.exited.connect(func(): exited.count += 1)
	root.size = Vector2i(1280, 720)
	root.add_child(scene)
	await process_frame
	await process_frame
	_check(scene.menu.visible and scene.run.phase == "ready", "standalone scene has a start card")
	scene._start()
	_check(scene.run.phase == "play" and not scene.menu.visible, "start button opens the first wave")
	var field: Rect2 = scene.arena.field
	_check(field.has_area() and scene.arena.to_field(field.get_center()).is_equal_approx(Rules.SIZE * 0.5), "input uses the drawn arena after layout")
	scene._on_pointer_press(field.get_center(), 0)
	_check(scene.pointer == 0 and scene.arena.touch_origin == field.get_center(), "touch starts a virtual stick inside the field")
	scene._pause()
	_check(scene.menu.visible and scene.pointer == -1, "pause releases pointer and shows controls")
	scene._leave()
	_check(exited.count == 1, "exit returns control to the host")
	scene.queue_free()
	await process_frame


func _test_hall_entry() -> void:
	var hall = load("res://scenes/main.tscn").instantiate()
	var profile = root.get_node("Profile")
	var previous_nick: String = profile.nick
	var previous_oc: PackedByteArray = profile.oc_png
	root.add_child(hall)
	hall.set_process(false)
	await process_frame
	hall._open_game_corner()
	_check(hall.activity_layer == null, "the game corner cannot open before welcome")
	var icon := Image.create(2, 2, false, Image.FORMAT_RGBA8)
	icon.fill(Color.WHITE)
	profile.nick = "Smoke"
	profile.oc_png = icon.save_png_to_buffer()
	hall.welcomed = true
	hall.hud.show()
	hall.hud_buttons["小游戏"].pressed.emit()
	var button := hall.panel_holder.find_child("PlayBeachShoot", true, false) as Button
	_check(button != null and not button.disabled, "hall HUD opens the playable game corner")
	if button != null:
		button.pressed.emit()
		_check(hall.activity_layer != null and not hall.hud.visible, "the entry mounts the activity over the hall")
		if hall.activity_layer != null:
			hall.activity_layer.get_child(0)._leave()
			_check(hall.activity_layer == null and hall.hud.visible, "exiting the activity restores the hall HUD")
	hall.welcomed = false
	profile.nick = previous_nick
	profile.oc_png = previous_oc
	hall.queue_free()
	await process_frame
