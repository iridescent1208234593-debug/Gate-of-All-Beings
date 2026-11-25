extends Control
## Preview of the animated renmo body with its face layers, recoloured like in the hall.
## Used by the setup panel and the part-colour editor (a TextureRect can only show one texture).
var animation = preload("res://scripts/renmo_animation.gd").new()
var pose := {"anim": "idle"}
var colors := {}
var palette_id := "profile-preview"

func _ready() -> void:
	var mat := ShaderMaterial.new()
	mat.shader = preload("res://shaders/renmo_colors_2d.gdshader")
	mat.set_shader_parameter("palette_tex", RenmoColors.texture)
	material = mat

func _process(_delta: float) -> void:
	queue_redraw()

func _draw() -> void:
	var row := RenmoColors.row_for(palette_id, colors)
	var s: float = minf(size.x / animation.FW, size.y / animation.FH)
	var w: float = animation.FW * s
	var h: float = animation.FH * s
	var rect := Rect2((size.x - w) * 0.5, (size.y - h) * 0.5, w, h)
	animation.draw_on(self, pose, Time.get_ticks_msec() / 1000.0, rect, Color((row + 0.5) / 128.0, 0.123, 0.456, 1.0))
