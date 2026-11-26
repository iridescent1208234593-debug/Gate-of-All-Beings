extends Node2D
const TrialCrow = preload("res://scripts/species_crow.gd")
## 2D/2.5D view: top-down painted hall using the team's existing forest art, y-sorted by depth.
## Pure presentation: every position comes from LabWorld (authoritative server state + my prediction).

const PX := 48.0                     # pixels per metre
const CreaturePose = preload("res://scripts/creature_pose.gd")
var renmo = preload("res://scripts/renmo_animation.gd").new()
var world: LabWorld
var font: Font
var camera: Camera2D
var tex := {}
var built_version := -1
var hover_object := ""
var t := 0.0
var path_cursor = null               # Vector2i cell highlighted while paving, or null


func setup(w: LabWorld, f: Font) -> void:
	world = w
	var colors_material := ShaderMaterial.new()
	colors_material.shader = preload("res://shaders/renmo_colors_2d.gdshader")
	colors_material.set_shader_parameter("palette_tex",RenmoColors.texture)
	material = colors_material
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
	var focus := world.view_center()
	camera.position = world_to_px(focus.x, focus.y)
	var vp := get_viewport_rect().size
	camera.zoom = Vector2.ONE * clampf(minf(vp.x / 1280.0, vp.y / 720.0) * 1.15, 0.6, 2.0)
	if world.template.has("painted_size"):
		# keep the painted horizon on screen: never show past the edges of the whole map
		var area := world.map_rect()
		var r0 := area.position * PX
		var r1 := area.end * PX
		var map_px := r1 - r0
		var zoom_fit := maxf(vp.x / map_px.x, vp.y / map_px.y)
		camera.zoom = Vector2.ONE * maxf(camera.zoom.x, zoom_fit)
		var half := vp / camera.zoom * 0.5
		camera.position = Vector2(clampf(camera.position.x, r0.x + half.x, r1.x - half.x), clampf(camera.position.y, r0.y + half.y, r1.y - half.y))
	queue_redraw()


func _sprite(name: String, foot: Vector2, height_m: float, flip := false, modulate := Color.WHITE) -> void:
	var tx: Texture2D = tex.get(name)
	if tx == null:
		return
	_draw_tex(tx, foot, height_m, flip, modulate)


func _draw_tex(tx: Texture2D, foot: Vector2, height_m: float, flip := false, modulate := Color.WHITE, base := Transform2D.IDENTITY) -> void:
	var h := height_m * PX
	var w := h * float(tx.get_width()) / float(tx.get_height())
	_draw_flipped(tx, Rect2(foot.x - w * 0.5, foot.y - h, w, h), flip, modulate, base)


func _draw_flipped(tx: Texture2D, rect: Rect2, flip: bool, modulate := Color.WHITE, base := Transform2D.IDENTITY) -> void:
	# A negative-width rect does NOT mirror in Godot (only its absolute width is used), so the
	# left-facing pose is mirrored with a canvas transform and the rect stays positive.
	# `base` carries any caller transform so a mirrored draw can be layered on top of it.
	if not flip:
		draw_texture_rect(tx, rect, false, modulate)
		return
	draw_set_transform_matrix(base * Transform2D(0.0, Vector2(-1, 1), 0.0, Vector2(rect.position.x + rect.size.x, rect.position.y)))
	draw_texture_rect(tx, Rect2(Vector2.ZERO, rect.size), false, modulate)
	draw_set_transform_matrix(base)


func _draw() -> void:
	if world == null or world.template.is_empty():
		return
	var spirit: bool = world.template.get("ground", "grass") == "spirit"
	var b0 := world_to_px(world.bmin.x - 0.5, world.bmin.y - 0.5)
	var b1 := world_to_px(world.bmax.x + 0.5, world.bmax.y + 0.5)
	draw_rect(Rect2(b0 - Vector2(600, 600), b1 - b0 + Vector2(1200, 1200)), Color("2e4434") if not spirit else Color("2a2944"))
	var tint := Color.WHITE if not spirit else Color(0.72, 0.78, 1.0)
	var painted: bool = world.template.has("painted_ground")
	# a painted scene alone (old layout) has no grass; the merged hall has both
	var painted_only: bool = painted and not world.template.has("grass_rect")
	if not painted_only:
		var g0 := b0
		var g1 := b1
		if world.template.has("grass_rect"):
			var gr: Array = world.template["grass_rect"]
			g0 = world_to_px(gr[0], gr[1])
			g1 = world_to_px(float(gr[0]) + float(gr[2]), float(gr[1]) + float(gr[3]))
		draw_texture_rect(tex["grass_day"], Rect2(g0, g1 - g0), true, tint)
		if world.river.has_area():
			var bank := Rect2(world.river.position, Vector2(world.map_rect().end.x - world.river.position.x, world.river.size.y))
			draw_texture_rect(tex["grass_day"], Rect2(bank.position * PX, bank.size * PX), true, tint)
		if not painted:
			draw_rect(Rect2(g0, g1 - g0), Color(0.15, 0.2, 0.12, 0.5), false, 6.0)
	if painted:
		var map_size: Array = world.template["painted_size"]
		var origin: Array = world.template.get("painted_origin", [0, 0])
		draw_texture_rect(_tex(world.template["painted_ground"]), Rect2(world_to_px(origin[0], origin[1]), Vector2(map_size[0], map_size[1]) * PX), false)
	var visible_area: Rect2 = (get_canvas_transform().affine_inverse() * get_viewport_rect()).grow(240.0)
	_draw_tiles(visible_area)
	if world.river.has_area():
		var water := Rect2(world.river.position * PX, world.river.size * PX)
		draw_rect(water.grow(4.0), Color("95a887"))
		draw_rect(water, Color("54979d"))
		draw_line(water.position + Vector2(6, 0), Vector2(water.position.x + 6, water.end.y), Color("9cc8b6"), 3)
		var deck := Rect2(world.bridge.position * PX, world.bridge.size * PX).grow_individual(10, 0, 10, 0)
		draw_rect(deck, Color("956e46"))
		for i in range(1, 12):
			var x := deck.position.x + deck.size.x * i / 12.0
			draw_line(Vector2(x, deck.position.y), Vector2(x, deck.end.y), Color("705038"), 2)
		draw_line(deck.position, Vector2(deck.end.x, deck.position.y), Color("d8b17c"), 5)
		draw_line(Vector2(deck.position.x, deck.end.y), deck.end, Color("b58b59"), 5)
	# flat things first: water, pasture, paths
	var past: Dictionary = world.template.get("pasture", {})
	if not past.is_empty() and not spirit and not painted_only:
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
	var route: Array = world.template.get("route", [])
	if route.size() >= 2:
		var points := PackedVector2Array()
		for p in route:
			points.append(world_to_px(p[0], p[1]))
		draw_polyline(points, Color("987452"), 16.0, true)
		draw_polyline(points, Color("bd9970"), 10.0, true)
	if not world.outskirts.is_empty():
		var e: Array = world.outskirts["entry"]
		var at := world_to_px(e[0], e[1])
		draw_circle(at, 10.0, Color("33403b"))
		draw_circle(at, 6.0, Color("f0c679"))
		var caption := "回会馆" if world.outskirts["destination"] == "hall" else "松风径"
		draw_string(font, at + Vector2(12, -6), caption, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color("fff0c8"))
	if world.template.has("lily_pond"):
		var p := world.pond_position()
		var at := world_to_px(p.x, p.y)
		var phase := world.pond_stage()
		draw_circle(at, 17, Color("263c38"))
		draw_circle(at, 13, Color("76a998") if phase >= 2 else Color("96715c"))
		if phase < 2:
			draw_circle(at + Vector2(-6, -4), 3.0, Color("583a2e"))
			draw_circle(at + Vector2(5, 4), 2.5, Color("583a2e"))
		if phase == 3:
			draw_circle(at + Vector2(-7, 3), 4.0, Color("85b162"))
			draw_circle(at + Vector2(7, 1), 4.0, Color("85b162"))
		draw_string(font, at - Vector2(11.0, 20.0), "%d/3" % phase, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("fff1cf"))
	# Canonical x/z for swimmers. The small offset and tint make negative y readable in 2D.
	for pid in world.species_trials:
		var trial: Dictionary = world.species_trials[pid]
		var point := Vector2(trial["x"], trial["z"])
		var fx := world_to_px(point.x, point.y)
		if trial.get("form") == "bird":
			var action: String = trial["flight"]
			draw_circle(fx, 4.0, Color(0.12, 0.18, 0.18, 0.32))
			_draw_tex(TrialCrow.frames().get_frame_texture(action, TrialCrow.frame_number(action)),
				fx - Vector2(0, float(trial["y"]) * 10.0), 0.8, cos(float(trial["dir"])) < 0)
			continue
		if trial.get("form") == "frog":
			_draw_tex(world.art_texture("b_frog"), fx, 0.62, cos(float(trial["dir"])) < 0)
			if not trial.get("fed", false):
				var bug := world_to_px(trial["insect"][0], trial["insect"][1]) - Vector2(0, 6)
				draw_circle(bug, 2.5, Color("fed074"))
				draw_line(bug + Vector2(-4, -2), bug + Vector2(4, 2), Color("fff0b6"), 1.0)
			var tongue := world.tongue_geometry(str(pid))
			if not tongue.is_empty():
				var a: Vector2 = tongue["from"]
				var b: Vector2 = tongue["end"]
				draw_line(world_to_px(a.x, a.y) - Vector2(0, 6), world_to_px(b.x, b.y) - Vector2(0, 6), Color("fa6b9c"), 3.0)
			continue
		var dive: bool = float(trial["y"]) < 0.0
		if world.bridge.has_point(point):
			draw_arc(fx, 7.0, 0.0, TAU, 18, Color("74cbd0"), 1.5)
		else:
			_draw_tex(preload("res://assets/world/species_trial_fish.svg"), fx + Vector2(0, 5 if dive else 0), 0.36,
				cos(float(trial["dir"])) < 0, Color(0.61, 0.82, 0.88, 0.86) if dive else Color.WHITE)
	# depth-sorted drawables
	var items: Array = []
	for d in world.template.get("decor", []):
		items.append([d["position"][2], "decor", d])
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
		var foot: Vector2
		if it[1] == "ob" or it[1] == "obj" or it[1] == "decor":
			foot = world_to_px(it[2]["position"][0], it[2]["position"][2])
		elif it[1] == "npc":
			foot = world_to_px(it[2]["x"], it[2]["z"])
		elif it[1] == "me":
			foot = world_to_px(world.me["x"], world.me["z"])
		else:
			foot = world_to_px(world.players[it[2]]["x"], world.players[it[2]]["z"])
		if it[1] != "decor" and not visible_area.has_point(foot):
			continue
		match it[1]:
			"decor":
				var texture := world.art_texture(it[2]["asset"])
				if texture: _draw_tex(texture, foot, float(it[2]["height"]))
			"ob": _draw_obstacle(it[2], spirit)
			"obj": _draw_object(it[2])
			"npc": _draw_npc(it[2])
			"pl": _draw_player(it[2], world.players[it[2]])
			"me": _draw_player(world.me_pid, world.me)


func _tex(path: String) -> Texture2D:
	if not tex.has(path):
		tex[path] = load(path)
	return tex[path]


## Dirt-path tiles: 阿阳's 16-tile dual-grid sheet. Each drawn tile sits half a cell off the
## logical grid and is picked by which of its four corner cells hold a path (see LabWorld.dual_tiles).
func _draw_tiles(area: Rect2) -> void:
	var art: Dictionary = world.spec.get("paths", {}).get("art", {}).get("dirt", {})
	if art.is_empty():
		return
	var pattern: String = art["tiles"]
	var dual := world.dual_tiles()
	for t in dual:
		var r := Rect2(Vector2(t.x - 0.5, t.y - 0.5) * PX, Vector2(PX, PX))
		if not area.intersects(r):
			continue
		var tx := _tex(pattern % dual[t])
		if tx:
			draw_texture_rect(tx, r, false)


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
		"game_pavilion", "game_relay":
			var station: bool = o["kind"] == "game_relay"
			var light := Color("#9df1c3") if station else Color("#ffd790")
			draw_circle(foot, 18, Color(0.10, 0.16, 0.13, 0.30))
			draw_line(foot, foot + Vector2(0, -49), Color("#544c39"), 8)
			draw_circle(foot + Vector2(0, -51), 24 + sin(t * 3.0) * 3, Color(light, 0.23))
			draw_colored_polygon(PackedVector2Array([foot + Vector2(-17, -51), foot + Vector2(0, -69),
				foot + Vector2(17, -51), foot + Vector2(0, -35)]), light)
	if font and o.get("name", "") != "":
		draw_string(font, foot + Vector2(-60, 24), o["name"], HORIZONTAL_ALIGNMENT_CENTER, 120, 15, Color(1, 1, 0.92, 0.85))


func _draw_npc(n: Dictionary) -> void:
	var foot := world_to_px(n["x"], n["z"])
	var art := world.art_texture(n.get("asset", ""))
	if art:
		var h := float(n.get("height", 1.0))
		var creature: bool = n.get("kind", "creature") == "creature"
		if n.has("stages") and not n["stages"].is_empty(): h *= 0.45 + float(n.get("stage", 0)) * 0.275
		if creature: draw_circle(foot + Vector2(0, 2), minf(20, h * 10), Color(0, 0, 0, 0.13))
		var pose := CreaturePose.sample(n, world.npc_time())
		var pose_t := Transform2D(float(pose["angle"]), pose["stretch"], 0.0, foot - Vector2(0, float(pose["lift"]) * PX))
		draw_set_transform_matrix(pose_t)
		_draw_tex(art, Vector2.ZERO, h, creature and cos(float(n.get("heading", 0))) < -0.2, Color.WHITE, pose_t)
		draw_set_transform_matrix(Transform2D.IDENTITY)
		return
	if n.get("asset", "") != "":
		draw_circle(foot, 6, Color(0.8, 0.85, 0.7, 0.5))
		return
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
		# Fixed canvas: do not crop each frame, so feet and root remain stable.
		if pid == world.me_pid: p["face"] = Profile.face
		var h := 1.75 * PX / 0.76
		var colors: Dictionary = Profile.part_colors if pid == world.me_pid else p.get("part_colors",{})
		var row := RenmoColors.row_for(pid,colors)
		renmo.draw_on(self, p, t, Rect2(foot.x-h*0.4,foot.y-h*0.84,h*0.8,h), Color((row+0.5)/128.0,0.123,0.456,1.0), facing_left)
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
