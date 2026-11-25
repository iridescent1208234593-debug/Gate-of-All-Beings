extends RefCounted
## Same-device Windows return channel. No session or account password passes through it.

const CALLBACK := "/lab-account/callback"
const LIMIT := 8192
const LEASE_MS := 300000
var _listener := TCPServer.new()
var _clients: Array[Dictionary] = []
var _pattern := RegEx.new()
var _port := 0
var _ending := 0
var state := ""
var verifier := ""


func _init() -> void:
	_pattern.compile("^/lab-account/callback\\?code=([A-Za-z0-9_-]{43})&state=([A-Za-z0-9_-]{43})$")


static func _b64(bytes: PackedByteArray) -> String:
	return Marshalls.raw_to_base64(bytes).replace("+", "-").replace("/", "_").trim_suffix("=")


func start(base: String) -> String:
	stop()
	if _listener.listen(0, "127.0.0.1") != OK:
		return ""
	_port = _listener.get_local_port()
	if _port < 49152 or _port > 65535:
		stop()
		return ""
	var rng := Crypto.new()
	state = _b64(rng.generate_random_bytes(32))
	verifier = _b64(rng.generate_random_bytes(32))
	if state.length() != 43 or verifier.length() != 43:
		stop()
		return ""
	_ending = Time.get_ticks_msec() + LEASE_MS
	return "%s/account/native/start?port=%d&state=%s&challenge=%s" % [base, _port, state, _b64(verifier.sha256_buffer())]


func stop() -> void:
	_listener.stop()
	for c in _clients:
		c.peer.disconnect_from_host()
	_clients.clear()
	_port = 0
	_ending = 0
	state = ""
	verifier = ""


func tick() -> Dictionary:
	if _ending == 0:
		return {}
	var now := Time.get_ticks_msec()
	if now >= _ending:
		stop()
		return {"expired": true}
	while _clients.size() < 4 and _listener.is_connection_available():
		var peer := _listener.take_connection()
		if peer == null:
			break
		_clients.append({"peer": peer, "bytes": PackedByteArray(), "until": now + 2500})
	for i in range(_clients.size() - 1, -1, -1):
		var client := _clients[i]
		var peer: StreamPeerTCP = client.peer
		peer.poll()
		if peer.get_status() != StreamPeerTCP.STATUS_CONNECTED or now >= int(client.until):
			_drop(i)
			continue
		var length := peer.get_available_bytes()
		if length == 0:
			continue
		var data: PackedByteArray = client.bytes
		if data.size() + length > LIMIT:
			_reply(peer, false)
			_drop(i)
			continue
		var read := peer.get_data(length)
		if read[0] != OK:
			_drop(i)
			continue
		data.append_array(read[1])
		client.bytes = data
		var request := data.get_string_from_ascii()
		if not request.contains("\r\n\r\n"):
			continue
		var result := _parse(request.get_slice("\r\n\r\n", 0))
		_reply(peer, not result.is_empty())
		_drop(i)
		if not result.is_empty():
			stop()
			return result
	return {}


func _drop(index: int) -> void:
	_clients[index].peer.disconnect_from_host()
	_clients.remove_at(index)


func _parse(request: String) -> Dictionary:
	var lines := request.split("\r\n", false)
	if lines.is_empty():
		return {}
	var first := lines[0].split(" ", false)
	if first.size() != 3 or first[0] != "GET" or first[2] != "HTTP/1.1":
		return {}
	var host_count := 0
	for line in lines.slice(1):
		if line.to_lower().begins_with("host:"):
			host_count += 1
			if line.substr(5).strip_edges() != "127.0.0.1:%d" % _port:
				return {}
	if host_count != 1:
		return {}
	var matched := _pattern.search(first[1])
	if matched == null or matched.get_string(2) != state:
		return {}
	return {"code": matched.get_string(1), "state": state, "verifier": verifier}


func _reply(peer: StreamPeerTCP, accepted: bool) -> void:
	var html := "<!doctype html><meta charset=utf-8><title>西木会馆</title><p>" + (
			"浏览器授权已返回，请回到游戏查看登录结果。" if accepted else "无法返回游戏，请在游戏内重新发起登录。") + "</p>"
	var header := "HTTP/1.1 %s\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'none'; frame-ancestors 'none'\r\nConnection: close\r\nContent-Length: %d\r\n\r\n" % [
			"200 OK" if accepted else "400 Bad Request", html.to_utf8_buffer().size()]
	peer.put_data((header + html).to_utf8_buffer())
