extends RefCounted
## Trust boundary for the *separate* public GitHub download/update channel.
## Production supplies an embedded public verification key; no trusted default is used.

const REPO := "https://github.com/iridescent1208234593-debug/Gate-of-All-Beings-Public-public"
const MANIFEST_NAME := "LAB-public-update.json"
const MAX_MANIFEST := 8192
const MAX_PACKAGE := 512 * 1024 * 1024
const WINDOWS_ASSET := "Huiguan-LAB-Windows-x86_64.exe"
const ANDROID_ASSET := "Huiguan-LAB-Android.apk"
const ANDROID_PACKAGE := "cn.iridescently.huiguan.lab.public"


static func verify_and_select(payload: PackedByteArray, signature: PackedByteArray, public_pem: String,
		platform: String, installed: int, expected_android_cert := "") -> Dictionary:
	if installed < 1 or payload.size() > MAX_MANIFEST or payload.is_empty() or signature.size() < 256 or signature.size() > 512:
		return {}
	var key := CryptoKey.new()
	if public_pem.is_empty() or key.load_from_string(public_pem, true) != OK:
		return {}
	var hash := digest_bytes(payload)
	if not Crypto.new().verify(HashingContext.HASH_SHA256, hash, signature, key):
		return {}
	return _select(JSON.parse_string(payload.get_string_from_utf8()), platform, installed, expected_android_cert)


static func _select(parsed: Variant, platform: String, installed: int, expected_android_cert: String) -> Dictionary:
	if not parsed is Dictionary or parsed.get("schema") != 1 or parsed.get("channel") != "public":
		return {}
	var build: Variant = parsed.get("build")
	if not _whole(build, installed + 1, 2100000000):
		return {}
	var tag: Variant = parsed.get("tag")
	var pattern := RegEx.new()
	pattern.compile("^lab-v[0-9]{1,5}\\.[0-9]{1,5}\\.[0-9]{1,5}(?:-[a-z0-9][a-z0-9.-]{0,31})?$")
	if not tag is String or not pattern.search(tag):
		return {}
	var assets: Variant = parsed.get("assets")
	if not assets is Dictionary or not platform in ["windows", "android"] or not assets.get(platform) is Dictionary:
		return {}
	var asset: Dictionary = assets[platform]
	var name := WINDOWS_ASSET if platform == "windows" else ANDROID_ASSET
	var size: Variant = asset.get("size_bytes")
	var digest: Variant = asset.get("sha256")
	if asset.get("name") != name or not _whole(size, 1, MAX_PACKAGE) or not _sha256(digest) or asset.has("url"):
		return {}
	if platform == "android":
		if not _sha256(expected_android_cert) or asset.get("package_id") != ANDROID_PACKAGE or asset.get("signer_sha256") != expected_android_cert:
			return {}
	return {"build": int(build), "size_bytes": int(size), "sha256": digest,
			"url": REPO + "/releases/download/" + tag + "/" + name}


static func _sha256(value: Variant) -> bool:
	if not value is String or value.length() != 64:
		return false
	for ch in value:
		if not ch in "0123456789abcdef":
			return false
	return true


static func _whole(value: Variant, lo: int, hi: int) -> bool:
	return (value is int or value is float) and value >= lo and value <= hi and value == floor(value)


static func digest_bytes(payload: PackedByteArray) -> PackedByteArray:
	var ctx := HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	ctx.update(payload)
	return ctx.finish()
