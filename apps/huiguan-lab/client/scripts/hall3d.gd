extends Control
const TrialCrow = preload("res://scripts/species_crow.gd")
## 3D pixel view: a 960x540 desktop or 480x270 lightweight SubViewport with nearest filtering,
## orthographic camera, stepped-light surface shader and the Campfire subtree from
## Wayoung7/3D-Pixel-Campfire (MIT). OCs are Y-billboards so 2D art stays readable in 3D.
## Same LabWorld as the 2D view: x/z metres map 1:1 to 3D x/z.

const TEAM_BAMBOO := "res://assets/world/team_bamboo/bamboo.tscn"
const DESKTOP_SIZE := Vector2i(960, 540)
const LIGHT_SIZE := Vector2i(480, 270)
const CreaturePose = preload("res://scripts/creature_pose.gd")
const SURFACE = preload("res://third_party/3d-pixel-campfire/surface.gdshader")
var renmo = preload("res://scripts/renmo_animation.gd").new()
var world: LabWorld
var font: Font
var viewport: SubViewport
var picture: TextureRect
var root3d: Node3D
var camera: Camera3D
var static_root: Node3D
var avatars: Dictionary = {}       # pid -> Sprite3D
var npc_nodes: Dictionary = {}
var fish_nodes: Dictionary = {}
var bird_nodes: Dictionary = {}
var frog_nodes: Dictionary = {}
var pond_disc: MeshInstance3D
var pond_label: Label3D
var pond_debris: Node3D
var pond_leaves: Node3D
var displayed_pond_stage := -1
var lanterns: Dictionary = {}
var built_version := -1
var tiles_root: Node3D
var built_tiles := -1
var overlay: Control
var factor := 1.0
var t := 0.0
var stage_tex := []
var lightweight := OS.has_feature("mobile") or OS.has_feature("web")


func setup(w: LabWorld, f: Font) -> void:
	world = w
	font = f
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)
	viewport = SubViewport.new()
	viewport.size = LIGHT_SIZE if lightweight else DESKTOP_SIZE
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
	var render_size := Vector2(viewport.size)
	var fit := minf(size.x / render_size.x, size.y / render_size.y)
	factor = fit if fit < 1.0 or fit - floorf(fit) > 0.45 else floorf(fit)
	picture.size = render_size * factor
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
	sun.shadow_enabled = not lightweight
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
	pond_disc = null
	pond_label = null
	displayed_pond_stage = -1
	if world.template.has("lily_pond"):
		_build_pond_marker()
	if not world.outskirts.is_empty():
		_build_outskirts_marker()
	var spirit: bool = world.template.get("ground", "grass") == "spirit"
	var painted: bool = world.template.has("painted_ground")
	var painted_only: bool = painted and not world.template.has("grass_rect")
	built_tiles = -1
	var size2 := world.bmax - world.bmin + Vector2(1, 1)
	var plane := PlaneMesh.new()
	plane.size = size2
	var ground_material: Material = _mat("7c7fb6", 0.35)
	if not spirit:
		var grass := StandardMaterial3D.new()
		grass.albedo_texture = preload("res://assets/world/grass_day.png")
		grass.uv1_scale = Vector3(size2.x / 6.0, size2.y / 6.0, 1)
		grass.roughness = 1.0
		ground_material = grass
	_mesh(plane, Vector3((world.bmin.x + world.bmax.x) * 0.5, 0, (world.bmin.y + world.bmax.y) * 0.5),
		ground_material, static_root)
	_build_outskirts_path()
	var outer := PlaneMesh.new()
	outer.size = size2 + Vector2(40, 40)
	_mesh(outer, Vector3((world.bmin.x + world.bmax.x) * 0.5, -0.05, (world.bmin.y + world.bmax.y) * 0.5),
		_mat("4d6b4c" if not spirit else "3d3c66", 0.3), static_root)
	if painted:
		var ms: Array = world.template["painted_size"]
		var ground := PlaneMesh.new()
		ground.size = Vector2(ms[0], ms[1])
		var material := StandardMaterial3D.new()
		material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		material.albedo_texture = load(world.template["painted_ground"])
		var origin: Array = world.template.get("painted_origin", [0, 0])
		_mesh(ground, Vector3(float(origin[0]) + ms[0] * .5, .03, float(origin[1]) + ms[1] * .5), material, static_root)
	for d in world.template.get("decor", []):
		var sp := _billboard(float(d["height"]))
		root3d.remove_child(sp)
		static_root.add_child(sp)
		sp.position = Vector3(d["position"][0], .04, d["position"][2])
		_fit(sp, world.art_texture(d["asset"]))
	var past: Dictionary = world.template.get("pasture", {})
	if not past.is_empty() and not spirit and not painted_only:
		var pm := PlaneMesh.new()
		pm.size = Vector2(past["cell_step"][0] * past["cells"][0] + 0.6, past["cell_step"][2] * past["cells"][1] + 0.6)
		_mesh(pm, Vector3(past["origin"][0] - 0.6 + pm.size.x * 0.5, 0.01, past["origin"][2] - 0.6 + pm.size.y * 0.5), _mat("a7b878", 0.35), static_root)
	for ob in world.template["obstacles"]:
		var p := Vector3(ob["position"][0], 0, ob["position"][2])
		var r := float(ob["radius"])
		match ob["kind"]:
			"tree":
				if spirit:
					_spirit_tree(p, 3.6 + r, int(p.x) % 4)
				else:
					var model := "tree_pineTallA" if r < 0.8 else "tree_oak"
					var tree := _nature_prop(model, p, Vector3.ONE * (2.8 + r))
					tree.rotation.y = p.x
			"rock":
				_nature_prop("rock_largeA", p, Vector3.ONE * (r * 2.2))
			"water":
				var c := CylinderMesh.new(); c.top_radius = r; c.bottom_radius = r; c.height = 0.04; c.radial_segments = 20
				_mesh(c, p + Vector3(0, 0.02, 0), _mat("5f9aa6" if not spirit else "8a86d6", 0.5), static_root)
			"gate": _gate(p)
			"campfire": _campfire(p)
	if world.river.has_area():
		var river_center := world.river.get_center()
		var water := PlaneMesh.new()
		water.size = world.river.size
		var ripple := ShaderMaterial.new()
		ripple.shader = preload("res://shaders/river.gdshader")
		_mesh(water, Vector3(river_center.x, 0.025, river_center.y), ripple, static_root)
		var center := world.bridge.get_center()
		var bridge := _nature_prop("bridge_wood", Vector3(center.x, 0.02, center.y),
			Vector3(world.bridge.size.x + 0.45, 0.75, world.bridge.size.y))
		bridge.name = "EastFootbridge"
		_build_east_bank_landmarks()
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
			"game_pavilion", "game_relay":
				var pedestal := CylinderMesh.new()
				pedestal.top_radius = 0.11
				pedestal.bottom_radius = 0.25
				pedestal.height = 0.95
				_mesh(pedestal, p + Vector3(0, 0.48, 0), _mat("544c39"), static_root)
				var light := SphereMesh.new()
				light.radius = 0.27
				light.height = 0.58
				_mesh(light, p + Vector3(0, 1.2, 0), _mat("9df1c3" if o["kind"] == "game_relay" else "ffd790"), static_root)
				var nameplate := Label3D.new()
				nameplate.text = o["name"]
				nameplate.font = font
				nameplate.font_size = 28
				nameplate.pixel_size = 0.006
				nameplate.position = p + Vector3(0, 1.65, 0)
				nameplate.billboard = BaseMaterial3D.BILLBOARD_ENABLED
				static_root.add_child(nameplate)


## Dirt-path tiles as flat quads on the ground: one MultiMesh for the dirt, one per grass-edge side.
func _rebuild_tiles() -> void:
	built_tiles = world.tiles_version
	if tiles_root:
		tiles_root.queue_free()
	tiles_root = Node3D.new()
	root3d.add_child(tiles_root)
	var art: Dictionary = world.spec.get("paths", {}).get("art", {}).get("dirt", {})
	if art.is_empty() or world.tiles.is_empty():
		return
	var pattern: String = art["tiles"]
	var by_mask := {}
	var dual := world.dual_tiles()
	for t in dual:
		if not by_mask.has(dual[t]):
			by_mask[dual[t]] = []
		by_mask[dual[t]].append(Vector2(t.x, t.y))
	for m in by_mask:
		_flat_multimesh(load(pattern % m), Vector2(1, 1), by_mask[m], 0.04)


func _flat_multimesh(texture: Texture2D, size: Vector2, centers: Array, y: float) -> void:
	if texture == null or centers.is_empty():
		return
	var plane := PlaneMesh.new()
	plane.size = size
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_texture = texture
	material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	material.alpha_scissor_threshold = 0.4
	plane.material = material
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = plane
	mm.instance_count = centers.size()
	for i in centers.size():
		var c: Vector2 = centers[i]
		mm.set_instance_transform(i, Transform3D(Basis(), Vector3(c.x, y, c.y)))
	var node := MultiMeshInstance3D.new()
	node.multimesh = mm
	tiles_root.add_child(node)


func _nature_prop(model: String, foot: Vector3, model_scale: Vector3) -> Node3D:
	var scene: PackedScene = load("res://third_party/kenney-nature/%s.glb" % model)
	var prop: Node3D = scene.instantiate()
	prop.scale = model_scale
	prop.position = foot
	static_root.add_child(prop)
	return prop


## Painted 2D and world authority stay untouched. Visual-only accents sit outside the crossing.
func _build_east_bank_landmarks() -> void:
	var west := world.river.position.x
	var east := world.river.end.x
	var bridge_z := world.bridge.get_center().y
	var sign := _nature_prop("sign", Vector3(west - 1.4, .16, bridge_z + 2.2), Vector3.ONE * 3.2)
	sign.name = "EastBankWoodSign"
	sign.rotation_degrees.y = -12.0
	var text := Label3D.new()
	text.text = "东岸"
	text.font = font
	text.font_size = 26
	text.pixel_size = .015
	text.outline_size = 4
	text.outline_modulate = Color("342418")
	text.modulate = Color("fff0c2")
	text.position = Vector3(west - 1.4, 1.26, bridge_z + 2.36)
	text.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	text.no_depth_test = true
	static_root.add_child(text)
	for n: int in 2:
		var bamboo: Node3D
		var p := Vector3(east + 2.6 + float(n) * 1.9, 0.02, bridge_z - (2.6 if n == 0 else 4.0))
		if lightweight or not ResourceLoader.exists(TEAM_BAMBOO):
			var scale := 1.85 if n == 0 else 1.55
			bamboo = _nature_prop("crops_bambooStageB", p + Vector3(0, .05 * scale, 0), Vector3.ONE * scale)
		else:
			bamboo = (load(TEAM_BAMBOO) as PackedScene).instantiate() as Node3D
			bamboo.position = p
			bamboo.scale = Vector3.ONE * (0.48 if n == 0 else 0.41)
			static_root.add_child(bamboo)
		bamboo.name = "EastBankBamboo%d" % n
		bamboo.rotation_degrees.y = 14.0 + float(n) * 63.0
		var lily_scale := 3.1 if n == 0 else 2.5
		var lily := _nature_prop("lily_large",
			Vector3(west + .85 if n == 0 else east - .85, .034 + .05 * lily_scale,
				bridge_z - 3.3 if n == 0 else bridge_z + 3.5),
			Vector3.ONE * lily_scale)
		lily.name = "EastBankWaterlily%d" % n
		lily.rotation_degrees.y = 40.0 + float(n) * 83.0
		for mesh: MeshInstance3D in lily.find_children("*", "MeshInstance3D", true, false):
			mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


func _spirit_tree(p: Vector3, height: float, tint: int) -> void:
	var trunk := CylinderMesh.new()
	trunk.top_radius = 0.15; trunk.bottom_radius = 0.28; trunk.height = height * 0.7; trunk.radial_segments = 6
	_mesh(trunk, p + Vector3(0, height * 0.35, 0), _mat("78684c"), static_root)
	var colors := ["8c8fd6", "a49ad8", "7a86c8", "b7a6e0"]
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
	fire.owner = null
	for child in fire.get_children():
		child.owner = null
	upstream.remove_child(fire)
	upstream.queue_free()
	fire.position = p + Vector3(0, 0.02, 0)
	fire.set("light_energy", 1.4)
	static_root.add_child(fire)
	var light := fire.get_node("Light") as OmniLight3D
	light.shadow_enabled = not lightweight
	var flame = fire.get_node_or_null("Flame")
	if flame and flame.material_override:
		flame.material_override.set_shader_parameter("march_steps", 10 if lightweight else 24)


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


func _sync_face_layers(sp: Sprite3D, p: Dictionary, active: bool) -> void:
	## Face features (eyes / brows / mouth) are separate small atlases drawn over the body billboard.
	var holders: Array = sp.get_meta("face_layers", [])
	var layers: Array = renmo.layers_for(p, t) if active else []
	while holders.size() < layers.size():
		var c := Sprite3D.new()
		c.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
		c.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
		c.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
		c.shaded = false
		c.centered = true
		var mat := ShaderMaterial.new()
		mat.shader = preload("res://shaders/renmo_colors_3d.gdshader")
		mat.render_priority = 1
		c.material_override = mat
		sp.add_child(c)
		holders.append(c)
	sp.set_meta("face_layers", holders)
	var toward_camera := (camera.global_position - sp.global_position).normalized() * 0.02
	for i in holders.size():
		var c: Sprite3D = holders[i]
		c.visible = i < layers.size()
		if not c.visible:
			continue
		var layer: Dictionary = layers[i]
		var r: Rect2 = layer.rect
		c.texture = layer.tex
		c.pixel_size = sp.pixel_size
		c.flip_h = sp.flip_h
		var cx: float = r.position.x + r.size.x * 0.5 - renmo.FW * 0.5
		var cy: float = r.position.y + r.size.y * 0.5 - renmo.FH * 0.5
		c.offset = sp.offset + Vector2(-cx if sp.flip_h else cx, -cy)
		c.position = toward_camera
		var mat: ShaderMaterial = c.material_override
		mat.set_shader_parameter("atlas", layer.tex.atlas)
		mat.set_shader_parameter("mask_atlas", layer.tex.atlas)
		mat.set_shader_parameter("palette_tex", RenmoColors.texture)
		mat.set_shader_parameter("palette_row", sp.material_override.get_shader_parameter("palette_row") if sp.material_override else 0.0)


func _fit(sp: Sprite3D, tx: Texture2D, offset_height := 0.5) -> void:
	if tx == null:
		return
	if sp.texture != tx:
		sp.texture = tx
	var texture_height := float(tx.get_height())
	var pixel_size := float(sp.get_meta("height")) / texture_height
	var offset := Vector2(0.0, texture_height * offset_height)
	# Stable sprites should not repeatedly submit identical geometry to RenderingServer.
	if not is_equal_approx(sp.pixel_size, pixel_size):
		sp.pixel_size = pixel_size
	if sp.offset != offset:
		sp.offset = offset


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
	if built_tiles != world.tiles_version:
		_rebuild_tiles()
	var focus := world.view_center()
	camera.position = Vector3(focus.x, 11.0, focus.y + 11.0)
	_sync_trial_fish(delta)
	_sync_trial_birds(delta)
	_sync_trial_frogs(delta)
	_sync_pond_marker()
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
		var uses_renmo := tx == null
		if uses_renmo:
			sp.set_meta("height", 1.75 / 0.76)
			if pid == world.me_pid: p["face"] = Profile.face
			tx = renmo.texture_for(p, t)
			if sp.material_override == null:
				var mat := ShaderMaterial.new()
				mat.shader = preload("res://shaders/renmo_colors_3d.gdshader")
				sp.material_override = mat
			var colors: Dictionary = Profile.part_colors if pid == world.me_pid else p.get("part_colors",{})
			var row := RenmoColors.row_for(pid,colors)
			sp.material_override.set_shader_parameter("atlas",tx.atlas)
			sp.material_override.set_shader_parameter("mask_atlas",tx.atlas)
			sp.material_override.set_shader_parameter("palette_tex",RenmoColors.texture)
			sp.material_override.set_shader_parameter("palette_row",(row+0.5)/128.0)
		else:
			sp.material_override = null
			sp.set_meta("height", 1.75)
		_fit(sp, tx, 0.34 if uses_renmo else 0.5)
		var bob := absf(sin(t * 10.0)) * 0.05 if p.get("anim", "idle") != "idle" else 0.0
		sp.position = Vector3(p["x"], 0.0 if uses_renmo else bob, p["z"])
		sp.flip_h = cos(float(p.get("dir", 0.0))) < -0.2
		_sync_face_layers(sp, p, uses_renmo)
	for pid in avatars.keys():
		if not seen.has(pid):
			avatars[pid].queue_free()
			avatars.erase(pid)
	var spirit_tex := preload("res://assets/world/spirit_small.png")
	var npc_time := world.npc_time()
	var nseen := {}
	for id in world.npc_view:
		nseen[id] = true
		var n: Dictionary = world.npc_view[id]
		var node: Node3D = npc_nodes.get(id)
		var art := world.art_texture(n.get("asset", ""))
		var has_art: bool = n.get("asset", "") != ""
		if node != null and bool(node.get_meta("shared_art", false)) != has_art:
			node.queue_free()
			node = null
		if node == null:
			node = _billboard(1.0) if has_art else _npc_node(n["species"], spirit_tex)
			node.set_meta("shared_art", has_art)
			npc_nodes[id] = node
		if has_art and art != null:
			var h := float(n.get("height", 1.0))
			if n.has("stages") and not n["stages"].is_empty(): h *= 0.45 + float(n.get("stage", 0)) * 0.275
			node.set_meta("height", h)
			_fit(node, art)
			node.flip_h = n.get("kind", "creature") == "creature" and cos(float(n.get("heading", 0))) < -0.2
		var pose := CreaturePose.sample(n, npc_time)
		node.position = Vector3(n["x"], pose["lift"], n["z"])
		node.scale = Vector3(pose["stretch"].x, pose["stretch"].y, 1.0)
		if node is Sprite3D: node.rotation.z = pose["angle"]
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


func _sync_trial_fish(delta: float) -> void:
	for pid in fish_nodes.keys():
		if world.species_trials.get(pid, {}).get("form") != "fish":
			fish_nodes[pid].queue_free()
			fish_nodes.erase(pid)
	for pid in world.species_trials:
		var trial: Dictionary = world.species_trials[pid]
		if trial.get("form") != "fish":
			continue
		var target := Vector3(trial["x"], trial["y"], trial["z"])
		var fish: Sprite3D = fish_nodes.get(pid)
		if fish == null:
			fish = Sprite3D.new()
			fish.texture = preload("res://assets/world/species_trial_fish.svg")
			fish.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
			fish.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			fish.pixel_size = 0.021
			fish.no_depth_test = true # Readable through the otherwise opaque water surface.
			root3d.add_child(fish)
			fish.position = target
			fish_nodes[pid] = fish
		fish.position = fish.position.lerp(target, 1.0 - exp(-delta * 16.0))
		fish.flip_h = cos(float(trial["dir"])) < 0
		fish.modulate = Color(0.57, 0.82, 0.90, 0.86) if target.y < 0.0 else Color.WHITE
		# Its true transform remains below floor; never let the through-water pass paint over the deck.
		fish.visible = not world.bridge.has_point(Vector2(fish.position.x, fish.position.z))

func _sync_trial_birds(delta: float) -> void:
	for pid in bird_nodes.keys():
		if world.species_trials.get(pid, {}).get("form") != "bird":
			bird_nodes[pid].queue_free()
			bird_nodes.erase(pid)
	for pid in world.species_trials:
		var trial: Dictionary = world.species_trials[pid]
		if trial.get("form") != "bird":
			continue
		var target := Vector3(trial["x"], trial["y"], trial["z"])
		var bird: AnimatedSprite3D = bird_nodes.get(pid)
		if bird == null:
			bird = AnimatedSprite3D.new()
			bird.sprite_frames = TrialCrow.frames()
			bird.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
			bird.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
			bird.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
			bird.pixel_size = 0.025
			bird.offset.y = 9.0
			root3d.add_child(bird)
			bird.position = target
			bird_nodes[pid] = bird
		bird.position = bird.position.lerp(target, 1.0 - exp(-16.0 * delta))
		bird.animation = trial["flight"]
		bird.frame = TrialCrow.frame_number(trial["flight"])
		bird.flip_h = cos(float(trial["dir"])) < 0

func _build_outskirts_marker() -> void:
	var entry: Array = world.outskirts["entry"]
	var x: float = entry[0]
	var z: float = entry[1]
	var post := BoxMesh.new()
	post.size = Vector3(.14, 1.35, .14)
	_mesh(post, Vector3(x, .67, z), _mat("685441"), static_root)
	var sign := BoxMesh.new()
	sign.size = Vector3(.75, .29, .17)
	_mesh(sign, Vector3(x, 1.25, z), _mat("dbb372"), static_root)
	var label := Label3D.new()
	label.text = "回会馆" if world.outskirts["destination"] == "hall" else "松风径"
	label.font = font
	label.font_size = 30
	label.pixel_size = .015
	label.no_depth_test = true
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.position = Vector3(x, 1.65, z)
	static_root.add_child(label)

func _build_outskirts_path() -> void:
	var route: Array = world.template.get("route", [])
	if route.size() < 2:
		return
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in range(route.size() - 1):
		var a := Vector2(route[i][0], route[i][1])
		var b := Vector2(route[i + 1][0], route[i + 1][1])
		for p: Vector2 in [a + Vector2(0, -.85), b + Vector2(0, -.85), a + Vector2(0, .85),
			a + Vector2(0, .85), b + Vector2(0, -.85), b + Vector2(0, .85)]:
			surface.set_normal(Vector3.UP)
			surface.add_vertex(Vector3(p.x, .035, p.y))
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("a88b66")
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	var node := _mesh(surface.commit(), Vector3.ZERO, material, static_root)
	node.name = "SeededTrailPath"
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func _build_pond_marker() -> void:
	var p := world.pond_position()
	var disc := CylinderMesh.new()
	disc.height = .10
	disc.top_radius = .78
	disc.bottom_radius = .76
	disc.radial_segments = 16
	pond_disc = _mesh(disc, Vector3(p.x, .073, p.y), _mat("96715c", .6), static_root)
	pond_disc.name = "EastBankPondMarker"
	pond_label = Label3D.new()
	pond_label.font = font
	pond_label.font_size = 38
	pond_label.pixel_size = .022
	pond_label.no_depth_test = true
	pond_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	pond_label.position = Vector3(p.x, 1.16, p.y)
	static_root.add_child(pond_label)
	pond_debris = Node3D.new()
	pond_leaves = Node3D.new()
	static_root.add_child(pond_debris)
	static_root.add_child(pond_leaves)
	for i in 2:
		var rock := BoxMesh.new()
		rock.size = Vector3(.23, .14, .20)
		_mesh(rock, Vector3(p.x - .38 + i * .64, .17, p.y - .1 + i * .25), _mat("583a2e"), pond_debris)
		var leaf := CylinderMesh.new()
		leaf.radial_segments = 8
		leaf.top_radius = .24
		leaf.bottom_radius = .23
		leaf.height = .06
		_mesh(leaf, Vector3(p.x - .33 + i * .62, .18, p.y + .19 - i * .4), _mat("85b162"), pond_leaves)
	_sync_pond_marker()

func _sync_pond_marker() -> void:
	if pond_disc == null or pond_label == null:
		return
	var phase := world.pond_stage()
	if displayed_pond_stage == phase:
		return
	displayed_pond_stage = phase
	pond_disc.material_override = _mat("76a998" if phase >= 2 else "96715c", .6)
	pond_label.text = "%d/3" % phase
	pond_debris.visible = phase < 2
	pond_leaves.visible = phase == 3

func _sync_trial_frogs(delta: float) -> void:
	for pid in frog_nodes.keys():
		if world.species_trials.get(pid, {}).get("form") != "frog":
			for part in frog_nodes[pid].values():
				part.queue_free()
			frog_nodes.erase(pid)
	for pid in world.species_trials:
		var trial: Dictionary = world.species_trials[pid]
		if trial.get("form") != "frog":
			continue
		var target := Vector3(trial["x"], trial["y"], trial["z"])
		if not frog_nodes.has(pid):
			var body := _billboard(.62)
			_fit(body, world.art_texture("b_frog"))
			body.position = target
			var bug := SphereMesh.new()
			bug.radius = .09
			bug.height = .18
			bug.radial_segments = 6
			bug.rings = 3
			var cylinder := CylinderMesh.new()
			cylinder.top_radius = .046
			cylinder.bottom_radius = .045
			cylinder.height = 1.0
			cylinder.radial_segments = 6
			frog_nodes[pid] = {"body": body, "bug": _mesh(bug, Vector3.ZERO, _mat("ffe17f", 0.9), root3d),
				"tongue": _mesh(cylinder, Vector3.ZERO, _mat("fa6b9c", 0.8), root3d)}
		var parts: Dictionary = frog_nodes[pid]
		var body: Sprite3D = parts["body"]
		body.position = body.position.lerp(target, 1.0 - exp(-16.0 * delta))
		body.flip_h = cos(float(trial["dir"])) < 0
		parts["bug"].position = Vector3(trial["insect"][0], .3 + sin(t * 8.0) * .05, trial["insect"][1])
		parts["bug"].visible = not trial.get("fed", false)
		var tongue := world.tongue_geometry(str(pid))
		var mesh: MeshInstance3D = parts["tongue"]
		mesh.visible = not tongue.is_empty()
		if mesh.visible:
			var a: Vector2 = tongue["from"]
			var b: Vector2 = tongue["end"]
			var from := Vector3(a.x, .27, a.y)
			var end := Vector3(b.x, .27, b.y)
			var beam := end - from
			var length := beam.length()
			if length > .005:
				mesh.transform = Transform3D(Basis(Quaternion(Vector3.UP, beam / length)).scaled_local(Vector3(1.0, length, 1.0)), (from + end) * .5)
			else:
				mesh.visible = false

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
	if local.x < 0 or local.y < 0 or local.x > viewport.size.x or local.y > viewport.size.y:
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
