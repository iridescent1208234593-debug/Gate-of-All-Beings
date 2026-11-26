extends Control
## Shared board renderer for the optional line-game packs.

signal played(column: int, row: int)

var pack: Dictionary
var state: Dictionary
var can_play := false


func _grid() -> Vector2i:
	return Vector2i(int(pack["columns"]), int(pack["rows"]))


func _cell_size() -> float:
	return minf(size.x / _grid().x, size.y / _grid().y)


func _origin() -> Vector2:
	return (size - Vector2(_grid()) * _cell_size()) * 0.5


func _center(x: int, y: int) -> Vector2:
	return _origin() + Vector2(x + 0.5, y + 0.5) * _cell_size()


func _draw() -> void:
	var dims := _grid()
	var step := _cell_size()
	var origin := _origin()
	var style := str(pack["style"])
	var ink := Color("#573b2a")
	var background := Color("#ddb07a") if style == "intersections" else Color("#e7ecf3")
	if style == "discs":
		background = Color("#264d72")
	draw_rect(Rect2(origin, Vector2(dims) * step), background)
	if style == "intersections":
		for x in range(dims.x):
			draw_line(_center(x, 0), _center(x, dims.y - 1), ink, 1.0, true)
		for y in range(dims.y):
			draw_line(_center(0, y), _center(dims.x - 1, y), ink, 1.0, true)
		for x in [3, 7, 11]:
			for y in [3, 7, 11]:
				draw_circle(_center(x, y), 2.0, ink, true, -1.0, true)
	elif style == "marks":
		for i in range(1, 3):
			draw_line(origin + Vector2(i * step, 0), origin + Vector2(i * step, step * 3), ink, 2.0, true)
			draw_line(origin + Vector2(0, i * step), origin + Vector2(step * 3, i * step), ink, 2.0, true)
	var pieces: Array = state["board"]
	var winners: Array = state["winning_cells"]
	var last := int(state["last"])
	for i in range(pieces.size()):
		var side := int(pieces[i])
		var point := _center(i % dims.x, floori(float(i) / dims.x))
		var radius := step * 0.39
		if style == "discs":
			var disc := [Color("#18314c"), Color("#f16b69"), Color("#f5cc60")][side] as Color
			draw_circle(point, radius, disc, true, -1.0, true)
		elif style == "intersections" and side != 0:
			draw_circle(point, radius, ink, true, -1.0, true)
			draw_circle(point, radius - 1.0, Color("#252328") if side == 1 else Color("#faf0dc"), true, -1.0, true)
		elif style == "marks" and side != 0:
			radius = step * 0.27
			if side == 1:
				draw_line(point - Vector2.ONE * radius, point + Vector2.ONE * radius, Color("#803f37"), 5.0, true)
				draw_line(point + Vector2(-1, 1) * radius, point + Vector2(1, -1) * radius, Color("#803f37"), 5.0, true)
			else:
				draw_arc(point, radius, 0, TAU, 32, Color("#195361"), 5.0, true)
		if winners.has(float(i)) or winners.has(i):
			draw_arc(point, step * 0.46, 0, TAU, 28, Color("#3c9457"), 2.5, true)
		elif last == i:
			draw_circle(point, 2.0, Color("#e77c2b"), true, -1.0, true)


func _gui_input(event: InputEvent) -> void:
	if not can_play or not (event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT):
		return
	var offset := (get_local_mouse_position() - _origin()) / _cell_size()
	var cell := Vector2i(floori(offset.x), floori(offset.y))
	var dims := _grid()
	if cell.x >= 0 and cell.x < dims.x and cell.y >= 0 and cell.y < dims.y:
		accept_event()
		played.emit(cell.x, cell.y)
