extends Node
## WebSocket client for the LAB realtime protocol (JSON text frames, protocol 1).
## In the browser the session cookie rides on the same-origin wss:// handshake.
## On desktop (tests, development) pass --lab-url=ws://127.0.0.1:18300/ws --lab-cookie=<cookie>.

signal message(msg: Dictionary)
signal state_changed(state: String, detail: String)
signal account_link_prompt(match_code: String)
signal account_link_result(ok: bool)

const VERSION := "lab-client-2.0.0"
var socket := WebSocketPeer.new()
var url := ""
var cookie := ""
var state := "idle"
var _retry_at := 0.0
var _retries := 0
var _ping_at := 0.0
var _ping_sent := {}
var rtt_ms := 0.0
var stopped := false
var account_approval_url := ""
var account_match_code := ""
var account_flow := 0


func _ready() -> void:
	set_process(true)
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--lab-url="):
			url = arg.trim_prefix("--lab-url=")
		elif arg.begins_with("--lab-cookie="):
			cookie = arg.trim_prefix("--lab-cookie=")
	if url == "" and OS.has_feature("web"):
		var loc = JavaScriptBridge.get_interface("location")
		var scheme := "wss://" if str(loc.protocol) == "https:" else "ws://"
		url = scheme + str(loc.host) + "/ws"
	if url == "":
		url = "ws://127.0.0.1:18300/ws" if OS.has_feature("editor") else "wss://pc-lab.iridescently.cn/ws"


func connect_to_server() -> void:
	if not OS.has_feature("web") and cookie.is_empty():
		require_login("")
		return
	stopped = false
	socket = WebSocketPeer.new()
	socket.inbound_buffer_size = 4 * 1024 * 1024
	socket.outbound_buffer_size = 4 * 1024 * 1024
	socket.max_queued_packets = 4096
	if cookie != "" and not OS.has_feature("web"):
		socket.handshake_headers = PackedStringArray(["Cookie: " + cookie, "Origin: " + http_base()])
	var err := socket.connect_to_url(url)
	_set_state("connecting", url if err == OK else "connect error %d" % err)


func close() -> void:
	stopped = true
	socket.close(1000, "bye")


func http_base() -> String:
	return url.trim_suffix("/ws").replace("wss://", "https://").replace("ws://", "http://")


func require_login(detail: String) -> void:
	close()
	cookie = ""
	_retries = 0
	_set_state("login", detail)


func _native_request(base: String, path: String, method: HTTPClient.Method, headers: PackedStringArray, body := "") -> Array:
	var http := HTTPRequest.new()
	http.timeout = 8.0
	http.max_redirects = 0
	add_child(http)
	var response: Array = []
	if http.request(base + path, headers, method, body) == OK:
		response = await http.request_completed
	http.queue_free()
	return response


func login_native(base: String, code: String) -> void:
	if OS.has_feature("web") or state != "login":
		return
	base = base.strip_edges().trim_suffix("/")
	var endpoint := RegEx.new()
	endpoint.compile("^https://[a-zA-Z0-9.-]+(:[0-9]{1,5})?$|^http://(127\\.0\\.0\\.1|localhost)(:[0-9]{1,5})?$")
	if not endpoint.search(base):
		_set_state("login", "请输入 HTTPS 服务器地址。本机调试可使用 http://127.0.0.1:端口")
		return
	if code.strip_edges().is_empty():
		_set_state("login", "请输入测试码")
		return
	url = base.replace("https://", "wss://").replace("http://", "ws://") + "/ws"
	_set_state("authenticating")
	var reply := await _native_request(base, "/api/login", HTTPClient.METHOD_POST,
			PackedStringArray(["Content-Type: application/json", "Origin: " + base]), JSON.stringify({"code": code.strip_edges()}))
	if state != "authenticating":
		return
	if not reply.is_empty() and reply[0] == HTTPRequest.RESULT_SUCCESS:
		match int(reply[1]):
			200:
				for header: String in reply[2]:
					if header.to_lower().begins_with("set-cookie:"):
						var pair := header.substr(header.find(":") + 1).strip_edges().get_slice(";", 0)
						if pair.begins_with("zszm_lab_session=") and pair.length() > "zszm_lab_session=".length():
							cookie = pair
							connect_to_server()
							return
			401:
				_set_state("login", "测试码无效或已停用")
				return
			429:
				_set_state("login", "尝试次数过多，请稍后重试")
				return
	_set_state("login", "登录失败，请检查服务器地址和网络")


func _account_result(reply: Array) -> Dictionary:
	if reply.is_empty() or reply[0] != HTTPRequest.RESULT_SUCCESS or reply[1] != 200:
		return {}
	var parsed = JSON.parse_string(reply[3].get_string_from_utf8())
	return parsed if parsed is Dictionary else {}


func cancel_account_login(linking := false) -> void:
	account_flow += 1
	account_approval_url = ""
	account_match_code = ""
	if not linking:
		require_login("")


func login_account_native(base: String, linking := false) -> void:
	if OS.has_feature("web") or (state != "open" if linking else state != "login"):
		return
	base = base.strip_edges().trim_suffix("/")
	if base != "https://pc-lab.iridescently.cn" and not (OS.is_debug_build() and base.begins_with("http://127.0.0.1:") and base == http_base()):
		if linking:
			account_link_result.emit(false)
		else:
			_set_state("login", "会馆账号登录仅支持官方 LAB。")
		return
	var endpoint := RegEx.new()
	endpoint.compile("^https://[a-zA-Z0-9.-]+(:[0-9]{1,5})?$|^http://(127\\.0\\.0\\.1|localhost)(:[0-9]{1,5})?$")
	if not endpoint.search(base):
		_set_state("login", "会馆账号登录需要 HTTPS LAB 地址。")
		return
	account_flow += 1
	var attempt := account_flow
	var mode := "link" if linking else "login"
	if not linking:
		_set_state("authenticating")
	var headers := PackedStringArray(["Content-Type: application/json", "Origin: " + base])
	if linking:
		headers.append("Cookie: " + cookie)
	var reply := await _native_request(base, "/api/account/start", HTTPClient.METHOD_POST, headers, JSON.stringify({"mode": mode}))
	if attempt != account_flow:
		return
	var data := _account_result(reply)
	var approver := RegEx.new()
	var prod := "https://huiguan\\.iridescently\\.(cn|xyz)"
	var loopback := "|http://127\\.0\\.0\\.1:[0-9]{1,5}" if OS.is_debug_build() and base.begins_with("http://127.0.0.1:") else ""
	approver.compile("^(" + prod + loopback + ")/api/lab-auth/approve\\?request_id=[A-Za-z0-9_-]{12,200}$")
	var approval := str(data.get("approval_url", ""))
	var matches := RegEx.new()
	matches.compile("^[0-9]{6}$")
	var key := str(data.get("poll_key", ""))
	var ttl := clampi(int(data.get("expires_in", 0)), 0, 600)
	if not approver.search(approval) or not matches.search(str(data.get("match_code", ""))) or key.length() != 43 or ttl < 1:
		if linking:
			account_link_result.emit(false)
			return
		_set_state("login", "会馆账号登录未开放或暂不可用。你仍可使用测试码。")
		return
	account_approval_url = approval
	account_match_code = str(data["match_code"])
	if linking:
		account_link_prompt.emit(account_match_code)
	else:
		_set_state("account_approval")
	var until := Time.get_ticks_msec() + ttl * 1000
	while attempt == account_flow and Time.get_ticks_msec() < until:
		await get_tree().create_timer(2.5).timeout
		if attempt != account_flow:
			return
		reply = await _native_request(base, "/api/account/poll", HTTPClient.METHOD_POST, headers,
				JSON.stringify({"mode": mode, "poll_key": key}))
		if attempt != account_flow:
			return
		data = _account_result(reply)
		if data.get("status") == "pending":
			continue
		if data.get("status") == "ok":
			for header: String in reply[2]:
				if header.to_lower().begins_with("set-cookie:"):
					var pair := header.substr(header.find(":") + 1).strip_edges().get_slice(";", 0)
					if pair.begins_with("zszm_lab_session=") and pair.length() > "zszm_lab_session=".length():
						account_approval_url = ""
						account_match_code = ""
						url = base.replace("https://", "wss://").replace("http://", "ws://") + "/ws"
						cookie = pair
						if linking:
							socket.close(1000, "linked")
							account_link_result.emit(true)
						connect_to_server()
						return
		break
	account_approval_url = ""
	account_match_code = ""
	if linking:
		account_link_result.emit(false)
		return
	_set_state("login", "授权未完成、已拒绝或已过期，请重试。")


func logout_native() -> void:
	var session_cookie := cookie
	var base := http_base()
	close()
	cookie = ""
	_set_state("logging_out")
	var reply := await _native_request(base, "/api/logout", HTTPClient.METHOD_POST,
			PackedStringArray(["Cookie: " + session_cookie]))
	var acknowledged: bool = not reply.is_empty() and reply[0] == HTTPRequest.RESULT_SUCCESS and reply[1] == 200
	require_login("已退出会馆" if acknowledged else "本机已退出，服务器暂时无法确认会话注销")


func _retry_native() -> void:
	# A rejected HTTP upgrade has no WebSocket close code. Check the same session before retrying.
	_set_state("checking_session")
	var reply := await _native_request(http_base(), "/api/me", HTTPClient.METHOD_GET, PackedStringArray(["Cookie: " + cookie]))
	if state != "checking_session":
		return
	if not reply.is_empty() and reply[0] == HTTPRequest.RESULT_SUCCESS and reply[1] == 401:
		require_login("会话已过期或测试码已停用，请重新登录")
		return
	connect_to_server()


func send(msg: Dictionary) -> void:
	if socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		socket.send_text(JSON.stringify(msg))


func _set_state(s: String, detail := "") -> void:
	if s != state or detail != "":
		state = s
		state_changed.emit(s, detail)


func _process(_delta: float) -> void:
	socket.poll()
	var rs := socket.get_ready_state()
	if rs == WebSocketPeer.STATE_OPEN:
		if state != "open":
			_retries = 0
			_set_state("open")
			send({"t": "hello", "client": Profile.view_mode, "version": VERSION})
		while socket.get_available_packet_count() > 0:
			var text := socket.get_packet().get_string_from_utf8()
			var parsed = JSON.parse_string(text)
			if typeof(parsed) == TYPE_DICTIONARY:
				if parsed.get("t") == "pong":
					_on_pong(parsed)
				else:
					message.emit(parsed)
		var now := Time.get_ticks_msec() / 1000.0
		if now > _ping_at:
			_ping_at = now + 5.0
			var pid := str(Time.get_ticks_msec())
			_ping_sent[pid] = Time.get_ticks_msec()
			send({"t": "ping", "id": pid})
	elif rs == WebSocketPeer.STATE_CLOSED:
		if state == "open" or state == "connecting":
			var code := socket.get_close_code()
			_set_state("closed", "%d %s" % [code, socket.get_close_reason()])
			if code == 4401 or code == 4403:
				stopped = true          # session gone or refused: go back to the code page, no retry loop
				_set_state("unauthorized", str(code))
			else:
				_retries += 1
				_retry_at = Time.get_ticks_msec() / 1000.0 + min(10.0, 0.5 * pow(2.0, _retries))
		if not stopped and state == "closed" and Time.get_ticks_msec() / 1000.0 > _retry_at:
			_set_state("reconnecting", "attempt %d" % _retries)
			if OS.has_feature("web"):
				connect_to_server()
			else:
				_retry_native()


func _on_pong(msg: Dictionary) -> void:
	var sent = _ping_sent.get(str(msg.get("id")), null)
	if sent != null:
		_ping_sent.erase(str(msg.get("id")))
		rtt_ms = float(Time.get_ticks_msec() - int(sent))
		send({"t": "rtt", "ms": rtt_ms})
