extends RefCounted
## 省省海滩射击 · LAB 改编：守线短局，不共享浅滩教程或网站的局内状态。

const SIZE := Vector2(768, 384)
const START := Vector2(124, 240)
const WATER_EDGE := 92.0
const LINE_X := 76.0
const LANES := [126.0, 180.0, 234.0, 288.0, 342.0]
const LAST_WAVE := 3
const MAX_SCORE := 24
const MAX_ENEMIES := 14
const MAX_HP := 4
const MAX_LINE := 3
const SHOT_SPEED := 510.0
const SURGE_RADIUS := 22.0
const SURGE_WARNING := 0.85
const CAMPAIGN := [
	["scout", "scout", "scout", "scout", "scout", "dart"],
	["scout", "dart", "scout", "shell", "scout", "dart", "shell", "scout"],
	["dart", "shell", "scout", "dart", "shell", "dart", "scout", "shell", "dart", "tide"],
]
const UPGRADES := {
	"power": ["强弦", "每颗灵弹伤害 +1"],
	"tempo": ["快手", "射击间隔缩短 22%"],
	"patch": ["补给", "恢复 2 格体力、修复 1 格守线"],
	"fan": ["散星", "定身散射从 3 路增至 5 路"],
	"boots": ["逐风", "移动速度提高 20%"],
}

var rng := RandomNumberGenerator.new()
var player := START
var hp := MAX_HP
var line := MAX_LINE
var kills := 0
var elapsed := 0.0
var wave := 0
var speed := 174.0
var interval := 0.46
var damage := 1
var wider := false
var shot_left := 0.0
var spawn_left := 0.0
var hurt_left := 0.0
var surge_left := 0.0
var surge_at := Vector2.ZERO
var surge_timer := 0.0
var shots: Array[Dictionary] = []
var enemies: Array[Dictionary] = []
var offers: Array[String] = []
var learned: Array[String] = []
var queue: Array = []
var phase := "ready" # ready → play → choice / won / lost
var loss_reason := ""
var next_lane := 2


func _init(run_seed: int) -> void:
	rng.seed = run_seed


func begin() -> void:
	if phase == "ready":
		_next_wave()


func choose(id: String) -> bool:
	if phase != "choice" or not id in offers:
		return false
	match id:
		"power": damage += 1
		"tempo": interval *= 0.78
		"patch":
			hp = mini(MAX_HP, hp + 2)
			line = mini(MAX_LINE, line + 1)
		"fan": wider = true
		"boots": speed *= 1.2
	if id != "patch":
		learned.append(id)
	_next_wave()
	return true


func _next_wave() -> void:
	wave += 1
	queue = CAMPAIGN[wave - 1].duplicate()
	enemies.clear()
	shots.clear()
	offers.clear()
	shot_left = 0.0
	spawn_left = 1.0
	phase = "play"


func step(dt: float, wish: Vector2, brace: bool) -> void:
	if phase != "play" or dt <= 0:
		return
	elapsed += dt
	hurt_left = maxf(0.0, hurt_left - dt)
	if not brace:
		player = (player + wish.limit_length() * speed * dt).clamp(Vector2(100, WATER_EDGE + 16), Vector2(682, 358))
	_update_spawns(dt)
	shot_left = maxf(0.0, shot_left - dt)
	if shot_left == 0.0:
		_fire(brace)
	_update_shots(dt)
	_update_enemies(dt)
	_update_surge(dt)
	if hp <= 0 or line <= 0:
		if loss_reason.is_empty():
			loss_reason = "line" if line <= 0 else "hp"
		phase = "lost"
	elif queue.is_empty() and enemies.is_empty():
		if wave == LAST_WAVE:
			phase = "won"
		else:
			_open_choices()


func _update_spawns(dt: float) -> void:
	if queue.is_empty():
		return
	spawn_left -= dt
	if spawn_left > 0.0 or enemies.size() >= MAX_ENEMIES:
		return
	var kind: String = queue.pop_front()
	var at := Vector2(SIZE.x - 19.0, LANES[next_lane])
	enemies.append(_enemy(kind, at))
	var stride := rng.randi_range(1, LANES.size() - 1)
	next_lane = (next_lane + stride) % LANES.size()
	spawn_left = 1.58 - wave * 0.25


static func _enemy(kind: String, at: Vector2) -> Dictionary:
	var radius := 13.0
	var hp_count := 1
	var pace := 62.0
	match kind:
		"dart":
			radius = 9.0
			pace = 103.0
		"shell":
			radius = 17.0
			hp_count = 3
			pace = 52.0
		"tide":
			radius = 23.0
			hp_count = 10
			pace = 46.0
	return {"at": at, "radius": radius, "hp": hp_count, "max_hp": hp_count, "speed": pace, "kind": kind, "warning": 0.65}


func _fire(brace: bool) -> void:
	var offset := Vector2.RIGHT
	var closest := INF
	for enemy in enemies:
		if enemy.warning > 0.0:
			continue
		var ahead: Vector2 = enemy.at - player
		var distance := ahead.length_squared()
		# Prefer enemies about to reach the line when distances are otherwise close.
		if enemy.at.x < 240.0:
			distance *= 0.72
		if distance < closest:
			closest = distance
			# Lead lateral targets so a dart can be intercepted from a neighboring lane.
			var velocity := Vector2(-float(enemy.speed), 0.0)
			var time_to_hit := ahead.length() / SHOT_SPEED
			for i in 3:
				time_to_hit = (ahead + velocity * time_to_hit).length() / SHOT_SPEED
			var lead := ahead + velocity * time_to_hit
			offset = Vector2.RIGHT if lead.is_zero_approx() else lead.normalized()
	if closest == INF:
		return
	var angles := [0.0]
	if brace:
		angles = [-36.0, -18.0, 0.0, 18.0, 36.0] if wider else [-20.0, 0.0, 20.0]
	for angle: float in angles:
		var direction := offset.rotated(deg_to_rad(angle))
		shots.append({"at": player + direction * 13, "velocity": direction * SHOT_SPEED, "life": 1.45})
	shot_left = interval * (0.8 if brace else 1.0)


func _update_shots(dt: float) -> void:
	for i in range(shots.size() - 1, -1, -1):
		var shot := shots[i]
		var before: Vector2 = shot.at
		var next: Vector2 = before + shot.velocity * dt
		shot.at = next
		shot.life -= dt
		var hit := -1
		var closest := INF
		for j in enemies.size():
			var enemy := enemies[j]
			if enemy.warning > 0.0:
				continue
			var point := Geometry2D.get_closest_point_to_segment(enemy.at, before, next)
			var distance := before.distance_squared_to(point)
			if distance < closest and point.distance_to(enemy.at) <= float(enemy.radius) + 2.0:
				hit = j
				closest = distance
		if hit != -1:
			enemies[hit].hp -= damage
			if enemies[hit].hp <= 0:
				enemies.remove_at(hit)
				kills += 1
		if hit != -1 or shot.life <= 0 or not Rect2(Vector2.ZERO, SIZE).has_point(next):
			shots.remove_at(i)


func _update_enemies(dt: float) -> void:
	for i in range(enemies.size() - 1, -1, -1):
		var enemy := enemies[i]
		enemy.warning = maxf(0.0, enemy.warning - dt)
		if enemy.warning > 0.0:
			continue
		var point: Vector2 = enemy.at
		point.x -= enemy.speed * dt
		if point.x <= LINE_X:
			if enemy.kind == "tide":
				line = 0
				loss_reason = "tide"
			else:
				line = maxi(0, line - 1)
			enemies.remove_at(i)
			continue
		if hurt_left == 0.0 and point.distance_to(player) < float(enemy.radius) + 9.0:
			hp = maxi(0, hp - 1)
			hurt_left = 1.0
			point.x += 32.0
		enemy.at = point


func _update_surge(dt: float) -> void:
	if not enemies.any(func(enemy): return enemy.kind == "tide" and enemy.warning <= 0.0):
		surge_left = 0.0
		return
	if surge_left > 0.0:
		surge_left = maxf(0.0, surge_left - dt)
		if surge_left == 0.0 and hurt_left == 0.0 and player.distance_to(surge_at) <= SURGE_RADIUS:
			hp = maxi(0, hp - 1)
			hurt_left = 1.0
		return
	surge_timer -= dt
	if surge_timer <= 0.0:
		surge_timer = 3.4
		surge_left = SURGE_WARNING
		surge_at = player


func _open_choices() -> void:
	var pool: Array = UPGRADES.keys().filter(func(id): return id not in learned and id != "patch")
	if hp < MAX_HP or line < MAX_LINE:
		offers.append("patch")
	while offers.size() < 3 and not pool.is_empty():
		var id: String = pool.pop_at(rng.randi_range(0, pool.size() - 1))
		offers.append(id)
	shots.clear()
	phase = "choice"
