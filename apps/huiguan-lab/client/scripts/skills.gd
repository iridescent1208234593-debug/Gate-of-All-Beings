extends Node
## Skills autoload: skill tree state, the 4-slot bar, and PixelFX effect playback in the 2D and 3D views.
##
## Self-contained on purpose (another workstream owns main.gd and the hall views): it listens to Net.message,
## finds the running main scene for world/view2d/view3d, and adds its own nodes and UI layer.
## Effects are not in the .pck: each one is fetched on first use from the gateway (/fx/<category>/<name>.json and
## lossless .webp pages, see scripts/pack_skill_fx.py), then cached for the session.

signal state_changed
signal fx_ready(id: String)

const FX_SCALE := 2.5               # one effect pixel = 2.5 hall pixels (hall: 48 px per metre)
const PX_PER_M := 48.0
const MAX_CACHED := 60
const CAST_WAIT_SECONDS := 3.0
const FX_WAIT_SECONDS := 4.0
const CAST_WAIT_TEXT := "技能确认中…"
const FX_WAIT_TEXT := "特效加载中…"

var catalog: Dictionary = {}        # skills.json
var points := 0
var unlocked: Array = []
var equipped: Array = ["", "", "", ""]
var next_point_in := 0.0
var _state_at := 0.0
var cooldown_until: Dictionary = {} # id -> local seconds; "" = global
var ready_state := false
var awaiting_cast := ""
var awaiting_fx := ""
var cast_due := 0.0
var fx_due := 0.0

var fx: Dictionary = {}             # id -> {state: "loading"|"ready"|"failed", info, frames:[Texture2D], used}
var _http_queue: Array = []         # [id, kind("json"|"page"), page index]
var _http: HTTPRequest
var _http_busy := false

var _casts: Array = []              # active plays: {id, pid, x, z, dir, start, node2d, node3d, screen}
var _pending: Array = []            # casts waiting for their effect to load
var _main: Node
var _layer2d: Node2D
var _screen_layer: CanvasLayer
var _screen_rect: TextureRect
var ui: CanvasLayer


func _ready() -> void:
	var f := FileAccess.open("res://data/skills.json", FileAccess.READ)
	if f:
		catalog = JSON.parse_string(f.get_as_text())
	equipped.resize(int(catalog.get("slots", 4)))
	equipped.fill("")
	_http = HTTPRequest.new()
	_http.timeout = 30.0
	_http.max_redirects = 0
	add_child(_http)
	_http.request_completed.connect(_on_http_done)
	_screen_layer = CanvasLayer.new()
	_screen_layer.layer = 1
	add_child(_screen_layer)
	_screen_rect = TextureRect.new()
	_screen_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_screen_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_screen_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_screen_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_screen_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_screen_rect.visible = false
	_screen_layer.add_child(_screen_rect)
	ui = load("res://scripts/skill_ui.gd").new()
	ui.layer = 2
	add_child(ui)
	ui.setup(self)
	Net.message.connect(_on_message)
	Net.state_changed.connect(_on_net_state)


# ------------------------------------------------------------------ catalog helpers
func skill(id: String) -> Dictionary:
	return catalog.get("skills", {}).get(id, {})


func branches() -> Array:
	return catalog.get("branches", [])


func is_unlocked(id: String) -> bool:
	return id in unlocked


## "" when it can be unlocked now, else why not.
func unlock_block(id: String) -> String:
	var s := skill(id)
	if s.is_empty():
		return "unknown"
	if is_unlocked(id):
		return "unlocked"
	var tier := int(s["tier"])
	if tier > 1:
		var ok := false
		for b in branches():
			if b["id"] == s["branch"]:
				for other in b["skills"]:
					if int(skill(other)["tier"]) == tier - 1 and is_unlocked(other):
						ok = true
		if not ok:
			return "needs_previous"
	if points < int(s["cost"]):
		return "no_points"
	return ""


func cooldown_left(id: String) -> float:
	var now := Time.get_ticks_msec() / 1000.0
	return maxf(0.0, maxf(float(cooldown_until.get(id, 0.0)), float(cooldown_until.get("", 0.0))) - now)


func seconds_to_next_point() -> float:
	return maxf(0.0, next_point_in - (Time.get_ticks_msec() / 1000.0 - _state_at))


# ------------------------------------------------------------------ requests
func request_unlock(id: String) -> void:
	Net.send({"t": "skill_unlock", "id": id})


func request_equip(slot: int, id: String) -> void:
	Net.send({"t": "skill_equip", "slot": slot, "id": id})


func cast_slot(slot: int) -> void:
	if not ready_state or Net.state != "open" or awaiting_cast != "":
		return
	if slot < 0 or slot >= equipped.size():
		return
	var id: String = equipped[slot]
	if id == "":
		ui.toast("第 %d 格还没有装技能，按 K 打开技能树" % (slot + 1))
		return
	if cooldown_left(id) > 0.05:
		return
	awaiting_cast = id
	cast_due = Time.get_ticks_msec() / 1000.0 + CAST_WAIT_SECONDS
	ui.toast(CAST_WAIT_TEXT, CAST_WAIT_SECONDS + 0.2)
	ensure_fx(id)
	Net.send({"t": "skill_cast", "id": id})


func _on_net_state(state: String, _detail: String) -> void:
	if state != "open":
		ready_state = false
		_reset_feedback()


func _reset_feedback() -> void:
	awaiting_cast = ""
	awaiting_fx = ""
	if ui.toast_label.text in [CAST_WAIT_TEXT, FX_WAIT_TEXT]:
		ui.toast("", 0.0)


func _check_feedback_timeout(now: float) -> void:
	if awaiting_cast != "" and now >= cast_due:
		awaiting_cast = ""
		if ui.toast_label.text == CAST_WAIT_TEXT:
			ui.toast("暂未收到技能确认，可以重试。")
	if awaiting_fx != "" and now >= fx_due:
		awaiting_fx = ""
		if ui.toast_label.text == FX_WAIT_TEXT:
			ui.toast("技能已确认，特效未能及时加载。")


func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey) or not event.pressed or event.echo:
		return
	var focus := get_viewport().gui_get_focus_owner()
	if focus is LineEdit or focus is TextEdit:
		return
	if not ready_state or Net.state != "open":
		return
	match event.keycode:
		KEY_1, KEY_KP_1: cast_slot(0)
		KEY_2, KEY_KP_2: cast_slot(1)
		KEY_3, KEY_KP_3: cast_slot(2)
		KEY_4, KEY_KP_4: cast_slot(3)
		KEY_K: ui.toggle_tree()
		KEY_ESCAPE:
			if ui.tree_open():
				ui.toggle_tree()
			else:
				return
		_: return
	get_viewport().set_input_as_handled()


# ------------------------------------------------------------------ network
func _on_message(m: Dictionary) -> void:
	match m.get("t"):
		"welcome":
			_reset_feedback()
			ready_state = true
			_attach_views()
			for c in _casts:
				_free_cast(c)
			_casts.clear()
			_pending.clear()
			Net.send({"t": "skill_state"})
		"skills":
			points = int(m.get("points", 0))
			unlocked = m.get("unlocked", [])
			equipped = m.get("equipped", equipped)
			next_point_in = float(m.get("next_point_in", 0.0) if m.get("next_point_in") != null else 0.0)
			_state_at = Time.get_ticks_msec() / 1000.0
			for id in equipped:
				if id != "":
					ensure_fx(id)
			state_changed.emit()
		"skill_error":
			if m.get("code") in ["skill_cooldown", "skill_not_equipped"]:
				awaiting_cast = ""
			var msgs := {"skill_no_points": "技能点不够", "skill_needs_previous": "先解锁上一层的任意一个技能",
				"skill_cooldown": "技能还在冷却", "skill_not_equipped": "先把技能装到技能栏", "skill_locked": "这个技能还没解锁",
				"skill_already": "已经解锁过了", "skill_unknown": "没有这个技能", "skill_bad_slot": "没有这个技能格"}
			ui.toast(msgs.get(m.get("code"), str(m.get("code"))))
		"cast":
			_start_cast(m)
		"leave":
			for c in _casts:
				if c["pid"] == m.get("pid"):
					c["follow"] = false


# ------------------------------------------------------------------ effect loading
func _fx_base() -> String:
	if OS.has_feature("web"):
		var loc = JavaScriptBridge.get_interface("location")
		return str(loc.origin) + "/fx/"
	return Net.http_base() + "/fx/"


func ensure_fx(id: String) -> void:
	if id == "" or fx.has(id):
		if fx.has(id):
			fx[id]["used"] = Time.get_ticks_msec()
		return
	fx[id] = {"state": "loading", "info": {}, "pages": [], "frames": [], "used": Time.get_ticks_msec()}
	_http_queue.append([id, "json", 0])
	_pump()
	_evict()


func fx_ready_for(id: String) -> bool:
	return fx.has(id) and fx[id]["state"] == "ready"


func fx_frame(id: String, i: int) -> Texture2D:
	var e: Dictionary = fx.get(id, {})
	if e.get("state") != "ready" or e["frames"].is_empty():
		return null
	return e["frames"][clampi(i, 0, e["frames"].size() - 1)]


func _evict() -> void:
	if fx.size() <= MAX_CACHED:
		return
	var keep := {}
	for id in equipped:
		keep[id] = true
	for c in _casts:
		keep[c["id"]] = true
	var oldest := ""
	var t := 1 << 62
	for id in fx:
		if not keep.has(id) and fx[id]["state"] != "loading" and int(fx[id]["used"]) < t:
			t = int(fx[id]["used"])
			oldest = id
	if oldest != "":
		fx.erase(oldest)


func _pump() -> void:
	if _http_busy or _http_queue.is_empty():
		return
	var job: Array = _http_queue[0]
	var id: String = job[0]
	var url := _fx_base() + (id + ".json" if job[1] == "json" else id.get_base_dir() + "/" + str(fx[id]["info"]["pages"][job[2]]))
	var headers := PackedStringArray()
	if not OS.has_feature("web") and Net.cookie != "":
		headers.append("Cookie: " + Net.cookie)
	_http_busy = true
	if _http.request(url, headers) != OK:
		_http_busy = false
		_fail(id)
		_http_queue.pop_front()
		_pump.call_deferred()


func _on_http_done(result: int, code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	_http_busy = false
	var job: Array = _http_queue.pop_front()
	var id: String = job[0]
	if not fx.has(id):
		_pump()
		return
	if result != HTTPRequest.RESULT_SUCCESS or code != 200:
		_fail(id)
		_pump()
		return
	if job[1] == "json":
		var info = JSON.parse_string(body.get_string_from_utf8())
		if typeof(info) != TYPE_DICTIONARY or not info.has("pages"):
			_fail(id)
		else:
			fx[id]["info"] = info
			for k in info["pages"].size():
				_http_queue.append([id, "page", k])
	else:
		var img := Image.new()
		if img.load_webp_from_buffer(body) != OK:
			_fail(id)
		else:
			fx[id]["pages"].append([job[2], ImageTexture.create_from_image(img)])
			if fx[id]["pages"].size() == fx[id]["info"]["pages"].size():
				_build_frames(id)
	_pump()


func _fail(id: String) -> void:
	if fx.has(id):
		fx[id]["state"] = "failed"
	if awaiting_fx == id:
		awaiting_fx = ""
		if ui.toast_label.text == FX_WAIT_TEXT:
			ui.toast("技能已确认，特效加载失败。")
	for k in range(_http_queue.size() - 1, 0, -1):
		if _http_queue[k][0] == id:
			_http_queue.remove_at(k)
	for p in _pending.duplicate():
		if p["id"] == id:
			_pending.erase(p)


func _build_frames(id: String) -> void:
	var e: Dictionary = fx[id]
	var info: Dictionary = e["info"]
	var pages := {}
	for p in e["pages"]:
		pages[p[0]] = p[1]
	var w := int(info["w"])
	var h := int(info["h"])
	var cols := int(info["cols"])
	var per := int(info["per_page"])
	var frames: Array = []
	for i in int(info["n"]):
		var at := AtlasTexture.new()
		at.atlas = pages[i / per]
		var j := i % per
		at.region = Rect2((j % cols) * w, (j / cols) * h, w, h)
		frames.append(at)
	e["frames"] = frames
	e["pages"] = []
	e["state"] = "ready"
	var now := Time.get_ticks_msec() / 1000.0
	for p in _pending.duplicate():
		if p["id"] == id:
			_pending.erase(p)
			if now - float(p["queued"]) < FX_WAIT_SECONDS:
				_play(p)
	if awaiting_fx == id:
		awaiting_fx = ""
		if ui.toast_label.text == FX_WAIT_TEXT:
			ui.toast("", 0.0)
	fx_ready.emit(id)


# ------------------------------------------------------------------ playback
func _attach_views() -> void:
	_main = get_tree().current_scene
	if _main == null or not ("view2d" in _main):
		return
	if not is_instance_valid(_layer2d) and _main.view2d != null:
		_layer2d = Node2D.new()
		_layer2d.name = "SkillFx2D"
		_layer2d.z_index = 50
		_main.view2d.add_child(_layer2d)


func _start_cast(m: Dictionary) -> void:
	var id: String = m.get("id", "")
	if skill(id).is_empty():
		return
	_attach_views()
	var c := {"id": id, "pid": str(m.get("pid", "")), "x": float(m.get("x", 0.0)), "z": float(m.get("z", 0.0)),
		"dir": float(m.get("dir", 0.0)), "queued": Time.get_ticks_msec() / 1000.0, "follow": true}
	var mine: bool = c["pid"] == _me_pid()
	if mine:
		var now := Time.get_ticks_msec() / 1000.0
		cooldown_until[""] = now + 0.8
		cooldown_until[id] = now + float(skill(id).get("cooldown", 1.0))
		if awaiting_cast == id:
			awaiting_cast = ""
			if ui.toast_label.text == CAST_WAIT_TEXT:
				ui.toast("", 0.0)
	var s := skill(id)
	if s.get("anchor") == "screen":
		if s["branch"] == "transitions" and c["pid"] != _me_pid():
			return
		if s["branch"] == "weather":
			var me = _pos_of(_me_pid())
			if me != null and Vector2(c["x"], c["z"]).distance_to(me) > 14.0:
				return
	ensure_fx(id)
	if fx_ready_for(id):
		_play(c)
	elif fx[id]["state"] == "loading":
		_pending.append(c)
		if mine:
			awaiting_fx = id
			fx_due = float(c["queued"]) + FX_WAIT_SECONDS
			ui.toast(FX_WAIT_TEXT, FX_WAIT_SECONDS + 0.2)
	elif mine:
		ui.toast("技能已确认，特效加载失败。")


func _me_pid() -> String:
	if _main and "world" in _main and _main.world:
		return _main.world.me_pid
	return ""


func _pos_of(pid: String):
	if not (_main and "world" in _main and _main.world):
		return null
	var w = _main.world
	if pid == w.me_pid:
		return Vector2(float(w.me["x"]), float(w.me["z"]))
	if w.players.has(pid):
		return Vector2(float(w.players[pid].get("x", 0.0)), float(w.players[pid].get("z", 0.0)))
	return null


func _dir_of(pid: String, fallback: float) -> float:
	if not (_main and "world" in _main and _main.world):
		return fallback
	var w = _main.world
	if pid == w.me_pid:
		return float(w.me.get("dir", fallback))
	if w.players.has(pid):
		return float(w.players[pid].get("dir", fallback))
	return fallback


func _play(c: Dictionary) -> void:
	var s := skill(c["id"])
	var info: Dictionary = fx[c["id"]]["info"]
	c["start"] = Time.get_ticks_msec() / 1000.0
	c["fps"] = float(info["fps"])
	c["n"] = int(info["n"])
	c["loop"] = bool(info["loop"])
	c["play"] = float(s.get("play", 3.0)) if c["loop"] else float(c["n"]) / c["fps"]
	c["screen"] = s.get("anchor") == "screen"
	if not c["screen"]:
		if is_instance_valid(_layer2d):
			var sp := Sprite2D.new()
			sp.centered = false
			sp.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
			sp.scale = Vector2.ONE * FX_SCALE
			_layer2d.add_child(sp)
			c["node2d"] = sp
	_casts.append(c)


func _free_cast(c: Dictionary) -> void:
	for k in ["node2d", "node3d"]:
		if c.has(k) and is_instance_valid(c[k]):
			c[k].queue_free()
	if c.get("screen", false):
		_screen_rect.visible = false
		_screen_rect.texture = null


func _process(_delta: float) -> void:
	var now := Time.get_ticks_msec() / 1000.0
	_check_feedback_timeout(now)
	if _casts.is_empty():
		return
	var view3d: bool = Profile.view_mode == "3d"
	for c in _casts.duplicate():
		var t: float = now - float(c["start"])
		if t >= float(c["play"]):
			_free_cast(c)
			_casts.erase(c)
			continue
		var i := int(t * float(c["fps"]))
		i = i % int(c["n"]) if c["loop"] else mini(i, int(c["n"]) - 1)
		var tex := fx_frame(c["id"], i)
		if tex == null:
			continue
		if c["screen"]:
			_screen_rect.texture = tex
			_screen_rect.visible = true
			continue
		var info: Dictionary = fx[c["id"]]["info"]
		var p = _pos_of(c["pid"]) if c["follow"] else null
		if p == null:
			p = Vector2(c["x"], c["z"])
		var flip := cos(_dir_of(c["pid"], c["dir"])) < -0.2
		var w := float(info["w"])
		var h := float(info["h"])
		var ox := float(info["origin"][0])
		var oy := float(info["origin"][1])
		var sp: Sprite2D = c.get("node2d")
		if is_instance_valid(sp):
			sp.visible = not view3d
			sp.texture = tex
			sp.flip_h = flip
			var foot: Vector2 = p * PX_PER_M
			sp.position = foot - Vector2((w - ox) if flip else ox, oy) * FX_SCALE
		var s3: Sprite3D = c.get("node3d")
		if view3d and not is_instance_valid(s3) and is_instance_valid(_main) and _main.view3d:
			s3 = Sprite3D.new()
			s3.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
			s3.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
			s3.shaded = false
			s3.pixel_size = FX_SCALE / PX_PER_M
			s3.render_priority = 10
			_main.view3d.root3d.add_child(s3)
			c["node3d"] = s3
		if is_instance_valid(s3):
			s3.visible = view3d
			s3.texture = tex
			s3.flip_h = flip
			s3.position = Vector3(p.x, 0.02, p.y + 0.05)
			s3.offset = Vector2((ox - w * 0.5) if flip else (w * 0.5 - ox), oy - h * 0.5)
