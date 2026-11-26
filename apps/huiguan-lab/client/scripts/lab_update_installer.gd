extends RefCounted
## Android-only bridge. The caller verifies the downloaded manifest's SHA-256 before
## asking to open this fixed private file. Android still owns the install confirmation.

const OPENED_INSTALLER := 0
const OPENED_SOURCE_SETTINGS := 1
const UNAVAILABLE := 2
const APK_PATH := "user://updates/huiguan-next.apk"
const GET_SIGNATURES := 0x40


static func installed_version() -> int:
	var activity = _activity()
	if activity == null:
		return 0
	var info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0)
	if info == null or _failed():
		return 0
	return _version(info)


static func request_install(expected_version: int) -> int:
	var activity = _activity()
	if activity == null or expected_version <= 0 or not FileAccess.file_exists(APK_PATH):
		return UNAVAILABLE

	# Restrict the URI grant to exactly one file in this app's filesDir.
	var fs = JavaClassWrapper.wrap("java.io.File")
	if fs == null:
		return UNAVAILABLE
	var apk = fs.File(ProjectSettings.globalize_path(APK_PATH))
	if apk == null or _failed():
		return UNAVAILABLE
	var root = activity.getFilesDir()
	if root == null or _failed():
		return UNAVAILABLE
	var expected_path: String = str(root.getCanonicalPath()).path_join("updates/huiguan-next.apk")
	if _failed():
		return UNAVAILABLE
	var path: String = str(apk.getCanonicalPath())
	if _failed() or path != expected_path:
		return UNAVAILABLE

	var pm = activity.getPackageManager()
	var package_id: String = str(activity.getPackageName())
	if pm == null or package_id.is_empty() or _failed():
		return UNAVAILABLE
	var current = pm.getPackageInfo(package_id, GET_SIGNATURES)
	if current == null or _failed():
		return UNAVAILABLE
	var next = pm.getPackageArchiveInfo(path, GET_SIGNATURES)
	if next == null or _failed():
		return UNAVAILABLE
	var version := _version(current)
	if version <= 0 or expected_version <= version or _version(next) != expected_version:
		return UNAVAILABLE
	if not _matches_package_and_signers(next, current, package_id):
		return UNAVAILABLE

	var intent_type = JavaClassWrapper.wrap("android.content.Intent")
	var uri_type = JavaClassWrapper.wrap("android.net.Uri")
	if intent_type == null or uri_type == null:
		return UNAVAILABLE
	var may_install: bool = pm.canRequestPackageInstalls()
	if _failed():
		return UNAVAILABLE
	if not may_install:
		var settings = intent_type.Intent("android.settings.MANAGE_UNKNOWN_APP_SOURCES")
		settings.setData(uri_type.parse("package:" + package_id))
		if _failed():
			return UNAVAILABLE
		activity.startActivity(settings)
		return UNAVAILABLE if _failed() else OPENED_SOURCE_SETTINGS

	var provider = JavaClassWrapper.wrap("androidx.core.content.FileProvider")
	if provider == null:
		return UNAVAILABLE
	var uri = provider.getUriForFile(activity, package_id + ".fileprovider", apk)
	if uri == null or _failed():
		return UNAVAILABLE
	var installer = intent_type.Intent("android.intent.action.VIEW")
	installer.setDataAndType(uri, "application/vnd.android.package-archive")
	if _failed():
		return UNAVAILABLE
	installer.addFlags(1) # Intent.FLAG_GRANT_READ_URI_PERMISSION, for this URI only.
	if _failed():
		return UNAVAILABLE
	activity.startActivity(installer)
	return UNAVAILABLE if _failed() else OPENED_INSTALLER


static func _activity() -> Variant:
	if not OS.has_feature("android"):
		return null # PackageInfo.getLongVersionCode requires API 28.
	var platform = JavaClassWrapper.wrap("android.os.Build$VERSION")
	if platform == null or int(platform.SDK_INT) < 28:
		return null
	var runtime = Engine.get_singleton("AndroidRuntime")
	return runtime.getActivity() if runtime != null else null


static func _version(info: Variant) -> int:
	var v = info.getLongVersionCode()
	return 0 if v == null or _failed() else int(v)


static func _matches_package_and_signers(next: Variant, current: Variant, package_id: String) -> bool:
	# JavaClassWrapper exposes methods, so read documented SDK fields via reflection.
	# GET_SIGNATURES is used only to compare the same single signer on these LAB APKs.
	var class_api = JavaClassWrapper.wrap("java.lang.Class")
	var arrays = JavaClassWrapper.wrap("java.lang.reflect.Array")
	var objects = JavaClassWrapper.wrap("java.util.Objects")
	if class_api == null or arrays == null or objects == null:
		return false
	var info_type = class_api.forName("android.content.pm.PackageInfo")
	if info_type == null or _failed():
		return false
	var package_field = info_type.getField("packageName")
	if package_field == null or _failed():
		return false
	var package_value = package_field.get(next)
	if package_value == null or _failed():
		return false
	var archive_package: String
	if package_value is String:
		archive_package = package_value
	else:
		archive_package = str(package_value.toString())
		if _failed():
			return false
	if archive_package != package_id:
		return false
	var signature_field = info_type.getField("signatures")
	if signature_field == null or _failed():
		return false
	var old_signatures = signature_field.get(current)
	if old_signatures == null or _failed():
		return false
	var new_signatures = signature_field.get(next)
	if new_signatures == null or _failed():
		return false
	if old_signatures is Array and new_signatures is Array:
		if old_signatures.size() != 1 or new_signatures.size() != 1:
			return false
		var old_sig = old_signatures[0]
		var new_sig = new_signatures[0]
		if old_sig == null or new_sig == null:
			return false
		var same: bool = old_sig.equals(new_sig)
		return same and not _failed()
	var old_size = arrays.getLength(old_signatures)
	if _failed() or old_size != 1:
		return false
	var new_size = arrays.getLength(new_signatures)
	if _failed() or new_size != 1:
		return false
	var matches: bool = objects.deepEquals(old_signatures, new_signatures)
	return matches and not _failed()


static func _failed() -> bool:
	return JavaClassWrapper.get_exception() != null
