extends Node
## WebSocket client for the LAB realtime protocol (JSON text frames, protocol 1).
## In the browser the session cookie rides on the same-origin wss:// handshake.
## On desktop (tests, development) pass --lab-url=ws://127.0.0.1:18300/ws --lab-cookie=<cookie>.

signal message(msg: Dictionary)
signal state_changed(state: String, detail: String)

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
		url = "ws://127.0.0.1:18300/ws"


func connect_to_server() -> void:
	stopped = false
	socket = WebSocketPeer.new()
	socket.inbound_buffer_size = 4 * 1024 * 1024
	socket.outbound_buffer_size = 4 * 1024 * 1024
	socket.max_queued_packets = 4096
	if cookie != "" and not OS.has_feature("web"):
		socket.handshake_headers = PackedStringArray(["Cookie: " + cookie])
	var err := socket.connect_to_url(url)
	_set_state("connecting", url if err == OK else "connect error %d" % err)


func close() -> void:
	stopped = true
	socket.close(1000, "bye")


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
			connect_to_server()


func _on_pong(msg: Dictionary) -> void:
	var sent = _ping_sent.get(str(msg.get("id")), null)
	if sent != null:
		_ping_sent.erase(str(msg.get("id")))
		rtt_ms = float(Time.get_ticks_msec() - int(sent))
		send({"t": "rtt", "ms": rtt_ms})
