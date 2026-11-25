extends SceneTree
const NEW = preload("res://scripts/lab_world.gd")
const FRAME := 1.0 / 60.0

func run(script: Script, timed: bool, batch: bool) -> Dictionary:
	var ws = script.new()
	ws.me_pid = "self"
	ws.upsert_player({"pid": "other", "x": 0.0, "z": 0.0})
	var i := 0
	var prior := 0.0
	var stopped := 0
	var max_step := 0.0
	var sum := 0.0
	for f in range(300):
		var now := float(f) * FRAME
		while i < 48:
			var pos := float(i) * 0.3
			var sent := float(i) / 10.0
			var wait := 0.017 if not batch or i % 4 < 2 or i % 4 == 3 else 0.117
			if now + 0.000001 < sent + wait:
				break
			ws.apply_snapshot([["other", pos, 0.0, 0.0, "walk"], ["self", 900, 900, 0, "run"]], 1000.0 + sent if timed else -1.0, now)
			i += 1
		ws.interpolate(now)
		var x: float = ws.players["other"]["x"]
		if f > 42 and f < 267:
			var step: float = x - prior
			max_step = maxf(step,max_step)
			if absf(step) < 0.00001:
				stopped += 1
			sum += step
		prior = x
	if float(ws.me["x"]) != 0.0:
		push_error("snapshot moved its own player")
		quit(1)
	return {"stationary_frames": stopped, "max_step_m": max_step, "progress_m": sum}

func _initialize() -> void:
	var old_batch := run(NEW,false,true)
	var new_batch := run(NEW,true,true)
	var legacy_clean := run(NEW,false,false)
	var new_clean := run(NEW,true,false)
	print(JSON.stringify({"baseline_batch":old_batch,"fixed_batch":new_batch,"legacy_clean":legacy_clean,"fixed_clean":new_clean}))
	var ok: bool = old_batch.stationary_frames > 10 and old_batch.max_step_m > 0.17 and new_batch.stationary_frames == 0 and new_batch.max_step_m < 0.06 and legacy_clean.stationary_frames == 0 and new_clean.stationary_frames == 0 and new_batch.progress_m > 10
	quit(0 if ok else 1)
