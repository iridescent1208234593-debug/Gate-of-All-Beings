extends Control

const Run = preload("res://scripts/beach_shoot_run.gd")
const DARK := Color("192b37")
const GOLD := Color("ffd48f")
const CREST := Color("aaffdc")
const PLAYER := preload("res://assets/world/player_front.png")

signal pointer_pressed(local_point: Vector2, pointer: int)

var run: Run
var braced := false
var touch_origin = null
var touch_offset := Vector2.ZERO
var waypoint = null
var field: Rect2:
	get:
		var zoom := minf(size.x / Run.SIZE.x, size.y / Run.SIZE.y)
		return Rect2((size - Run.SIZE * zoom) * 0.5, Run.SIZE * zoom)


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	clip_contents = true
	resized.connect(queue_redraw)


func _gui_input(event: InputEvent) -> void:
	if not (event is InputEventMouseButton or event is InputEventScreenTouch):
		return
	if not event.pressed or not field.has_point(event.position):
		return
	if event is InputEventScreenTouch:
		if event.device == InputEvent.DEVICE_ID_EMULATION:
			return
		pointer_pressed.emit(event.position, event.index)
	elif event.button_index == MOUSE_BUTTON_LEFT:
		pointer_pressed.emit(event.position, -3 if event.device == InputEvent.DEVICE_ID_EMULATION else -2)
	else:
		return
	accept_event()


func from_screen(point: Vector2) -> Vector2:
	return get_global_transform_with_canvas().affine_inverse() * point


func to_field(local_point: Vector2) -> Vector2:
	var rect := field
	if rect.size.x <= 0.0:
		return Run.START
	return ((local_point - rect.position) * Run.SIZE.x / rect.size.x).clamp(Vector2(100, Run.WATER_EDGE + 16), Vector2(682, 358))


func _draw() -> void:
	var rect := field
	if run == null or not rect.has_area():
		return
	var ratio := rect.size.x / Run.SIZE.x
	draw_set_transform(rect.position, 0.0, Vector2(ratio, ratio))
	_draw_field()
	if run.surge_left > 0.0:
		var fraction := run.surge_left / Run.SURGE_WARNING
		draw_circle(run.surge_at, Run.SURGE_RADIUS, Color(0.70, 0.22, 0.30, 0.21 + (1.0 - fraction) * 0.34), true, -1.0, true)
		draw_arc(run.surge_at, Run.SURGE_RADIUS, -PI * 0.5, -PI * 0.5 + TAU * fraction, 32, GOLD, 2.5, true)
	for enemy in run.enemies:
		_draw_enemy(enemy)
	for shot in run.shots:
		var velocity: Vector2 = shot.velocity
		var at: Vector2 = shot.at
		draw_line(at - velocity.normalized() * 13.0, at, Color("ee9874"), 3.0, true)
		draw_circle(at, 3.0, GOLD, true, -1.0, true)
	_draw_player()
	draw_rect(Rect2(Vector2.ZERO, Run.SIZE), Color("566e72"), false, 2.0)
	if touch_origin != null:
		draw_set_transform(Vector2.ZERO)
		draw_circle(touch_origin, 26, Color(0.08, 0.16, 0.19, 0.64), true, -1.0, true)
		draw_arc(touch_origin, 26, 0, TAU, 32, CREST, 1.5, true)
		draw_circle(touch_origin + touch_offset, 7.0, GOLD, true, -1.0, true)


func _draw_field() -> void:
	draw_rect(Rect2(Vector2.ZERO, Run.SIZE), Color("b79a76"))
	draw_rect(Rect2(Vector2.ZERO, Vector2(Run.SIZE.x, Run.WATER_EDGE)), Color("366a78"))
	for i in 3:
		var points := PackedVector2Array()
		for x in range(0, int(Run.SIZE.x) + 1, 8):
			var height := float(x) * (0.019 + 0.002 * i) + run.elapsed * (1.1 + i * 0.1)
			points.append(Vector2(x, Run.WATER_EDGE - i * 21 + sin(height) * (5 + i)))
		draw_polyline(points, Color("e4e1b2") if i == 0 else Color("6aadab"), 2, true)
	for y: float in Run.LANES:
		draw_dashed_line(Vector2(Run.LINE_X + 16, y), Vector2(Run.SIZE.x - 4, y), Color("a58c6e"), 1, 8)
	for i in 58:
		var at := Vector2(91 + (i * 119) % 670, 112 + (i * 71) % 260)
		draw_rect(Rect2(at, Vector2(3 + i % 3, 2)), Color("cbb388"))
	draw_rect(Rect2(Run.LINE_X - 10, Run.WATER_EDGE + 7, 16, Run.SIZE.y - Run.WATER_EDGE - 14), Color("745b54"))
	for i in Run.MAX_LINE:
		var y := Run.WATER_EDGE + 32.0 + i * 98.0
		var lit := i < run.line
		draw_circle(Vector2(Run.LINE_X - 2, y), 10, DARK)
		draw_circle(Vector2(Run.LINE_X - 2, y), 4.5, CREST if lit else Color("98535a"))
	if waypoint != null:
		draw_arc(waypoint, 8, 0, TAU, 24, Color("3a6d6d"), 2.0, true)


func _draw_enemy(enemy: Dictionary) -> void:
	var at: Vector2 = enemy.at
	var radius: float = enemy.radius
	if enemy.warning > 0.0:
		draw_arc(at, radius + 6, 0, TAU, 32, GOLD, 2.0, true)
		return
	var kind: String = enemy.kind
	var colors := {"scout": Color("536476"), "dart": Color("a75569"), "shell": Color("405c59"), "tide": Color("6a466b")}
	draw_circle(at + Vector2(1, 3), radius + 2, DARK, true, -1.0, true)
	draw_circle(at, radius, colors[kind], true, -1.0, true)
	if kind in ["shell", "tide"]:
		draw_arc(at, radius - 2.0, -PI * 0.8, PI * 0.8, 32, CREST, 2, true)
		draw_line(at + Vector2(-radius, -radius - 6), at + Vector2(-radius + 2.0 * radius * enemy.hp / enemy.max_hp, -radius - 6), GOLD, 3.0)
	for y in [-0.24, 0.24]:
		draw_circle(at + Vector2(-radius * 0.35, radius * y), 2.0, GOLD)


func _draw_player() -> void:
	var at: Vector2 = run.player
	draw_circle(at, 13.0, DARK, true, -1.0, true)
	if braced:
		draw_arc(at, 20.0, -0.8, 0.8, 24, GOLD, 2.5, true)
	var dimensions := PLAYER.get_size() * (32.0 / PLAYER.get_height())
	var tint := Color("ffada3") if run.hurt_left > 0.0 else Color.WHITE
	draw_texture_rect(PLAYER, Rect2(at + Vector2(-dimensions.x * 0.5, 8 - dimensions.y), dimensions), false, tint)
