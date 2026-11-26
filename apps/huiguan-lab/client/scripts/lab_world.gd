class_name LabWorld
extends RefCounted
## Client mirror of the authoritative world: same metric geometry as the server (data/spaces.json),
## remote players buffered for interpolation, OC textures cached by digest.
## Both the 2D and the 3D view render from this one object.

const INTERP_DELAY := 0.12
const NPC_DELAY := 0.18
const PLAYER_SNAPSHOT_DELAY := 0.22 # up to two 10 Hz packets arriving together

var spec: Dictionary = {}
var template: Dictionary = {}
var species_trials: Dictionary = {}
var species_enabled := false
var outskirts: Dictionary = {}
var authoritative_position := Vector2.ZERO

func pond_stage() -> int:
	var data: Dictionary = template.get("lily_pond", {})
	return clampi(int(objects.get(data.get("id", ""), {}).get("stage", 0)), 0, 3)

func pond_position() -> Vector2:
	var p: Array = template.get("lily_pond", {}).get("position", [0, 0, 0])
	return Vector2(p[0], p[2])

func pond_in_range() -> bool:
	var data: Dictionary = template.get("lily_pond", {})
	if data.is_empty():
		return false
	var pilot := local_trial()
	if pilot.is_empty():
		return view_center().distance_to(pond_position()) <= float(data["radius"])
	var fish: bool = pilot.get("form") == "fish" and pilot.get("depth") == "dive"
	var bird: bool = pilot.get("form") == "bird" and pilot.get("flight") == "flying"
	return pond_stage() == 0 and (fish or bird) and view_center().distance_to(pond_position()) <= float(data["survey_radius"])

var species_effects: Dictionary = {}

func tongue_geometry(pid: String) -> Dictionary:
	var effect: Dictionary = species_effects.get(pid, {})
	if effect.is_empty():
		return {}
	var remaining := (float(effect["expires"]) - Time.get_ticks_msec()) / 320.0
	if remaining <= 0.0:
		species_effects.erase(pid)
		return {}
	var base := Vector2(effect["x"], effect["z"])
	var target := Vector2(effect["end_x"], effect["end_z"])
	return {"from": base, "end": base.lerp(target, sin((1.0 - remaining) * PI)), "hit": effect["hit"]}


func local_trial() -> Dictionary:
	return species_trials.get(me_pid, {})

func view_center() -> Vector2:
	var pilot := local_trial()
	return Vector2(pilot["x"], pilot["z"]) if not pilot.is_empty() else Vector2(me["x"], me["z"])

var space: Dictionary = {}
var me_pid := ""
var me := {"x": 0.0, "z": 0.0, "dir": 0.0, "anim": "idle"}
var players: Dictionary = {}        # pid -> {nick, oc, samples:[[t,x,z,dir]], x, z, dir, anim, emote, emote_until, bubble, bubble_until}
var npcs: Array = []
var npc_view: Dictionary = {}       # id -> {x, z, tx, tz, species}
var npc_seq := -1
var npc_clock_offset := INF
var player_clock_offset := INF
var objects: Dictionary = {}
var clock: Dictionary = {}
var textures: Dictionary = {}       # digest -> Texture2D
var oc_digest: Dictionary = {}      # pid -> digest
var my_texture: Texture2D = null
var art_textures: Dictionary = {}
var requested_art: Dictionary = {}
var art_catalog: Array = []
var radius := 0.3
var obstacles: Array = []
var bmin := Vector2.ZERO
var bmax := Vector2.ONE
var river := Rect2()
var bridge := Rect2()
var version := 0                    # bumps when the space changes so views rebuild
var tiles: Dictionary = {}          # Vector2i(cell x, cell z) -> {"kind", "by"}; cell covers [x, x+1) x [z, z+1) metres
var tiles_version := 0              # bumps whenever a tile is placed or lifted
var _dual: Dictionary = {}
var _dual_version := -1


func _init() -> void:
	var f := FileAccess.open("res://data/spaces.json", FileAccess.READ)
	spec = JSON.parse_string(f.get_as_text())
	radius = float(spec["player"]["radius"])
	var art_file := FileAccess.open("res://data/art-catalog.json", FileAccess.READ)
	if art_file:
		art_catalog = JSON.parse_string(art_file.get_as_text())


func set_space(info: Dictionary) -> void:
	space = info
	species_trials.clear()
	species_effects.clear()
	species_enabled = false
	outskirts.clear()
	template = info.get("layout", spec["templates"].get(info.get("template", "hall"), spec["templates"]["hall"]))
	bmin = Vector2(template["bounds"]["min"][0], template["bounds"]["min"][2])
	bmax = Vector2(template["bounds"]["max"][0], template["bounds"]["max"][2])
	river = Rect2()
	bridge = Rect2()
	if template.has("river_crossing"):
		var crossing: Dictionary = template["river_crossing"]
		var channel: Array = crossing["channel"]
		var deck: Array = crossing["deck_z"]
		river = Rect2(channel[0], channel[1], channel[2], channel[3])
		bridge = Rect2(river.position.x, deck[0], river.size.x, float(deck[1]) - float(deck[0]))
	obstacles = []
	for o in template["obstacles"]:
		obstacles.append([Vector2(o["position"][0], o["position"][2]), float(o["radius"]) + radius])
	players.clear()
	player_clock_offset = INF
	npc_view.clear()
	npc_seq = -1
	npc_clock_offset = INF
	tiles.clear()
	tiles_version += 1
	version += 1


## Whole map in metres: the hall's grass plus the painted home field to the north.
func map_rect() -> Rect2:
	if template.has("map_rect"):
		var r: Array = template["map_rect"]
		return Rect2(r[0], r[1], r[2], r[3])
	if template.has("painted_size"):
		var o: Array = template.get("painted_origin", [0, 0])
		var s: Array = template["painted_size"]
		return Rect2(o[0], o[1], s[0], s[1])
	return Rect2(bmin - Vector2(0.5, 0.5), bmax - bmin + Vector2(1, 1))


func set_tiles(list: Array) -> void:
	tiles.clear()
	for t in list:
		tiles[Vector2i(int(t[0]), int(t[1]))] = {"kind": t[2], "by": t[3]}
	tiles_version += 1


func set_tile(x: int, z: int, on: bool, kind: String, by: String) -> void:
	var key := Vector2i(x, z)
	if on:
		tiles[key] = {"kind": kind, "by": by}
	else:
		tiles.erase(key)
	tiles_version += 1


static func cell_of(p: Vector2) -> Vector2i:
	return Vector2i(floori(p.x), floori(p.y))


## True when this player may lift the tile: their own, one the LAB laid, or any tile in their own space.
func can_lift(cell: Vector2i) -> bool:
	if not tiles.has(cell):
		return false
	var by: String = tiles[cell]["by"]
	return by == me_pid or by == "lab" or str(space.get("owner", "")) == me_pid


func free_at(p: Vector2) -> bool:
	if p.x < bmin.x or p.y < bmin.y or p.x > bmax.x or p.y > bmax.y:
		return false
	if river.has_point(p) and not bridge.has_point(p):
		return false
	for polygon in template.get("blocked_polygons", []):
		var points := PackedVector2Array()
		for v in polygon:
			points.append(Vector2(v[0], v[1]))
		if Geometry2D.is_point_in_polygon(p, points):
			return false
	for o in obstacles:
		if p.distance_to(o[0]) < o[1]:
			return false
	return true


func step_toward(from: Vector2, wish: Vector2) -> Vector2:
	## Move with sliding along obstacles, mirroring the server's segment check.
	var target := from + wish
	if free_at(target):
		return target
	var slide_x := from + Vector2(wish.x, 0)
	if free_at(slide_x):
		return slide_x
	var slide_z := from + Vector2(0, wish.y)
	if free_at(slide_z):
		return slide_z
	return from


func upsert_player(p: Dictionary) -> void:
	var pid: String = p["pid"]
	if pid == me_pid:
		return
	var now := Time.get_ticks_msec() / 1000.0
	var cur: Dictionary = players.get(pid, {"samples": [], "emote": "", "emote_until": 0.0, "bubble": "", "bubble_until": 0.0})
	cur["part_colors"] = p.get("part_colors",cur.get("part_colors",{}))
	cur["face"] = p.get("face",cur.get("face",{}))
	cur["nick"] = p.get("nick", cur.get("nick", ""))
	cur["x"] = float(p.get("x", cur.get("x", 0.0)))
	cur["z"] = float(p.get("z", cur.get("z", 0.0)))
	cur["dir"] = float(p.get("dir", 0.0))
	cur["anim"] = p.get("anim", "idle")
	var stamp := now if is_inf(player_clock_offset) else now - player_clock_offset - PLAYER_SNAPSHOT_DELAY
	cur["samples"] = [[stamp, cur["x"], cur["z"], cur["dir"]]]
	if p.has("oc"):
		oc_digest[pid] = p["oc"]
	players[pid] = cur


func apply_snapshot(rows: Array, server_time := -1.0, received_at := -1.0) -> void:
	var now := Time.get_ticks_msec() / 1000.0 if received_at < 0.0 else received_at
	var stamp := now
	if server_time >= 0.0:
		if is_inf(player_clock_offset):
			# Welcome and older gateways use local arrival times; don't mix their time domain.
			for p: Dictionary in players.values():
				p["samples"].clear()
		player_clock_offset = minf(player_clock_offset, now - server_time)
		stamp = server_time
	elif not is_inf(player_clock_offset):
		stamp = now - player_clock_offset
	for r in rows:
		var pid: String = r[0]
		if pid == me_pid:
			authoritative_position = Vector2(float(r[1]), float(r[2]))
			continue
		if not players.has(pid):
			continue
		var cur: Dictionary = players[pid]
		var samples: Array = cur["samples"]
		if server_time >= 0.0 and not samples.is_empty() and stamp <= float(samples[-1][0]):
			continue
		samples.append([stamp, float(r[1]), float(r[2]), float(r[3])])
		while samples.size() > 12:
			samples.pop_front()
		cur["anim"] = r[4]


func interpolate(now: float = -1.0) -> void:
	if now < 0.0:
		now = Time.get_ticks_msec() / 1000.0
	var t := now - INTERP_DELAY if is_inf(player_clock_offset) else now - player_clock_offset - PLAYER_SNAPSHOT_DELAY
	for pid in players:
		var cur: Dictionary = players[pid]
		var s: Array = cur["samples"]
		if s.is_empty():
			continue
		if s.size() == 1 or t <= s[0][0]:
			cur["x"] = s[0][1]; cur["z"] = s[0][2]; cur["dir"] = s[0][3]
			continue
		var done := false
		for i in range(s.size() - 1):
			var a: Array = s[i]
			var b: Array = s[i + 1]
			if t >= a[0] and t <= b[0]:
				var k: float = (t - float(a[0])) / maxf(0.0001, float(b[0]) - float(a[0]))
				cur["x"] = lerpf(a[1], b[1], k); cur["z"] = lerpf(a[2], b[2], k); cur["dir"] = b[3]
				done = true
				break
		if not done:
			var last: Array = s[s.size() - 1]
			cur["x"] = last[1]; cur["z"] = last[2]; cur["dir"] = last[3]
	interpolate_npcs(Time.get_ticks_msec() / 1000.0)


func apply_npc_motion(packet: Dictionary, received_at: float = -1.0) -> void:
	if packet.get("space", "") != space.get("id", "") or int(packet.get("seq", -1)) <= npc_seq:
		return
	npc_seq = int(packet["seq"])
	var now := Time.get_ticks_msec() / 1000.0 if received_at < 0 else received_at
	var stamp := float(packet["time"])
	npc_clock_offset = minf(npc_clock_offset, now - stamp)
	for row: Array in packet["motions"]:
		if not npc_view.has(str(row[0])): continue
		var n: Dictionary = npc_view[str(row[0])]
		var samples: Array = n.get("samples", [])
		if not samples.is_empty() and stamp <= float(samples[-1][0]): continue
		if not samples.is_empty() and Vector2(row[1], row[2]).distance_to(Vector2(samples[-1][1], samples[-1][2])) > 3.0:
			samples.clear()
		samples.append([stamp, float(row[1]), float(row[2]), float(row[3]), str(row[4]), float(row[5])])
		while samples.size() > 16: samples.pop_front()
		n["samples"] = samples
		n["motion_received"] = now


func interpolate_npcs(now: float) -> void:
	var render_time := now - npc_clock_offset - NPC_DELAY
	for id in npc_view:
		var n: Dictionary = npc_view[id]
		var samples: Array = n.get("samples", [])
		if samples.is_empty():
			# Legacy / Mesa projections retain their confirmed targets without invented movement.
			var last: float = n.get("rendered_at", now)
			var weight := 1.0 - exp(-8.0 * maxf(0.0, now - last))
			n["x"] = lerpf(n["x"], n["tx"], weight)
			n["z"] = lerpf(n["z"], n["tz"], weight)
		else:
			var a: Array = samples[0]
			var b: Array = a
			for sample: Array in samples:
				if float(sample[0]) <= render_time: a = sample
				b = sample
				if float(sample[0]) >= render_time: break
			var k := clampf((render_time - float(a[0])) / maxf(0.00001, float(b[0])-float(a[0])), 0.0, 1.0)
			n["x"] = lerpf(a[1], b[1], k)
			n["z"] = lerpf(a[2], b[2], k)
			n["heading"] = lerp_angle(a[3], b[3], k)
			n["action"] = a[4]
			n["visual_speed"] = a[5] if a[4] in ["walk", "retreat"] and now - float(n.get("motion_received", now)) < 0.4 else 0.0
		n["rendered_at"] = now


func npc_time() -> float:
	var now := Time.get_ticks_msec() / 1000.0
	return now - npc_clock_offset - NPC_DELAY if is_finite(npc_clock_offset) else now


func set_npcs(list: Array) -> void:
	var seen := {}
	for n in list:
		var id: String = n["id"]
		seen[id] = true
		if npc_view.has(id):
			npc_view[id]["tx"] = float(n["x"]); npc_view[id]["tz"] = float(n["z"])
		else:
			npc_view[id] = {"x": float(n["x"]), "z": float(n["z"]), "tx": float(n["x"]), "tz": float(n["z"]), "species": n["species"]}
		for key in n:
			if key != "x" and key != "z":
				if key == "heading" and not npc_view[id].get("samples", []).is_empty(): continue
				npc_view[id][key] = n[key]
	for id in npc_view.keys():
		if not seen.has(id):
			npc_view.erase(id)


func art_texture(aid: String) -> Texture2D:
	if aid == "":
		return null
	if art_textures.has(aid):
		return art_textures[aid]
	for a in art_catalog:
		if a["id"] == aid:
			art_textures[aid] = load(a["path"])
			return art_textures[aid]
	return null


func texture_for(pid: String) -> Texture2D:
	if pid == me_pid:
		return my_texture
	var d = oc_digest.get(pid, null)
	if d == null:
		return null
	return textures.get(d, null)


static func texture_from_png(png: PackedByteArray) -> Texture2D:
	var img := Image.new()
	if png.size() < 12:
		return null
	var err := ERR_FILE_UNRECOGNIZED
	if png[0] == 0x89 and png[1] == 0x50:
		err = img.load_png_from_buffer(png)
	elif png[0] == 0xff and png[1] == 0xd8 and png[2] == 0xff:
		err = img.load_jpg_from_buffer(png)
	elif png[0] == 0x52 and png[1] == 0x49 and png[8] == 0x57:
		err = img.load_webp_from_buffer(png)
	if err != OK:
		return null
	if img.get_width() > 4096 or img.get_height() > 4096:
		return null
	var used := img.get_used_rect()
	if used.has_area():
		img = img.get_region(used)
	var scale := minf(1.0, 512.0 / maxf(img.get_width(), img.get_height()))
	if scale < 1.0:
		img.resize(maxi(1, roundi(img.get_width() * scale)), maxi(1, roundi(img.get_height() * scale)), Image.INTERPOLATE_LANCZOS)
	return ImageTexture.create_from_image(img)


# Dual grid (Oskar Stålberg): the drawn tiles are offset half a cell from the logical cells.
# Display tile (x, z) spans [x-0.5, x+0.5] x [z-0.5, z+0.5]; its four corners are the centres of
# cells (x-1, z-1) TL, (x, z-1) TR, (x-1, z) BL and (x, z) BR. Returns display tile -> mask 1..15.
func dual_tiles() -> Dictionary:
	if _dual_version == tiles_version:
		return _dual
	_dual = {}
	for cell in tiles:
		for d in [Vector2i(0, 0), Vector2i(1, 0), Vector2i(0, 1), Vector2i(1, 1)]:
			var t: Vector2i = cell + d
			if _dual.has(t):
				continue
			_dual[t] = dual_mask(t)
	_dual_version = tiles_version
	return _dual


func dual_mask(t: Vector2i) -> int:
	var m := 0
	if tiles.has(t + Vector2i(-1, -1)): m |= 1
	if tiles.has(t + Vector2i(0, -1)): m |= 2
	if tiles.has(t + Vector2i(-1, 0)): m |= 4
	if tiles.has(t): m |= 8
	return m
