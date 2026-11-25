extends Control
## A single captured finger drives movement until it is released, even outside the pad.

const RADIUS := 60.0
const DEAD_ZONE := 0.18
const MAX_STRENGTH := 0.80
const RESPONSE_TIME := 0.07
var direction := Vector2.ZERO
var target_direction := Vector2.ZERO
var raw_direction := Vector2.ZERO
var finger := -1


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	visibility_changed.connect(func():
		if not is_visible_in_tree():
			_reset())


func _reset() -> void:
	finger = -1
	direction = Vector2.ZERO
	target_direction = Vector2.ZERO
	raw_direction = Vector2.ZERO
	queue_redraw()


func _input(event: InputEvent) -> void:
	if not is_visible_in_tree():
		return
	if event is InputEventScreenTouch:
		if event.pressed and finger == -1 and get_global_rect().has_point(event.position):
			finger = event.index
			_move(event.position)
			get_viewport().set_input_as_handled()
		elif event.index == finger and not event.pressed:
			_reset()
			get_viewport().set_input_as_handled()
	elif event is InputEventScreenDrag and event.index == finger:
		_move(event.position)
		get_viewport().set_input_as_handled()


func _gui_input(_event: InputEvent) -> void:
	# Consume emulated mouse events so touching the pad never sets a click-to-walk target.
	accept_event()


func _move(screen: Vector2) -> void:
	raw_direction = ((screen - global_position - size * 0.5) / RADIUS).limit_length(1.0)
	var strength := maxf(0.0, (raw_direction.length() - DEAD_ZONE) / (1.0 - DEAD_ZONE))
	target_direction = raw_direction.normalized() * (strength * strength * MAX_STRENGTH)
	if strength == 0.0:
		direction = Vector2.ZERO
	queue_redraw()


func _process(delta: float) -> void:
	if finger != -1:
		direction = direction.lerp(target_direction, 1.0 - exp(-delta / RESPONSE_TIME))


func _draw() -> void:
	var center := size * 0.5
	draw_circle(center, RADIUS, Color(0.08, 0.12, 0.1, 0.5))
	draw_circle(center, RADIUS, Color(0.9, 0.95, 0.88, 0.7), false, 2.0)
	for offset in [Vector2.UP, Vector2.DOWN, Vector2.LEFT, Vector2.RIGHT]:
		draw_circle(center + offset * 45.0, 4.0, Color(1, 1, 1, 0.55))
	draw_circle(center + raw_direction * 36.0, 23.0, Color(0.9, 0.95, 0.88, 0.85))
