extends RefCounted
## Smithy Games' CC0 Crow.png, visual fixture checked against its exact 48px grid.
const ATLAS = preload("res://assets/world/species_trial_crow.png")
static var cache: SpriteFrames

static func frames() -> SpriteFrames:
	if cache != null:
		return cache
	cache = SpriteFrames.new()
	cache.add_animation("perched")
	cache.add_animation("flying")
	cache.set_animation_speed("flying", 12.0)
	cache.add_frame("perched", cell(4, 2))
	for col in 5:
		cache.add_frame("flying", cell(col, 5))
	return cache

static func cell(x: int, y: int) -> AtlasTexture:
	var tile := AtlasTexture.new()
	tile.atlas = ATLAS
	tile.region = Rect2(x * 48, y * 48, 48, 48)
	return tile

static func frame_number(action: String) -> int:
	return int(Time.get_ticks_msec() * 0.012) % 5 if action == "flying" else 0
