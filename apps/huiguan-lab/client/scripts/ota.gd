extends Node
## Android 自更新（OTA）。
##
## 启动与回到前台时读一份 version.json，比较 versionCode；服务器更大就提示、
## 用系统下载器取 APK、校验 SHA-256、再拉起系统安装器。不是热更新，是整包替换。
##
## 这套机制与《拾灵》App 一致，几条容易踩的坑在这里也照做：
##  - 只比 versionCode，不比 versionName。
##  - 「稍后」只在本次运行内不再打扰（内存变量），下次打开继续提示，直到真的更新。
##  - 下载后必须校验 SHA-256，不匹配就删文件并拒绝安装。
##  - 定时器只在原生侧跑，网页/场景白屏不影响更新检查。
##
## 桌面与网页端整体跳过：只有 Android 导出才有意义。

signal update_available(info: Dictionary)
signal download_progress(percent: int)
signal download_failed(reason: String)
signal download_ready

## 总开关。false = 暂时关闭自更新，但整条实现保留在这里，随时可以改回 true
## 重新启用。关闭期间：不读清单、不弹窗、不创建 HTTPRequest，也不碰 LabOta 插件，
## 相当于这套东西不存在，但代码和原生侧都还在，不需要重新接一遍。
##
## 关闭原因：整包 145 MB，用 OTA 下载体验差、流量也贵；等包体压下来或改成
## 增量分发的方案再开。
const FEATURE_ENABLED := false

## 版本清单地址。暂时置空：自更新关闭期间不读任何清单，也不留可被误用的地址。
## 重新启用时把下面注释里的地址填回来，并把 FEATURE_ENABLED 改成 true。
##   https://ota.umrca.com/ota/cn-iridescently-huiguan-lab-prev/version.json
const DEFAULT_MANIFEST := ""
## 前台停留期间的复查间隔。
const CHECK_INTERVAL := 30 * 60.0

var manifest_url := DEFAULT_MANIFEST
var enabled := false
var remote := {}
var local_code := 0
var local_name := ""

var _prompted_code := 0          ## 本次运行内已提示过的 versionCode（内存，不落盘）
var _timer := 0.0
var _checking := false
var _downloading := false
var _poll := 0.0
var _plugin = null
var _http: HTTPRequest
var _manual := false             ## 本次查询是否由用户主动触发
var _no_update_cb: Callable = Callable()


## 自更新当前是否开启。UI 用它决定要不要显示「检查更新」，
## 用方法而不是直接读常量，autoload 实例上访问更稳妥。
func feature_enabled() -> bool:
	return FEATURE_ENABLED


func _ready() -> void:
	enabled = OS.has_feature("mobile") and OS.get_name() == "Android"
	if not FEATURE_ENABLED:
		# 暂时关闭：整条 OTA 不初始化，不建 HTTPRequest，不碰插件。
		enabled = false
		set_process(false)
		return
	if OS.has_environment("LAB_OTA_URL") and OS.get_environment("LAB_OTA_URL") != "":
		manifest_url = OS.get_environment("LAB_OTA_URL")
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--lab-ota="):
			manifest_url = arg.trim_prefix("--lab-ota=")
	if not enabled:
		set_process(false)
		return
	_plugin = Engine.get_singleton("LabOta")
	if _plugin == null:
		push_warning("OTA: LabOta 插件未注册，自更新不可用")
		enabled = false
		set_process(false)
		return
	local_code = int(_plugin.getVersionCode())
	local_name = str(_plugin.getVersionName())
	_http = HTTPRequest.new()
	_http.timeout = 12.0
	add_child(_http)
	_http.request_completed.connect(_on_manifest)
	# 启动即查一次，之后每 CHECK_INTERVAL 复查。
	check(false)


func _notification(what: int) -> void:
	# 回到前台立刻复查，这是主要触发点（与拾灵一致）。
	if what == NOTIFICATION_APPLICATION_FOCUS_IN or what == NOTIFICATION_WM_WINDOW_FOCUS_IN:
		if enabled:
			check(false)


func _process(delta: float) -> void:
	if not enabled:
		return
	if _downloading:
		_poll += delta
		if _poll >= 0.5:
			_poll = 0.0
			_tick_download()
		return
	_timer += delta
	if _timer >= CHECK_INTERVAL:
		_timer = 0.0
		check(false)


## 查版本清单。manual=true 时忽略「本次运行已提示过」，用于用户主动点检查。
func check(manual: bool) -> void:
	if not FEATURE_ENABLED or not enabled or _checking:
		return
	if manifest_url == "":
		return
	if manual and _plugin != null:
		local_code = int(_plugin.getVersionCode())
		local_name = str(_plugin.getVersionName())
	_checking = true
	var err := _http.request(manifest_url)
	if err != OK:
		_checking = false
		if manual:
			download_failed.emit("无法访问更新服务器")
		return


func _on_manifest(_result: int, code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	_checking = false
	var manual := _manual
	_manual = false
	if code != 200:
		if manual:
			_no_update_cb = Callable()
			download_failed.emit("无法访问更新服务器")
		return
	var data = JSON.parse_string(body.get_string_from_utf8())
	if typeof(data) != TYPE_DICTIONARY:
		return
	remote = data
	var remote_code := int(data.get("versionCode", 0))
	if remote_code <= local_code:
		# 主动检查时告诉用户已是最新，自动检查则安静返回。
		if manual and _no_update_cb.is_valid():
			_no_update_cb.call(local_name)
			_no_update_cb = Callable()
		return
	# 本次运行已经问过同一个版本就不再打扰（用户点了「稍后」）。
	if not manual and remote_code == _prompted_code:
		return
	_prompted_code = remote_code
	update_available.emit(data)


## 用户主动检查；没有新版本时回调 on_latest(本机版本名)。
func check_manual(on_latest := Callable()) -> void:
	if not enabled:
		if on_latest.is_valid():
			on_latest.call("此版本不支持自更新")
		return
	if _plugin != null:
		local_code = int(_plugin.getVersionCode())
		local_name = str(_plugin.getVersionName())
	_no_update_cb = on_latest
	_manual = true
	_prompted_code = -1
	check(true)


## 开始下载。sha256 为空时只靠 HTTPS 兜底（与拾灵一致）。
func start_download() -> bool:
	if not enabled or _plugin == null:
		return false
	var url := str(remote.get("url", remote.get("apkUrl", "")))
	if url == "":
		download_failed.emit("版本清单缺少下载地址")
		return false
	if not bool(_plugin.canInstall()):
		_plugin.openInstallSettings()
		download_failed.emit("请先允许本应用安装应用，然后回到游戏重试")
		return false
	var sha := str(remote.get("sha256", remote.get("apkSha256", "")))
	var name := "lab-%d.apk" % int(remote.get("versionCode", 0))
	if not bool(_plugin.startDownload(url, sha, name)):
		download_failed.emit(str(_plugin.lastError()))
		return false
	_downloading = true
	_poll = 0.0
	return true


func _tick_download() -> void:
	if _plugin == null:
		return
	var p := int(_plugin.progress())
	if p == 2:                       # STATE_READY
		_downloading = false
		if not bool(_plugin.verify()):
			download_failed.emit("安装包校验失败，已删除，请重新下载")
			return
		download_ready.emit()
		return
	if p < 0:                        # STATE_FAILED / CORRUPT / NEED_PERMISSION
		_downloading = false
		download_failed.emit(str(_plugin.lastError()))
		return
	download_progress.emit(clampi(p, 0, 100))


## 拉起系统安装器。校验已通过时调用。
func install() -> void:
	if _plugin == null:
		return
	var r := int(_plugin.install())
	if r == -3:
		_plugin.openInstallSettings()
		download_failed.emit("请先允许本应用安装应用")
	elif r < 0:
		download_failed.emit(str(_plugin.lastError()))


## 读取清单里的 changelog，兼容数组与字符串两种写法。
func changelog_of(info: Dictionary) -> Array:
	var raw = info.get("changelog", info.get("notes", []))
	if typeof(raw) == TYPE_ARRAY:
		return raw
	if typeof(raw) == TYPE_STRING and str(raw) != "":
		return str(raw).split("\n", false)
	return []


func is_forced(info: Dictionary) -> bool:
	return bool(info.get("force", false))
