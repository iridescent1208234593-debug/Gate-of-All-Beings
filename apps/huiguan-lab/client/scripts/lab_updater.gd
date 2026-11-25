extends CanvasLayer
## LAB Android channel. A manifest can only name a greater version, not a URL.
const Installer = preload("res://scripts/lab_update_installer.gd")
const ORIGIN := "https://pc-lab.iridescently.cn"
const MANIFEST := ORIGIN + "/static/android-update-range.json"
const APK_ROUTE := ORIGIN + "/api/updates/android/"
const DIR := "user://updates"
const PART := DIR + "/huiguan-next.part"
const PACKAGE := DIR + "/huiguan-next.apk"
const CHUNK := DIR + "/huiguan-chunk.part"
const CHUNK_BYTES := 4 * 1024 * 1024
const MAX_BYTES := 256 * 1024 * 1024

var installed := 0
var update := {}
var transfer: HTTPRequest
var dialog: ConfirmationDialog
var phase := ""
var hash_task := -1
var digest := []
var waiting_for_login := false
var bytes_written := 0
var piece_end := 0
var failures := 0
@onready var lab_net = get_node_or_null("/root/Net")


func _ready() -> void:
	layer = 20
	installed = Installer.installed_version()
	if installed <= 0 or lab_net == null:
		queue_free()
		return
	dialog = ConfirmationDialog.new()
	dialog.title = "西木会馆 · 客户端更新"
	dialog.get_cancel_button().text = "稍后"
	dialog.confirmed.connect(_continue)
	dialog.canceled.connect(_cancel)
	add_child(dialog)
	lab_net.state_changed.connect(_on_lab_state)
	set_process(false)
	_check.call_deferred()


func _request(limit: int, timeout: float) -> HTTPRequest:
	var req := HTTPRequest.new()
	req.max_redirects = 0
	req.body_size_limit = limit
	req.timeout = timeout
	add_child(req)
	return req


func _check() -> void:
	var req := _request(8192, 8.0)
	req.request_completed.connect(func(result: int, code: int, _headers: PackedStringArray, body: PackedByteArray):
		req.queue_free()
		if result != HTTPRequest.RESULT_SUCCESS or code != 200:
			return # The update channel never gates ordinary login.
		update = validate_manifest(JSON.parse_string(body.get_string_from_utf8()), installed)
		if not update.is_empty():
			_offer())
	if req.request(MANIFEST) != OK:
		req.queue_free()


func _offer() -> void:
	var suffix := "" if _has_lab_session() else "\n仅已登录的测试员可以下载。"
	_show("offer", "发现新版 %d（约 %.0f MB）。%s" % [update.version_code, update.size_bytes / 1000000.0, suffix],
			"下载更新" if _has_lab_session() else "先登录")


func _has_lab_session() -> bool:
	return not _download_headers().is_empty()


func _download_headers() -> PackedStringArray:
	return authenticated_headers(lab_net.state, lab_net.http_base(), lab_net.cookie)


static func authenticated_headers(state: String, origin: String, cookie: String) -> PackedStringArray:
	if state != "open" or origin != ORIGIN or not cookie.begins_with("zszm_lab_session="):
		return PackedStringArray()
	var token := cookie.trim_prefix("zszm_lab_session=")
	if token.is_empty() or token.contains("\r") or token.contains("\n") or token.contains(";"):
		return PackedStringArray()
	return PackedStringArray(["Cookie: " + cookie])


func _on_lab_state(state: String, _detail: String) -> void:
	if state == "open" and waiting_for_login and _has_lab_session():
		waiting_for_login = false
		_offer.call_deferred()


static func validate_manifest(value: Variant, current: int) -> Dictionary:
	if not value is Dictionary or value.get("schema") != 1:
		return {}
	var version: Variant = value.get("version_code")
	var bytes: Variant = value.get("size_bytes")
	var sha: Variant = value.get("sha256")
	if not _whole_number(version, current + 1, 2100000000) or not _whole_number(bytes, 1, MAX_BYTES):
		return {}
	if not sha is String or sha.length() != 64:
		return {}
	for ch in sha:
		if not ch in "0123456789abcdef":
			return {}
	return {"version_code": int(version), "size_bytes": int(bytes), "sha256": sha}


static func _whole_number(value: Variant, smallest: int, largest: int) -> bool:
	return (value is int or value is float) and value >= smallest and value <= largest and value == floor(value)


func _show(next_phase: String, description: String, action: String) -> void:
	phase = next_phase
	dialog.dialog_text = description
	dialog.get_ok_button().text = action
	dialog.get_ok_button().visible = not action.is_empty()
	dialog.get_cancel_button().text = "取消下载" if phase == "downloading" else "稍后"
	dialog.get_cancel_button().visible = phase != "verifying"
	dialog.popup_centered()


func _continue() -> void:
	match phase:
		"offer", "retry":
			if _has_lab_session():
				_download.call_deferred()
			else:
				waiting_for_login = true
		"install":
			_install.call_deferred()


func _download() -> void:
	if is_instance_valid(transfer) or hash_task != -1:
		return
	if not _has_lab_session():
		waiting_for_login = true
		_show("offer", "请先用这个会馆的测试码登录，再下载更新。", "先登录")
		return
	if DirAccess.make_dir_recursive_absolute(DIR) != OK:
		_show("retry", "无法写入更新目录，请检查手机剩余空间。", "重试")
		return
	_clear_parts()
	DirAccess.remove_absolute(PACKAGE)
	bytes_written = 0
	failures = 0
	var file := FileAccess.open(PART, FileAccess.WRITE)
	if not file:
		_show("retry", "无法写入更新目录，请检查手机剩余空间。", "重试")
		return
	file.close()
	_show("downloading", "正在下载更新…", "")
	set_process(true)
	_request_next()


func _request_next() -> void:
	if phase != "downloading" or is_instance_valid(transfer):
		return
	var headers := _download_headers()
	if headers.is_empty():
		_stop_download(true)
		return
	piece_end = mini(bytes_written + CHUNK_BYTES, int(update.size_bytes)) - 1
	var length := piece_end - bytes_written + 1
	headers.append("Range: bytes=%d-%d" % [bytes_written, piece_end])
	headers.append("Accept-Encoding: identity")
	transfer = _request(length, 45.0)
	transfer.accept_gzip = false
	transfer.download_file = CHUNK
	transfer.request_completed.connect(_download_piece)
	if transfer.request(APK_ROUTE + str(update.version_code), headers) != OK:
		_download_piece(FAILED, 0, PackedStringArray(), PackedByteArray())


static func valid_range(headers: PackedStringArray, first: int, last: int, total: int) -> bool:
	var expected := "bytes %d-%d/%d" % [first, last, total]
	for header in headers:
		if header.to_lower().begins_with("content-range:"):
			return header.substr("content-range:".length()).strip_edges().to_lower() == expected
	return false


func _download_piece(result: int, code: int, headers: PackedStringArray, _body: PackedByteArray) -> void:
	transfer.queue_free()
	transfer = null
	if code == 401 or code == 403:
		_stop_download(true)
		return
	var file := FileAccess.open(CHUNK, FileAccess.READ)
	var length := piece_end - bytes_written + 1
	if result != HTTPRequest.RESULT_SUCCESS or code != 206 or not file or file.get_length() != length or not valid_range(headers, bytes_written, piece_end, update.size_bytes):
		file = null
		DirAccess.remove_absolute(CHUNK)
		failures += 1
		if failures < 3:
			get_tree().create_timer(0.75 * failures).timeout.connect(_request_next)
		else:
			_stop_download()
		return
	var data := file.get_buffer(length)
	file.close()
	DirAccess.remove_absolute(CHUNK)
	var output := FileAccess.open(PART, FileAccess.READ_WRITE)
	if not output or output.get_length() != bytes_written or data.size() != length:
		output = null
		_stop_download()
		return
	output.seek(bytes_written)
	output.store_buffer(data)
	output.flush()
	var written := output.get_error() == OK and output.get_length() == piece_end + 1
	output.close()
	if not written:
		_stop_download()
		return
	bytes_written += length
	failures = 0
	if bytes_written < update.size_bytes:
		_request_next.call_deferred()
		return
	_show("verifying", "正在校验安装包…", "")
	digest = [""]
	hash_task = WorkerThreadPool.add_task(func(): digest[0] = FileAccess.get_sha256(PART))


func _process(_delta: float) -> void:
	if phase == "downloading":
		var received := bytes_written + (transfer.get_downloaded_bytes() if is_instance_valid(transfer) else 0)
		var pct := clampi(floori(float(received) * 100.0 / float(update.size_bytes)), 0, 100)
		dialog.dialog_text = "正在下载更新… %d%%" % pct
	elif hash_task != -1 and WorkerThreadPool.is_task_completed(hash_task):
		WorkerThreadPool.wait_for_task_completion(hash_task)
		hash_task = -1
		set_process(false)
		if digest[0] != update.sha256 or DirAccess.rename_absolute(PART, PACKAGE) != OK:
			_clear_parts()
			_show("retry", "安装包完整性校验失败，未安装。", "重试")
		else:
			_show("install", "下载及校验完成。点击安装，在系统界面确认更新。", "安装更新")


func _clear_parts() -> void:
	DirAccess.remove_absolute(CHUNK)
	DirAccess.remove_absolute(PART)


func _stop_download(auth_error := false) -> void:
	_clear_parts()
	set_process(false)
	if auth_error:
		waiting_for_login = true
		_show("offer", "会话未获下载授权，请重新登录。", "先登录")
	else:
		_show("retry", "下载未完成，不影响进入游戏。", "重试")


func _cancel() -> void:
	if phase != "downloading":
		return
	phase = ""
	if is_instance_valid(transfer):
		transfer.cancel_request()
		transfer.queue_free()
		transfer = null
	_clear_parts()
	set_process(false)


func _install() -> void:
	match Installer.request_install(update.version_code):
		0:
			pass
		1:
			_show("install", "若系统要求，请允许西木会馆安装其更新；返回游戏后再点安装。", "安装更新")
		_:
			DirAccess.remove_absolute(PACKAGE)
			_show("retry", "无法启动系统安装，或安装包验证未通过。", "重新下载")


func _exit_tree() -> void:
	if hash_task != -1:
		WorkerThreadPool.wait_for_task_completion(hash_task)
