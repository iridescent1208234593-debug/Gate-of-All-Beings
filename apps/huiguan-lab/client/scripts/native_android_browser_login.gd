extends RefCounted
## Companion to the public Android App Link activity. Verifier only lives in memory.

const PREFS := "lab_public_app_link"
const TTL := 300000
var _prefs: Variant
var _state := ""
var _verifier := ""
var _deadline := 0


func _b64(bytes: PackedByteArray) -> String:
	return Marshalls.raw_to_base64(bytes).replace("+", "-").replace("/", "_").trim_suffix("=")


func start(base: String) -> String:
	stop()
	if not OS.has_feature("android") or not OS.has_feature("lab_public_release") or not Engine.has_singleton("AndroidRuntime"):
		return ""
	if base != "https://pc-lab.iridescently.cn":
		return ""
	var runtime = Engine.get_singleton("AndroidRuntime")
	var activity = runtime.getActivity()
	if activity == null:
		return ""
	_prefs = activity.getSharedPreferences(PREFS, 0)
	if _prefs == null:
		return ""
	var rng := Crypto.new()
	_state = _b64(rng.generate_random_bytes(32))
	_verifier = _b64(rng.generate_random_bytes(32))
	if _state.length() != 43 or _verifier.length() != 43:
		stop()
		return ""
	var saved = _prefs.edit().remove("code").remove("state").putString("expected_state", _state).putLong(
			"valid_until_millis", int(Time.get_unix_time_from_system() * 1000.0) + TTL).commit()
	if saved != true:
		stop()
		return ""
	_deadline = Time.get_ticks_msec() + TTL
	return "%s/account/native/start?method=android_app_link&state=%s&challenge=%s" % [base, _state, _b64(_verifier.sha256_buffer())]


func tick() -> Dictionary:
	if _deadline == 0 or _prefs == null:
		return {}
	if Time.get_ticks_msec() >= _deadline:
		stop()
		return {"expired": true}
	var code := str(_prefs.getString("code", ""))
	if code.is_empty():
		return {}
	var state := str(_prefs.getString("state", ""))
	if state != _state or code.length() != 43:
		_prefs.edit().remove("code").remove("state").apply()
		return {}
	var grant := {"code":code, "state":state, "verifier":_verifier}
	stop()
	return grant


func stop() -> void:
	if _prefs != null:
		_prefs.edit().remove("code").remove("state").remove("expected_state").remove("valid_until_millis").apply()
	_prefs = null
	_state = ""
	_verifier = ""
	_deadline = 0
