class_name LabWorld
extends RefCounted
## Client mirror of the authoritative world: same metric geometry as the server (data/spaces.json),
## remote players buffered for interpolation, OC textures cached by digest.
## Both the 2D and the 3D view render from this one object.

const INTERP_DELAY := 0.12

var spec: Dictionary = {}
var template: Dictionary = {}
var space: Dictionary = {}
var me_pid := ""
var me := {"x": 0.0, "z": 0.0, "dir": 0.0, "anim": "idle"}
var players: Dictionary = {}        # pid -> {nick, oc, samples:[[t,x,z,dir]], x, z, dir, anim, emote, emote_until, bubble, bubble_until}
var npcs: Array = []
var npc_view: Dictionary = {}       # id -> {x, z, tx, tz, species}
var objects: Dictionary = {}
var clock: Dictionary = {}
var textures: Dictionary = {}       # digest -> Texture2D
var oc_digest: Dictionary = {}      # pid -> digest
var my_texture: Texture2D = null
var radius := 0.3
var obstacles: Array = []
var bmin := Vector2.ZERO
var bmax := Vector2.ONE
var version := 0                    # bumps when the space changes so views rebuild


func _init() -> void:
	var f := FileAccess.open("res://data/spaces.json", FileAccess.READ)
	spec = JSON.parse_string(f.get_as_text())
	radius = float(spec["player"]["radius"])


func set_space(info: Dictionary) -> void:
	space = info
	template = spec["templates"][info.get("template", "hall")]
	bmin = Vector2(template["bounds"]["min"][0], template["bounds"]["min"][2])
	bmax = Vector2(template["bounds"]["max"][0], template["bounds"]["max"][2])
	obstacles = []
	for o in template["obstacles"]:
		obstacles.append([Vector2(o["position"][0], o["position"][2]), float(o["radius"]) + radius])
	players.clear()
	npc_view.clear()
	version += 1


func free_at(p: Vector2) -> bool:
	if p.x < bmin.x or p.y < bmin.y or p.x > bmax.x or p.y > bmax.y:
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
	cur["nick"] = p.get("nick", cur.get("nick", ""))
	cur["x"] = float(p.get("x", cur.get("x", 0.0)))
	cur["z"] = float(p.get("z", cur.get("z", 0.0)))
	cur["dir"] = float(p.get("dir", 0.0))
	cur["anim"] = p.get("anim", "idle")
	cur["samples"] = [[now, cur["x"], cur["z"], cur["dir"]]]
	if p.has("oc"):
		oc_digest[pid] = p["oc"]
	players[pid] = cur


func apply_snapshot(rows: Array) -> void:
	var now := Time.get_ticks_msec() / 1000.0
	for r in rows:
		var pid: String = r[0]
		if pid == me_pid:
			continue
		if not players.has(pid):
			continue
		var cur: Dictionary = players[pid]
		var samples: Array = cur["samples"]
		samples.append([now, float(r[1]), float(r[2]), float(r[3])])
		while samples.size() > 12:
			samples.pop_front()
		cur["anim"] = r[4]


func interpolate() -> void:
	var t := Time.get_ticks_msec() / 1000.0 - INTERP_DELAY
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
	for id in npc_view:
		var n: Dictionary = npc_view[id]
		n["x"] = lerpf(n["x"], n["tx"], 0.08)
		n["z"] = lerpf(n["z"], n["tz"], 0.08)


func set_npcs(list: Array) -> void:
	var seen := {}
	for n in list:
		var id: String = n["id"]
		seen[id] = true
		if npc_view.has(id):
			npc_view[id]["tx"] = float(n["x"]); npc_view[id]["tz"] = float(n["z"])
		else:
			npc_view[id] = {"x": float(n["x"]), "z": float(n["z"]), "tx": float(n["x"]), "tz": float(n["z"]), "species": n["species"]}
	for id in npc_view.keys():
		if not seen.has(id):
			npc_view.erase(id)


func texture_for(pid: String) -> Texture2D:
	if pid == me_pid:
		return my_texture
	var d = oc_digest.get(pid, null)
	if d == null:
		return null
	return textures.get(d, null)


static func texture_from_png(png: PackedByteArray) -> Texture2D:
	var img := Image.new()
	if img.load_png_from_buffer(png) != OK:
		if img.load_webp_from_buffer(png) != OK:
			return null
	if img.get_width() > 2048 or img.get_height() > 2048:
		return null
	var used := img.get_used_rect()
	if used.has_area():
		img = img.get_region(used)
	var scale := minf(1.0, 512.0 / maxf(img.get_width(), img.get_height()))
	if scale < 1.0:
		img.resize(maxi(1, roundi(img.get_width() * scale)), maxi(1, roundi(img.get_height() * scale)), Image.INTERPOLATE_LANCZOS)
	return ImageTexture.create_from_image(img)
