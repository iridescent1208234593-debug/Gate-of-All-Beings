extends Node2D
## 2D/2.5D view: top-down painted hall using the team's existing forest art, y-sorted by depth.
## Pure presentation: every position comes from LabWorld (authoritative server state + my prediction).

const PX := 48.0                     # pixels per metre
var world: LabWorld
var font: Font
var camera: Camera2D
var tex := {}
var built_version := -1
var hover_object := ""
var t := 0.0


func setup(w: LabWorld, f: Font) -> void:
	world = w
	font = f
	texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	camera = Camera2D.new()
	camera.position_smoothing_enabled = true
	camera.position_smoothing_speed = 8.0
	add_child(camera)
	camera.make_current()
	for n in ["grass_day", "tree", "gate", "rock_bush", "moss_01", "moss_04", "moss_07", "oxalis_1", "oxalis_2",
			"oxalis_3", "narcissus_3", "dandelion_3", "player_front", "player_back", "player_side", "spirit_small"]:
		tex[n] = load("res://assets/world/%s.png" % n)


func activate(on: bool) -> void:
	visible = on
	set_process(on)
	if camera:
		camera.enabled = on
		if on:
			camera.make_current()


func world_to_px(x: float, z: float) -> Vector2:
	return Vector2(x * PX, z * PX)


func screen_to_world(screen: Vector2) -> Vector2:
	var p := get_canvas_transform().affine_inverse() * screen
	return p / PX


func _process(delta: float) -> void:
	t += delta
	if world == null:
		return
	camera.position = world_to_px(world.me["x"], world.me["z"])
	var vp := get_viewport_rect().size
	camera.zoom = Vector2.ONE * clampf(minf(vp.x / 1280.0, vp.y / 720.0) * 1.15, 0.6, 2.0)
	queue_redraw()


func _sprite(name: String, foot: Vector2, height_m: float, flip := false, modulate := Color.WHITE) -> void:
	var tx: Texture2D = tex.get(name)
	if tx == null:
		return
	_draw_tex(tx, foot, height_m, flip, modulate)


func _draw_tex(tx: Texture2D, foot: Vector2, height_m: float, flip := false, modulate := Color.WHITE) -> void:
	var h := height_m * PX
	var w := h * float(tx.get_width()) / float(tx.get_height())
	# A negative width flips the texture horizontally.
	var rect := Rect2(foot.x + w * 0.5, foot.y - h, -w, h) if flip else Rect2(foot.x - w * 0.5, foot.y - h, w, h)
	draw_texture_rect(tx, rect, false, modulate)


func _draw() -> void:
	if world == null or world.template.is_empty():
		return
	var spirit: bool = world.template.get("ground", "grass") == "spirit"
	var b0 := world_to_px(world.bmin.x - 0.5, world.bmin.y - 0.5)
	var b1 := world_to_px(world.bmax.x + 0.5, world.bmax.y + 0.5)
	draw_rect(Rect2(b0 - Vector2(600, 600), b1 - b0 + Vector2(1200, 1200)), Color("2e4434") if not spirit else Color("2a2944"))
	var tint := Color.WHITE if not spirit else Color(0.72, 0.78, 1.0)
	draw_texture_rect(tex["grass_day"], Rect2(b0, b1 - b0), true, tint)
	draw_rect(Rect2(b0, b1 - b0), Color(0.15, 0.2, 0.12, 0.5), false, 6.0)
	# flat things first: water, pasture, paths
	var past: Dictionary = world.template.get("pasture", {})
	if not past.is_empty() and not spirit:
		var o := world_to_px(past["origin"][0] - 0.6, past["origin"][2] - 0.6)
		var size := Vector2(past["cell_step"][0] * past["cells"][0] + 0.6, past["cell_step"][2] * past["cells"][1] + 0.6) * PX
		draw_rect(Rect2(o, size), Color(0.85, 0.9, 0.6, 0.18))
		draw_rect(Rect2(o, size), Color(0.45, 0.35, 0.22, 0.6), false, 3.0)
	for ob in world.template["obstacles"]:
		if ob["kind"] == "water":
			var c := world_to_px(ob["position"][0], ob["position"][2])
			var r: float = ob["radius"] * PX
			draw_circle(c, r + 6, Color("6f8f6a"))
			draw_circle(c, r, Color("5f9aa6") if not spirit else Color("8a86d6"))
			draw_circle(c + Vector2(-r * 0.3, -r * 0.25), r * 0.35, Color(1, 1, 1, 0.18))
	# depth-sorted drawables
	var items: Array = []
	for ob in world.template["obstacles"]:
		if ob["kind"] != "water":
			items.append([ob["position"][2], "ob", ob])
	for o in world.template["objects"]:
		items.append([o["position"][2], "obj", o])
	for id in world.npc_view:
		items.append([world.npc_view[id]["z"], "npc", world.npc_view[id]])
	for pid in world.players:
		items.append([world.players[pid]["z"], "pl", pid])
	items.append([world.me["z"], "me", world.me_pid])
	items.sort_custom(func(a, b): return a[0] < b[0])
	for it in items:
		match it[1]:
			"ob": _draw_obstacle(it[2], spirit)
			"obj": _draw_object(it[2])
			"npc": _draw_npc(it[2])
			"pl": _draw_player(it[2], world.players[it[2]])
			"me": _draw_player(world.me_pid, world.me)


func _draw_obstacle(ob: Dictionary, spirit: bool) -> void:
	var foot := world_to_px(ob["position"][0], ob["position"][2])
	match ob["kind"]:
		"tree":
			draw_circle(foot + Vector2(0, 4), ob["radius"] * PX, Color(0, 0, 0, 0.18))
			_sprite("tree", foot + Vector2(0, 10), 4.6, false, Color(0.8, 0.85, 1.0) if spirit else Color.WHITE)
		"gate":
			_sprite("gate", foot + Vector2(0, 30), 4.4)
		"rock":
			_sprite("rock_bush" if int(ob["position"][0]) % 2 == 0 else "moss_04", foot + Vector2(0, 8), 1.3)
		"campfire":
			for i in 7:
				var a := TAU * i / 7.0
				draw_circle(foot + Vector2(cos(a), sin(a) * 0.6) * 22.0, 7, Color("7b7266"))
			var flick := 0.85 + 0.15 * sin(t * 13.0)
			draw_circle(foot + Vector2(0, -10), 14 * flick, Color(1.0, 0.55, 0.2, 0.9))
			draw_circle(foot + Vector2(0, -16), 8 * flick, Color(1.0, 0.85, 0.4, 0.95))
			draw_circle(foot, 46, Color(1.0, 0.7, 0.3, 0.07))
		_:
			draw_circle(foot, ob["radius"] * PX, Color(0.3, 0.3, 0.3, 0.6))


func _draw_object(o: Dictionary) -> void:
	var foot := world_to_px(o["position"][0], o["position"][2])
	var st: Dictionary = world.objects.get(o["id"], {})
	match o["kind"]:
		"lantern":
			var stage := int(st.get("stage", 0))
			var names := ["oxalis_1", "oxalis_2", "oxalis_3", "narcissus_3"]
			_sprite(names[clampi(stage, 0, 3)], foot, 0.6 + stage * 0.25)
			if stage == 3:
				draw_circle(foot + Vector2(0, -30), 30 + 4 * sin(t * 2.0), Color(1.0, 0.9, 0.5, 0.12))
		"bell":
			draw_line(foot, foot + Vector2(0, -90), Color("6b5338"), 6)
			draw_line(foot + Vector2(-30, -90), foot + Vector2(30, -90), Color("6b5338"), 6)
			var swing := sin(t * 3.0) * 6.0 if float(Time.get_ticks_msec()) / 1000.0 - float(st.get("_rung_at", 0.0)) < 3.0 else 0.0
			draw_circle(foot + Vector2(swing, -70), 12, Color("c9a74a"))
		"portal":
			var colors := [Color("e07a7a"), Color("e6a15a"), Color("e8d46a"), Color("8fc77a"), Color("6fb3d6"), Color("8a86d6"), Color("c38ad6")]
			for i in colors.size():
				draw_arc(foot + Vector2(0, -10), 70 - i * 7, PI, TAU, 32, colors[i], 6.0)
			draw_circle(foot + Vector2(0, -20), 30, Color(1, 1, 1, 0.08 + 0.05 * sin(t * 2.5)))
		"board":
			draw_rect(Rect2(foot + Vector2(-34, -70), Vector2(68, 44)), Color("a3845a"))
			draw_rect(Rect2(foot + Vector2(-30, -66), Vector2(60, 36)), Color("efe3c4"))
			draw_line(foot + Vector2(-24, -26), foot + Vector2(-24, 0), Color("6b5338"), 5)
			draw_line(foot + Vector2(24, -26), foot + Vector2(24, 0), Color("6b5338"), 5)
	if font and o.get("name", "") != "":
		draw_string(font, foot + Vector2(-60, 24), o["name"], HORIZONTAL_ALIGNMENT_CENTER, 120, 15, Color(1, 1, 0.92, 0.85))


func _draw_npc(n: Dictionary) -> void:
	var foot := world_to_px(n["x"], n["z"])
	draw_circle(foot + Vector2(0, 2), 14, Color(0, 0, 0, 0.15))
	match n["species"]:
		"Sheep":
			draw_circle(foot + Vector2(0, -14), 16, Color("f2efe6"))
			draw_circle(foot + Vector2(14, -20), 8, Color("4b4038"))
		"Wolf":
			draw_circle(foot + Vector2(0, -14), 15, Color("7f8389"))
			draw_colored_polygon(PackedVector2Array([foot + Vector2(10, -28), foot + Vector2(24, -18), foot + Vector2(10, -14)]), Color("5f6369"))
		_:
			_sprite("spirit_small", foot, 0.9)


func _draw_player(pid: String, p: Dictionary) -> void:
	var foot := world_to_px(p["x"], p["z"])
	draw_circle(foot + Vector2(0, 2), 16, Color(0, 0, 0, 0.2))
	var tx := world.texture_for(pid)
	var bob := 0.0
	if p.get("anim", "idle") != "idle":
		bob = absf(sin(t * 10.0)) * 3.0
	var facing_left := cos(float(p.get("dir", 0.0))) < -0.2
	if tx != null:
		_draw_tex(tx, foot - Vector2(0, bob), 1.75, facing_left)
	else:
		var d := float(p.get("dir", 0.0))
		var name := "player_front"
		if absf(cos(d)) > 0.7:
			name = "player_side"
		elif sin(d) < 0:
			name = "player_back"
		_sprite(name, foot - Vector2(0, bob), 1.2, cos(d) < 0 and name == "player_side")
	if font == null:
		return
	var label: String = p.get("nick", "") if pid != world.me_pid else Profile.nick
	if Profile.show_names and label != "":
		var col := Color(1, 0.96, 0.8) if pid == world.me_pid else Color.WHITE
		draw_string_outline(font, foot + Vector2(-70, -92), label, HORIZONTAL_ALIGNMENT_CENTER, 140, 16, 5, Color(0.1, 0.12, 0.1, 0.8))
		draw_string(font, foot + Vector2(-70, -92), label, HORIZONTAL_ALIGNMENT_CENTER, 140, 16, col)
	var now := Time.get_ticks_msec() / 1000.0
	if p.get("bubble_until", 0.0) > now:
		var text: String = p["bubble"]
		var w := minf(260.0, 18.0 + text.length() * 15.0)
		var r := Rect2(foot + Vector2(-w * 0.5, -150), Vector2(w, 34))
		draw_rect(r, Color(1, 1, 0.97, 0.94))
		draw_string(font, r.position + Vector2(8, 23), text.substr(0, 16), HORIZONTAL_ALIGNMENT_LEFT, w - 12, 15, Color("2f3a2c"))
	if p.get("emote_until", 0.0) > now:
		draw_string_outline(font, foot + Vector2(-60, -118), p["emote"], HORIZONTAL_ALIGNMENT_CENTER, 120, 22, 6, Color(0.1, 0.1, 0.1, 0.8))
		draw_string(font, foot + Vector2(-60, -118), p["emote"], HORIZONTAL_ALIGNMENT_CENTER, 120, 22, Color("ffe08a"))
