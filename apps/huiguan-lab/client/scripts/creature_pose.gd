extends RefCounted
## Small presentation-only motion over the existing artwork. Feet stay at the authoritative root.

static func sample(n: Dictionary, seconds: float) -> Dictionary:
	if n.get("kind", "creature") != "creature" or n.get("source", "") != "lab":
		return {"lift":0.0, "stretch":Vector2.ONE, "angle":0.0}
	var phase := float(absi(str(n.get("id", "")).hash()) % 1000) * 0.00628
	var speed := float(n.get("visual_speed", 0.0))
	var breath := sin(seconds * 2.4 + phase) * 0.018
	var lift := 0.0
	var stretch := Vector2(1.0-breath*0.4, 1.0+breath)
	var angle := 0.0
	if speed > 0.01:
		var stride := seconds * clampf(speed * 9.0, 3.0, 14.0) + phase
		lift = absf(sin(stride)) * (0.13 if n.get("asset") == "b_frog" else 0.045)
		stretch = Vector2(1.0 + cos(stride*2.0)*0.035, 1.0-cos(stride*2.0)*0.045)
		angle = sin(stride) * 0.025
	elif n.get("action", "") == "watch":
		stretch.y += 0.035
	return {"lift":lift,"stretch":stretch,"angle":angle}
