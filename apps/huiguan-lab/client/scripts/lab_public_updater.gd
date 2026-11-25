extends CanvasLayer
## Public release only. Separate from the existing tester-only update channel.

const Release = preload("res://scripts/lab_public_release_manifest.gd")
const Android = preload("res://scripts/lab_update_installer.gd")
const Windows = preload("res://scripts/lab_windows_update_install.gd")
const CONFIG := "res://data/lab_public_update_config.json"
const DIR := "user://updates"
const PART := DIR + "/verified-public-download.part"
const WIN_PATH := DIR + "/huiguan-next.exe"
const ASSET_HOSTS := ["release-assets.githubusercontent.com", "objects.githubusercontent.com", "github-releases.githubusercontent.com"]

var _platform := ""
var _installed := 0
var _trust := ""
var _certificate := ""
var _selected := {}
var _dialog: ConfirmationDialog
var _state := ""
var _request: HTTPRequest
var _serial := 0
var _digest_task := -1
var _computed := ""
var _checking := false


func _ready() -> void:
	_platform = "android" if OS.has_feature("android") else ("windows" if OS.has_feature("windows") else "")
	if _platform.is_empty() or not OS.has_feature("lab_public_release") or not FileAccess.file_exists(CONFIG):
		queue_free()
		return
	var conf: Variant = JSON.parse_string(FileAccess.get_file_as_string(CONFIG))
	if not conf is Dictionary:
		queue_free()
		return
	_trust = str(conf.get("metadata_public_key_pem", ""))
	_certificate = str(conf.get("android_signer_sha256", ""))
	_installed = Android.installed_version() if _platform == "android" else int(conf.get("build", 0))
	if _trust.is_empty() or _installed < 1:
		queue_free()
		return
	layer = 25
	_dialog = ConfirmationDialog.new()
	_dialog.title = "西木会馆更新"
	_dialog.confirmed.connect(_confirmed)
	_dialog.canceled.connect(_cancel)
	add_child(_dialog)
	_fetch_update.call_deferred()


static func _source_allowed(url: String) -> bool:
	if url.begins_with(Release.REPO + "/releases/") and not url.contains("\\") and not url.contains("/../"):
		return true
	if not url.begins_with("https://"):
		return false
	return url.trim_prefix("https://").get_slice("/", 0) in ASSET_HOSTS


func _fetch(url: String, limit: int, serial: int, output := "") -> Array:
	for attempt in range(5):
		if serial != _serial or not _source_allowed(url):
			return []
		var request := HTTPRequest.new()
		request.timeout = 300.0 if not output.is_empty() else 12.0
		request.max_redirects = 0
		request.body_size_limit = limit
		request.download_file = output
		_request = request
		add_child(request)
		var response: Array = []
		if request.request(url, PackedStringArray(["Accept-Encoding: identity"])) == OK:
			response = await request.request_completed
		if is_instance_valid(request): request.queue_free()
		if _request == request: _request = null
		if serial != _serial or response.is_empty():
			return []
		if int(response[1]) in [301, 302, 303, 307, 308]:
			url = ""
			for header: String in response[2]:
				if header.to_lower().begins_with("location:"):
					url = header.substr(9).strip_edges()
					break
			continue
		return response if response[0] == HTTPRequest.RESULT_SUCCESS and response[1] == 200 else []
	return []


func check_now() -> void:
	if _checking or _digest_task != -1 or is_instance_valid(_request):
		return
	if _state == "install" and not _selected.is_empty():
		_show("install", "新版已下载并验证。", "安装并重启" if _platform == "windows" else "安装更新")
		return
	_fetch_update(true)


func _fetch_update(manual := false) -> void:
	if _checking:
		return
	_checking = true
	var response := await _fetch(Release.REPO + "/releases/latest/download/" + Release.MANIFEST_NAME, 16384, _serial)
	_checking = false
	if response.is_empty():
		if manual: _show("result", "暂时查不到发行信息，请稍后再试。", "")
		return
	var packet: Variant = JSON.parse_string(response[3].get_string_from_utf8())
	if not packet is Dictionary or not packet.get("payload") is String or not packet.get("signature") is String:
		if manual: _show("result", "发行信息格式不正确，没有更新。", "")
		return
	_selected = Release.verify_and_select(Marshalls.base64_to_raw(packet.payload), Marshalls.base64_to_raw(packet.signature),
			_trust, _platform, _installed, _certificate)
	if not _selected.is_empty():
		_show("offer", "发现新版（约 %.0f MB）。" % (_selected.size_bytes / 1000000.0), "下载更新")
	elif manual:
		_show("result", "没有找到可验证的新版本。", "")


func _show(state: String, detail: String, action: String) -> void:
	_state = state
	_dialog.dialog_text = detail
	_dialog.get_ok_button().text = action
	_dialog.get_ok_button().visible = not action.is_empty()
	_dialog.get_cancel_button().text = "取消下载" if state == "download" else "稍后"
	_dialog.popup_centered()


func _confirmed() -> void:
	match _state:
		"offer", "retry": _download.call_deferred()
		"install": _install.call_deferred()


func _cancel() -> void:
	if _state != "download" or _digest_task != -1:
		return
	_serial += 1
	if is_instance_valid(_request):
		_request.cancel_request()
		_request.queue_free()
	_request = null
	if FileAccess.file_exists(PART): DirAccess.remove_absolute(PART)
	_state = "offer"


func _download() -> void:
	if _selected.is_empty() or is_instance_valid(_request) or _digest_task != -1:
		return
	if DirAccess.make_dir_recursive_absolute(DIR) != OK:
		_show("retry", "无法写入更新目录，请检查可用空间。", "重试")
		return
	var serial := _serial
	if FileAccess.file_exists(PART): DirAccess.remove_absolute(PART)
	_show("download", "正在下载客户端更新…", "")
	var response := await _fetch(_selected.url, int(_selected.size_bytes), serial, PART)
	if serial != _serial: return
	var file := FileAccess.open(PART, FileAccess.READ)
	var complete := not response.is_empty() and file != null and file.get_length() == int(_selected.size_bytes)
	if file: file.close()
	if not complete:
		_failed_download("下载未完成，请重试。")
		return
	_show("verify", "正在检查签名对应的安装包…", "")
	_computed = ""
	_digest_task = WorkerThreadPool.add_task(func(): _computed = FileAccess.get_sha256(PART))
	while not WorkerThreadPool.is_task_completed(_digest_task):
		await get_tree().process_frame
	WorkerThreadPool.wait_for_task_completion(_digest_task)
	_digest_task = -1
	if _computed != _selected.sha256:
		_failed_download("安装包校验不匹配，没有安装。")
		return
	var path := Android.APK_PATH if _platform == "android" else WIN_PATH
	if FileAccess.file_exists(path): DirAccess.remove_absolute(path)
	if DirAccess.rename_absolute(PART, path) != OK:
		_failed_download("无法保留下载的安装包。")
		return
	_show("install", "新版已下载并验证。", "安装并重启" if _platform == "windows" else "安装更新")


func _failed_download(text: String) -> void:
	if FileAccess.file_exists(PART): DirAccess.remove_absolute(PART)
	_show("retry", text, "重新下载")


func _install() -> void:
	if _selected.is_empty(): return
	if _platform == "android":
		var installer = Engine.get_singleton("LabPublicUpdateInstaller")
		var result := int(installer.install(int(_selected.build), _certificate)) if installer != null else Android.UNAVAILABLE
		match result:
			Android.OPENED_INSTALLER: pass
			Android.OPENED_SOURCE_SETTINGS: _show("install", "允许西木会馆安装此更新后，返回游戏再点安装。", "安装更新")
			_: _failed_download("版本或签名校验失败，Android 未安装。")
	elif Windows.start_verified_swap(WIN_PATH, _selected.sha256):
		get_tree().quit()
	else:
		_show("install", "无法替换当前安装。请检查目录写入权限，或从 Releases 手动安装。", "重试安装")


func _exit_tree() -> void:
	if _digest_task != -1:
		WorkerThreadPool.wait_for_task_completion(_digest_task)
