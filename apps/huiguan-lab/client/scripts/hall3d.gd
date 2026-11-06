extends Control
## 3D pixel view: low-res SubViewport (480x270) upscaled by whole numbers with nearest filtering,
## orthographic camera, stepped-light surface shader and the Campfire subtree from
## Wayoung7/3D-Pixel-Campfire (MIT). OCs are Y-billboards so 2D art stays readable in 3D.
## Same LabWorld as the 2D view: x/z metres map 1:1 to 3D x/z.

const VIEW_SIZE := Vector2i(480, 270)
const SURFACE = preload("res://third_party/3d-pixel-campfire/surface.gdshader")
var world: LabWorld
var font: Font
var viewport: SubViewport
var picture: TextureRect
var root3d: Node3D
var camera: Camera3D
var static_root: Node3D
var avatars: Dictionary = {}       # pid -> Sprite3D
var npc_nodes: Dictionary = {}
var lanterns: Dictionary = {}
var built_version := -1
var overlay: Control
var factor := 1.0
var t := 0.0
var stage_tex := []


func setup(w: LabWorld, f: Font) -> void:
	world = w
	font = f
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)
	viewport = SubViewport.new()
	viewport.size = VIEW_SIZE
	viewport.own_world_3d = true
	viewport.transparent_bg = false
	viewport.msaa_3d = Viewport.MSAA_DISABLED
	viewport.render_target_update_mode = SubViewport.UPDATE_DISABLED
	add_child(viewport)
	root3d = Node3D.new()
	viewport.add_child(root3d)
	picture = TextureRect.new()
	picture.texture = viewport.get_texture()
	picture.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
	picture.stretch_mode = TextureRect.STRETCH_SCALE
	add_child(picture)
	overlay = Control.new()
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	overlay.draw.connect(_draw_overlay)
	add_child(overlay)
	resized.connect(_layout)
	for n in ["oxalis_1", "oxalis_2", "oxalis_3", "narcissus_3"]:
		stage_tex.append(load("res://assets/world/%s.png" % n))
	_build_environment()


func activate(on: bool) -> void:
	visible = on
	set_process(on)
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS if on else SubViewport.UPDATE_DISABLED
	if on:
		_layout()


func _layout() -> void:
	factor = maxf(1.0, floorf(minf(size.x / VIEW_SIZE.x, size.y / VIEW_SIZE.y)))
	if size.x / VIEW_SIZE.x - factor > 0.45 or size.y / VIEW_SIZE.y - factor > 0.45:
		factor = minf(size.x / VIEW_SIZE.x, size.y / VIEW_SIZE.y)     # small windows: fill, accept non-integer scale
	picture.size = Vector2(VIEW_SIZE) * factor
	picture.position = (size - picture.size) * 0.5


func _mat(color: String, ambient := 0.3) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = SURFACE
	m.set_shader_parameter("albedo", Color(color))
	m.set_shader_parameter("ambient_energy", ambient)
	m.set_shader_parameter("light_wrap", 0.2)
	m.set_shader_parameter("light_steepness", 1.1)
	return m


func _mesh(shape: Mesh, p: Vector3, material: Material, parent: Node3D) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	node.mesh = shape
	node.material_override = material
	node.position = p
	parent.add_child(node)
	return node


func _build_environment() -> void:
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color("5d7f7b")
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color("cad9b5")
	e.ambient_light_energy = 0.6
	e.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	env.environment = e
	root3d.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52, -35, 0)
	sun.light_color = Color("fff0c7")
	sun.light_energy = 0.75
	sun.shadow_enabled = true
	root3d.add_child(sun)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 15.0
	camera.near = 0.1
	camera.far = 120.0
	camera.rotation_degrees = Vector3(-45, 0, 0)
	root3d.add_child(camera)


func _rebuild_static() -> void:
	built_version = world.version
	if static_root:
		static_root.queue_free()
	for a in avatars.values():
		a.queue_free()
	avatars.clear()
	for n in npc_nodes.values():
		n.queue_free()
	npc_nodes.clear()
	lanterns.clear()
	static_root = Node3D.new()
	root3d.add_child(static_root)
	var spirit: bool = world.template.get("ground", "grass") == "spirit"
	var size2 := world.bmax - world.bmin + Vector2(1, 1)
	var plane := PlaneMesh.new()
	plane.size = size2
	_mesh(plane, Vector3((world.bmin.x + world.bmax.x) * 0.5, 0, (world.bmin.y + world.bmax.y) * 0.5),
		_mat("8aa86a" if not spirit else "7c7fb6", 0.35), static_root)
	var outer := PlaneMesh.new()
	outer.size = size2 + Vector2(40, 40)
	_mesh(outer, Vector3((world.bmin.x + world.bmax.x) * 0.5, -0.05, (world.bmin.y + world.bmax.y) * 0.5),
		_mat("4d6b4c" if not spirit else "3d3c66", 0.3), static_root)
	var past: Dictionary = world.template.get("pasture", {})
	if not past.is_empty() and not spirit:
		var pm := PlaneMesh.new()
		pm.size = Vector2(past["cell_step"][0] * past["cells"][0] + 0.6, past["cell_step"][2] * past["cells"][1] + 0.6)
		_mesh(pm, Vector3(past["origin"][0] - 0.6 + pm.size.x * 0.5, 0.01, past["origin"][2] - 0.6 + pm.size.y * 0.5), _mat("a7b878", 0.35), static_root)
	for ob in world.template["obstacles"]:
		var p := Vector3(ob["position"][0], 0, ob["position"][2])
		var r := float(ob["radius"])
		match ob["kind"]:
			"tree": _tree(p, 3.6 + r, int(p.x) % 4, spirit)
			"rock":
				var s := SphereMesh.new(); s.radius = r; s.height = r * 1.3; s.radial_segments = 7; s.rings = 3
				_mesh(s, p + Vector3(0, r * 0.35, 0), _mat("8c8a7a"), static_root)
			"water":
				var c := CylinderMesh.new(); c.top_radius = r; c.bottom_radius = r; c.height = 0.04; c.radial_segments = 20
				_mesh(c, p + Vector3(0, 0.02, 0), _mat("5f9aa6" if not spirit else "8a86d6", 0.5), static_root)
			"gate": _gate(p)
			"campfire": _campfire(p)
	for o in world.template["objects"]:
		var p := Vector3(o["position"][0], 0, o["position"][2])
		match o["kind"]:
			"lantern":
				var sp := Sprite3D.new()
				sp.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
				sp.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
				sp.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
				sp.centered = false
				sp.position = p
				static_root.add_child(sp)
				lanterns[o["id"]] = sp
			"portal": _portal(p)
			"bell":
				var post := BoxMesh.new(); post.size = Vector3(0.12, 1.8, 0.12)
				_mesh(post, p + Vector3(0, 0.9, 0), _mat("6b5338"), static_root)
				var bell := SphereMesh.new(); bell.radius = 0.22; bell.height = 0.4
				_mesh(bell, p + Vector3(0.25, 1.5, 0), _mat("c9a74a", 0.5), static_root)
			"board":
				var board := BoxMesh.new(); board.size = Vector3(1.4, 0.9, 0.1)
				_mesh(board, p + Vector3(0, 1.1, 0), _mat("a3845a"), static_root)


func _tree(p: Vector3, height: float, tint: int, spirit: bool) -> void:
	var trunk := CylinderMesh.new()
	trunk.top_radius = 0.15; trunk.bottom_radius = 0.28; trunk.height = height * 0.7; trunk.radial_segments = 6
	_mesh(trunk, p + Vector3(0, height * 0.35, 0), _mat("78684c"), static_root)
	var colors := ["668d63", "8d9f66", "47745b", "a6ad71"] if not spirit else ["8c8fd6", "a49ad8", "7a86c8", "b7a6e0"]
	for i in range(3):
		var off := Vector3(sin(float(i) * 2.2) * 0.6, height * 0.64 + i * 0.3, cos(float(i) * 2.2) * 0.45)
		var s := SphereMesh.new(); s.radius = 1.2; s.height = 2.4; s.radial_segments = 7; s.rings = 3
		var n := _mesh(s, p + off, _mat(colors[(tint + i) % colors.size()]), static_root)
		n.scale = Vector3(1.0, 0.7, 1.0)


func _gate(p: Vector3) -> void:
	var wood := _mat("8a5a3c")
	for dx in [-1.3, 1.3]:
		var post := BoxMesh.new(); post.size = Vector3(0.35, 3.2, 0.35)
		_mesh(post, p + Vector3(dx, 1.6, 0), wood, static_root)
	var beam := BoxMesh.new(); beam.size = Vector3(3.6, 0.3, 0.45)
	_mesh(beam, p + Vector3(0, 3.25, 0), _mat("6d3f2c"), static_root)
	var roof := PrismMesh.new(); roof.size = Vector3(4.2, 0.7, 1.0)
	_mesh(roof, p + Vector3(0, 3.75, 0), _mat("4f5e52"), static_root)


func _portal(p: Vector3) -> void:
	var colors := ["e07a7a", "e6a15a", "e8d46a", "8fc77a", "6fb3d6", "8a86d6", "c38ad6"]
	for i in colors.size():
		var tor := TorusMesh.new()
		tor.inner_radius = 1.25 - i * 0.12
		tor.outer_radius = 1.33 - i * 0.12
		tor.rings = 24
		tor.ring_segments = 4
		var n := _mesh(tor, p + Vector3(0, 0.15, 0), _mat(colors[i], 0.6), static_root)
		n.rotation_degrees = Vector3(90, 0, 0)


func _campfire(p: Vector3) -> void:
	var upstream: Node3D = load("res://third_party/3d-pixel-campfire/campfire_scene.tscn").instantiate()
	var fire: Node3D = upstream.get_node("Campfire")
	upstream.remove_child(fire)
	upstream.queue_free()
	fire.position = p + Vector3(0, 0.02, 0)
	fire.set("light_energy", 1.4)
	static_root.add_child(fire)
	var flame = fire.get_node_or_null("Flame")
	if flame and flame.material_override:
		flame.material_override.set_shader_parameter("march_steps", 24)


func _billboard(height_m: float) -> Sprite3D:
	var sp := Sprite3D.new()
	sp.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
	sp.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	sp.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
	sp.shaded = false
	sp.centered = true
	sp.offset = Vector2.ZERO
	sp.set_meta("height", height_m)
	root3d.add_child(sp)
	return sp


func _fit(sp: Sprite3D, tx: Texture2D) -> void:
	if tx == null:
		return
	if sp.texture != tx:
		sp.texture = tx
	var h: float = sp.get_meta("height")
	sp.pixel_size = h / float(tx.get_height())
	sp.offset = Vector2(0, tx.get_height() * 0.5)


func _process(delta: float) -> void:
	t += delta
	if world == null or world.template.is_empty():
		return
	var vs := get_viewport_rect().size
	if size != vs or position != Vector2.ZERO:
		position = Vector2.ZERO
		size = vs
		_layout()
	if built_version != world.version:
		_rebuild_static()
	camera.position = Vector3(world.me["x"], 11.0, world.me["z"] + 11.0)
	var default_tex: Texture2D = load("res://assets/world/player_front.png")
	var seen := {}
	var all := {world.me_pid: world.me}
	for pid in world.players:
		all[pid] = world.players[pid]
	for pid in all:
		seen[pid] = true
		var p: Dictionary = all[pid]
		var sp: Sprite3D = avatars.get(pid)
		if sp == null:
			sp = _billboard(1.75)
			avatars[pid] = sp
		var tx := world.texture_for(pid)
		if tx == null:
			sp.set_meta("height", 1.2)
			tx = default_tex
		else:
			sp.set_meta("height", 1.75)
		_fit(sp, tx)
		var bob := absf(sin(t * 10.0)) * 0.05 if p.get("anim", "idle") != "idle" else 0.0
		sp.position = Vector3(p["x"], bob, p["z"])
		sp.flip_h = cos(float(p.get("dir", 0.0))) < -0.2
	for pid in avatars.keys():
		if not seen.has(pid):
			avatars[pid].queue_free()
			avatars.erase(pid)
	var spirit_tex: Texture2D = load("res://assets/world/spirit_small.png")
	var nseen := {}
	for id in world.npc_view:
		nseen[id] = true
		var n: Dictionary = world.npc_view[id]
		var node: Node3D = npc_nodes.get(id)
		if node == null:
			node = _npc_node(n["species"], spirit_tex)
			npc_nodes[id] = node
		node.position = Vector3(n["x"], 0, n["z"])
	for id in npc_nodes.keys():
		if not nseen.has(id):
			npc_nodes[id].queue_free()
			npc_nodes.erase(id)
	for id in lanterns:
		var st: Dictionary = world.objects.get(id, {})
		var stage := clampi(int(st.get("stage", 0)), 0, 3)
		var sp: Sprite3D = lanterns[id]
		sp.set_meta("height", 0.6 + stage * 0.25)
		_fit(sp, stage_tex[stage])
	overlay.queue_redraw()


func _npc_node(species: String, spirit_tex: Texture2D) -> Node3D:
	if species == "Sheep" or species == "Wolf":
		var g := Node3D.new()
		var body := SphereMesh.new(); body.radius = 0.32; body.height = 0.5; body.radial_segments = 8; body.rings = 4
		_mesh(body, Vector3(0, 0.38, 0), _mat("f2efe6" if species == "Sheep" else "7f8389", 0.45), g)
		var head := BoxMesh.new(); head.size = Vector3(0.22, 0.22, 0.22)
		_mesh(head, Vector3(0.3, 0.5, 0), _mat("4b4038" if species == "Sheep" else "5f6369"), g)
		root3d.add_child(g)
		return g
	var sp := _billboard(0.9)
	_fit(sp, spirit_tex)
	return sp


func screen_to_world(screen: Vector2) -> Vector2:
	var local := (screen - global_position - picture.position) / factor
	if local.x < 0 or local.y < 0 or local.x > VIEW_SIZE.x or local.y > VIEW_SIZE.y:
		return Vector2(world.me["x"], world.me["z"])
	var origin := camera.project_ray_origin(local)
	var dir := camera.project_ray_normal(local)
	if absf(dir.y) < 0.0001:
		return Vector2(world.me["x"], world.me["z"])
	var k := -origin.y / dir.y
	var hit := origin + dir * k
	return Vector2(hit.x, hit.z)


func _draw_overlay() -> void:
	if font == null or world == null:
		return
	var now := Time.get_ticks_msec() / 1000.0
	var all := {world.me_pid: world.me}
	for pid in world.players:
		all[pid] = world.players[pid]
	for pid in all:
		var p: Dictionary = all[pid]
		var sp: Sprite3D = avatars.get(pid)
		var h: float = sp.get_meta("height") if sp else 1.75
		var top := Vector3(p["x"], h + 0.25, p["z"])
		if camera.is_position_behind(top):
			continue
		var s := camera.unproject_position(top) * factor + picture.position
		var label: String = Profile.nick if pid == world.me_pid else p.get("nick", "")
		if Profile.show_names and label != "":
			overlay.draw_string_outline(font, s + Vector2(-70, 0), label, HORIZONTAL_ALIGNMENT_CENTER, 140, 16, 5, Color(0.1, 0.12, 0.1, 0.8))
			overlay.draw_string(font, s + Vector2(-70, 0), label, HORIZONTAL_ALIGNMENT_CENTER, 140, 16, Color(1, 0.96, 0.8) if pid == world.me_pid else Color.WHITE)
		if p.get("bubble_until", 0.0) > now:
			var text: String = p["bubble"]
			var w := minf(260.0, 18.0 + text.length() * 15.0)
			var r := Rect2(s + Vector2(-w * 0.5, -58), Vector2(w, 34))
			overlay.draw_rect(r, Color(1, 1, 0.97, 0.94))
			overlay.draw_string(font, r.position + Vector2(8, 23), text.substr(0, 16), HORIZONTAL_ALIGNMENT_LEFT, w - 12, 15, Color("2f3a2c"))
		if p.get("emote_until", 0.0) > now:
			overlay.draw_string_outline(font, s + Vector2(-60, -24), p["emote"], HORIZONTAL_ALIGNMENT_CENTER, 120, 22, 6, Color(0.1, 0.1, 0.1, 0.8))
			overlay.draw_string(font, s + Vector2(-60, -24), p["emote"], HORIZONTAL_ALIGNMENT_CENTER, 120, 22, Color("ffe08a"))
