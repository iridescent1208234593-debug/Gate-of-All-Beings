extends Control
## LAB client shell: connection, first-run profile/OC setup, HUD (chat, emotes, spaces, data),
## input and client prediction. The 2D and 3D views render the same LabWorld.

const SEND_HZ := 12.0
const EMOTE_TEXT := {"wave": "挥手~", "bow": "鞠躬", "heart": "★喜欢", "laugh": "哈哈", "sleep": "Zzz", "surprise": "！？", "music": "啦啦~", "sparkle": "☆闪亮"}
const SPEED := 4.0
var world := LabWorld.new()
var font: Font
var view2d: Node2D
var view3d: Control
var hud: CanvasLayer
var status_label: Label
var top_label: Label
var chat_log: RichTextLabel
var chat_input: LineEdit
var hint_label: Label
var panel_holder: Control
var toast_label: Label
var setup_panel: Control
var editor: Control
var connected_once := false
var welcomed := false
var move_target = null
var last_sent := Vector3.ZERO
var send_timer := 0.0
var seq := 0
var requested_oc := {}
var near_object := ""
var space_spaces: Array = []
var toast_until := 0.0
var auto_actions: Array = []       # --lab-auto=... scripted input for automated browser tests
var auto_t := 0.0
var pending_upload := false
var watch_every := 0.0
var watch_t := 0.0
var guide                          # life_guide.gd: 新人引导「开始生活」
var hud_buttons := {}
var emote_row: Control


func _ready() -> void:
	font = load("res://assets/fonts/NotoSansSC-lab.woff2")
	var theme := Theme.new()
	theme.default_font = font
	theme.default_font_size = 16
	self.theme = theme
	set_anchors_preset(Control.PRESET_FULL_RECT)
	view2d = load("res://scripts/hall2d.gd").new()
	add_child(view2d)
	view2d.setup(world, font)
	view3d = load("res://scripts/hall3d.gd").new()
	var layer3d := CanvasLayer.new()       # own canvas: the 2D view's Camera2D must not move the 3D picture
	layer3d.layer = 0
	add_child(layer3d)
	layer3d.add_child(view3d)
	view3d.setup(world, font)
	_build_hud()
	guide = load("res://scripts/life_guide.gd").new()
	add_child(guide)
	guide.setup(font, func(msg): Net.send(msg))
	guide.register_target("chat", func(): return chat_input.get_global_rect())
	guide.register_target("emotes", func(): return emote_row.get_global_rect())
	guide.register_target("hint", func(): return hint_label.get_global_rect() if hint_label.text != "" else Rect2())
	guide.register_target("spaces", func(): return hud_buttons["虹之间"].get_global_rect())
	guide.register_target("view", func(): return hud_buttons["2D / 3D"].get_global_rect())
	guide.register_target("top", func(): return top_label.get_global_rect())
	guide.register_target("player", func():
		var c := get_viewport().get_visible_rect().size * 0.5
		return Rect2(c + Vector2(-42, -96), Vector2(84, 112)))
	_apply_view()
	Net.message.connect(_on_message)
	Net.state_changed.connect(_on_net_state)
	Net.account_link_prompt.connect(_show_account_link)
	Net.account_link_result.connect(func(ok: bool):
		_clear_panels()
		toast("已绑定，游戏进度不变。" if ok else "未绑定。此测试码可能不在迁移名单，或会馆授权未完成。"))
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--lab-auto="):
			auto_actions = Array(arg.trim_prefix("--lab-auto=").split(";"))
	if OS.has_feature("web"):
		var q = JavaScriptBridge.get_interface("location")
		var search := str(q.search)
		if search.find("auto=") >= 0:
			auto_actions = Array(search.split("auto=")[1].split("&")[0].uri_decode().split(";"))
	Net.connect_to_server()


# ------------------------------------------------------------------ HUD
func _build_hud() -> void:
	hud = CanvasLayer.new()
	add_child(hud)
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.add_child(root)
	var top := PanelContainer.new()
	top.set_anchors_preset(Control.PRESET_TOP_WIDE)
	root.add_child(top)
	var bar := HBoxContainer.new()
	top.add_child(bar)
	top_label = Label.new()
	top_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top_label.text = "西木会馆 LAB"
	bar.add_child(top_label)
	for b in [["2D / 3D", _toggle_view], ["虹之间", _open_spaces], ["我的形象", _open_setup], ["新手引导", _open_guide], ["本地数据", _open_data], ["退出", _logout]]:
		var btn := Button.new()
		btn.text = b[0]
		hud_buttons[b[0]] = btn
		btn.focus_mode = Control.FOCUS_NONE
		btn.pressed.connect(b[1])
		bar.add_child(btn)
	var left := VBoxContainer.new()
	left.anchor_top = 1.0; left.anchor_bottom = 1.0
	left.offset_left = 12; left.offset_top = -260; left.offset_right = 430; left.offset_bottom = -12
	root.add_child(left)
	chat_log = RichTextLabel.new()
	chat_log.custom_minimum_size = Vector2(410, 170)
	chat_log.scroll_following = true
	chat_log.bbcode_enabled = false
	chat_log.add_theme_color_override("default_color", Color.WHITE)
	chat_log.add_theme_constant_override("outline_size", 4)
	chat_log.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.7))
	chat_log.mouse_filter = Control.MOUSE_FILTER_IGNORE
	left.add_child(chat_log)
	var crow := HBoxContainer.new()
	left.add_child(crow)
	chat_input = LineEdit.new()
	chat_input.placeholder_text = "按 Enter 聊天"
	chat_input.max_length = 200
	chat_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	chat_input.text_submitted.connect(_send_chat)
	crow.add_child(chat_input)
	var emotes := HBoxContainer.new()
	emote_row = emotes
	left.add_child(emotes)
	for e in ["wave", "bow", "heart", "laugh", "sleep", "surprise", "music", "sparkle"]:
		var eb := Button.new()
		eb.text = EMOTE_TEXT[e]
		eb.focus_mode = Control.FOCUS_NONE
		eb.add_theme_font_size_override("font_size", 13)
		eb.pressed.connect(func():
			Net.send({"t": "emote", "id": e})
			guide.on_event("emoted"))
		emotes.add_child(eb)
	hint_label = Label.new()
	hint_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	hint_label.offset_top = -90; hint_label.offset_left = -200; hint_label.offset_right = 200
	hint_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint_label.add_theme_constant_override("outline_size", 6)
	hint_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	root.add_child(hint_label)
	toast_label = Label.new()
	toast_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	toast_label.offset_top = 56; toast_label.offset_left = -300; toast_label.offset_right = 300
	toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast_label.add_theme_font_size_override("font_size", 18)
	toast_label.add_theme_constant_override("outline_size", 6)
	toast_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	root.add_child(toast_label)
	status_label = Label.new()
	status_label.set_anchors_preset(Control.PRESET_CENTER)
	status_label.offset_left = -300; status_label.offset_right = 300
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status_label.add_theme_font_size_override("font_size", 22)
	status_label.add_theme_constant_override("outline_size", 8)
	status_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	status_label.text = "正在连接西木会馆…"
	root.add_child(status_label)
	panel_holder = Control.new()
	panel_holder.set_anchors_preset(Control.PRESET_FULL_RECT)
	panel_holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(panel_holder)


func toast(text: String, seconds := 3.5) -> void:
	toast_label.text = text
	toast_until = Time.get_ticks_msec() / 1000.0 + seconds


func _clear_panels() -> void:
	for c in panel_holder.get_children():
		c.queue_free()


func _panel(title: String, width := 520.0) -> VBoxContainer:
	_clear_panels()
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.35)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	panel_holder.add_child(shade)
	var p := PanelContainer.new()
	p.set_anchors_preset(Control.PRESET_CENTER)
	p.custom_minimum_size = Vector2(width, 0)
	p.position = Vector2(-width * 0.5, -230)
	panel_holder.add_child(p)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	p.add_child(box)
	var head := HBoxContainer.new()
	box.add_child(head)
	var l := Label.new(); l.text = title; l.add_theme_font_size_override("font_size", 20)
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(l)
	var x := Button.new(); x.text = "关闭"; x.pressed.connect(_clear_panels); head.add_child(x)
	return box


func _add_button(box: Control, text: String, cb: Callable, name := "") -> Button:
	var b := Button.new()
	b.text = text
	if name != "":
		b.name = name
	b.pressed.connect(cb)
	box.add_child(b)
	return b


# ------------------------------------------------------------------ setup / OC
func _open_setup() -> void:
	var box := _panel("你的昵称与 OC", 560)
	var info := Label.new()
	info.text = "OC 原图只保存在这台设备的浏览器中。联机时服务器只临时转发一份缩小的展示副本给同一空间的玩家，不建立素材库。"
	info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.custom_minimum_size = Vector2(520, 0)
	box.add_child(info)
	var nick := LineEdit.new()
	nick.name = "Nick"
	nick.placeholder_text = "昵称（1-16 字）"
	nick.max_length = 16
	nick.text = Profile.nick
	box.add_child(nick)
	var preview := TextureRect.new()
	preview.custom_minimum_size = Vector2(160, 200)
	preview.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	preview.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	preview.texture = LabWorld.texture_from_png(Profile.oc_png) if Profile.oc_png.size() > 0 else null
	box.add_child(preview)
	var row := HBoxContainer.new()
	box.add_child(row)
	_add_button(row, "上传透明底 PNG / WebP", func(): _pick_oc(preview), "Upload")
	_add_button(row, "用捏人编辑器", func(): _open_editor(), "Editor")
	var go := _add_button(box, "进入会馆", func():
		var n := nick.text.strip_edges()
		if n == "":
			toast("先起一个昵称")
			return
		if Profile.oc_png.size() == 0:
			toast("先上传一张透明底 OC，或者用编辑器捏一个")
			return
		Profile.nick = n
		Profile.save_local()
		_send_profile()
		_clear_panels()
		guide.on_event("profile_ready"), "Enter")
	go.add_theme_font_size_override("font_size", 18)
	setup_panel = box


func _pick_oc(preview: TextureRect) -> void:
	if not WebBridge.is_web():
		toast("桌面版请用编辑器，或在浏览器中上传")
		return
	if not WebBridge.file_picked.is_connected(_on_file_picked):
		WebBridge.file_picked.connect(_on_file_picked)
	WebBridge.pick_file("image/png,image/webp")


func _on_file_picked(name: String, data: PackedByteArray) -> void:
	if name.ends_with(".json"):
		if Profile.import_json(data.get_string_from_utf8()):
			toast("已导入本地数据")
			_send_profile()
		else:
			toast("这不是 LAB 导出的数据文件")
		return
	var err := _check_image(data)
	if err != "":
		toast(err)
		return
	Profile.set_oc(data, "upload")
	toast("形象已保存在本机")
	if welcomed:
		_send_oc()
	_open_setup()


func _check_image(data: PackedByteArray) -> String:
	if data.size() > 5 * 1024 * 1024:
		return "图片超过 5 MB"
	var img := Image.new()
	var is_png := data.size() > 8 and data[0] == 0x89 and data[1] == 0x50
	var is_webp := data.size() > 12 and data[0] == 0x52 and data[8] == 0x57
	if not (is_png or is_webp):
		return "只支持 PNG 或 WebP"
	var e := img.load_png_from_buffer(data) if is_png else img.load_webp_from_buffer(data)
	if e != OK:
		return "图片无法解码"
	if img.get_width() > 2048 or img.get_height() > 2048:
		return "图片边长不能超过 2048"
	if not img.detect_alpha():
		toast("提示：这张图没有透明背景，在场景里会显示成方块", 5)
	return ""


func _open_editor() -> void:
	_clear_panels()
	editor = load("res://scripts/avatar_editor.gd").new()
	panel_holder.add_child(editor)
	editor.setup(font, Profile.editor_config)
	editor.finished.connect(func(png, cfg):
		Profile.editor_config = cfg
		Profile.set_oc(png, "editor")
		editor.queue_free()
		if welcomed:
			_send_oc()
		_open_setup())
	editor.cancelled.connect(func(): editor.queue_free(); _open_setup())


func _send_profile() -> void:
	if Profile.nick != "":
		Net.send({"t": "profile", "nick": Profile.nick})
	_send_oc()


func _send_oc() -> void:
	if Profile.oc_png.size() > 0:
		Net.send({"t": "oc_set", "data": Marshalls.raw_to_base64(Profile.oc_png), "source": Profile.oc_source})
		world.my_texture = LabWorld.texture_from_png(Profile.oc_png)


# ------------------------------------------------------------------ data panel
func _open_data() -> void:
	var box := _panel("本地数据", 520)
	var l := Label.new()
	l.text = "昵称、OC 图片、捏人配置和显示设置只保存在这台设备的浏览器里。清除浏览器数据会让它们消失，服务器无法帮你恢复；可以先导出备份。公共世界和灵质空间保存在 LAB 服务器上，不受影响。"
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(480, 0)
	box.add_child(l)
	_add_button(box, "导出本地数据", func(): WebBridge.download_text("zszm-lab-profile.json", Profile.export_json()); toast("已导出"))
	_add_button(box, "导入本地数据", func():
		if not WebBridge.file_picked.is_connected(_on_file_picked):
			WebBridge.file_picked.connect(_on_file_picked)
		WebBridge.pick_file("application/json,.json"))
	_add_button(box, "绑定旧测试码进度", _confirm_account_link)
	var names := CheckBox.new(); names.text = "显示名字"; names.button_pressed = Profile.show_names
	names.toggled.connect(func(on): Profile.show_names = on; Profile.save_local())
	box.add_child(names)
	_add_button(box, "清除本机个人数据", func():
		Profile.clear_local()
		Net.send({"t": "oc_clear"})
		world.my_texture = null
		toast("已清除本机数据，公共世界不受影响")
		_open_setup())


func _confirm_account_link() -> void:
	var box := _panel("绑定旧测试码进度", 520)
	var note := Label.new()
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.custom_minimum_size.x = 455
	note.text = "绑定成功后，旧进度和 OC 归入会馆账号；旧测试码不再单独登录。已有两个档案时不会合并。"
	box.add_child(note)
	_add_button(box, "确认开始绑定", func():
		if WebBridge.is_web():
			JavaScriptBridge.get_interface("window").open("/account-link", "_self")
		else:
			Net.login_account_native(Net.http_base(), true))


func _show_account_link(match_code: String) -> void:
	var box := _panel("到会馆确认绑定，匹配码：" + match_code, 500)
	_add_button(box, "打开会馆网站", func(): OS.shell_open(Net.account_approval_url))
	_add_button(box, "取消", func():
		Net.cancel_account_login(true)
		_clear_panels())


func _logout() -> void:
	if WebBridge.is_web():
		Net.close()
		WebBridge.logout()
	elif not Net.cookie.is_empty():
		Net.logout_native()


func _native_login_form(detail: String) -> void:
	var box := _panel("登录西木会馆", 460.0)
	panel_holder.move_to_front()
	var server := LineEdit.new()
	server.name = "NativeServer"
	server.placeholder_text = "服务器地址（https://…）"
	server.text = Net.http_base()
	box.add_child(server)
	var code := LineEdit.new()
	code.name = "NativeCode"
	code.placeholder_text = "输入 LAB 测试码"
	code.secret = true
	code.max_length = 64
	box.add_child(code)
	var hint := Label.new()
	hint.text = detail
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(hint)
	var submit := func(): Net.login_native(server.text, code.text)
	_add_button(box, "登录", submit, "NativeLogin")
	_add_button(box, "在 GitHub 给项目点 Star", func(): OS.shell_open("https://github.com/iridescent1208234593-debug/Gate-of-All-Beings"), "GitHubStar")
	code.text_submitted.connect(func(_value): submit.call())
	_add_button(box, "使用西木会馆账号", func(): Net.login_account_native(server.text), "NativeAccountLogin")
	code.grab_focus()


# ------------------------------------------------------------------ spaces
func _open_spaces() -> void:
	Net.send({"t": "spaces"})
	_render_spaces()
	guide.on_event("spaces_opened")


# ------------------------------------------------------------------ guide panel (pause / resume / review)
func _open_guide() -> void:
	var box := _panel("新手引导 · 开始生活", 520)
	var l := Label.new()
	l.text = "边玩边学：走路、聊天、互动、虹之间。每样东西第一次用到时，会有一点灵光来提示。
" + guide.summary()
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(480, 0)
	box.add_child(l)
	var row := HBoxContainer.new()
	box.add_child(row)
	if guide.status == "paused":
		_add_button(row, "继续引导", func(): _clear_panels(); guide.resume(), "GuideResume")
	elif not guide.is_finished():
		_add_button(row, "暂停引导", func(): _clear_panels(); guide.pause(), "GuidePause")
	_add_button(row, "重新查看", func(): _clear_panels(); guide.review(), "GuideReview")
	if not guide.is_finished():
		_add_button(row, "不需要引导", func(): _clear_panels(); guide.skip(), "GuideSkip")


func _render_spaces() -> void:
	var box := _panel("虹之间 · 灵质空间", 600)
	var l := Label.new()
	l.text = "馆长虹把开辟灵质空间的能力分享给了每位访客。在会馆的「虹之间」彩虹门前，可以开辟自己的空间（世界的一条独立历史分支），邀请朋友，或返回会馆。"
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(560, 0)
	box.add_child(l)
	var mine = null
	for s in space_spaces:
		var row := HBoxContainer.new()
		box.add_child(row)
		var name := Label.new()
		name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var tag := "公共" if s["kind"] == "public" else ("我的" if s["mine"] else "受邀")
		name.text = "%s ·【%s】 在线 %d%s" % [s["title"], tag, int(s["online"]), "" if s["kind"] == "public" or s.get("r4_branch", false) else " · 历史分支准备中"]
		row.add_child(name)
		if s["id"] != world.space.get("id", ""):
			_add_button(row, "前往", func(): Net.send({"t": "space_enter", "space": s["id"]}); _clear_panels(), "Go_" + str(s["id"]))
		else:
			var here := Label.new(); here.text = "（你在这里）"; row.add_child(here)
		if s.get("mine", false):
			mine = s
	if mine == null:
		_add_button(box, "在此开辟我的灵质空间", func(): Net.send({"t": "space_create"}), "CreateSpace")
	else:
		var sub := Label.new(); sub.text = "邀请当前空间里的玩家："; box.add_child(sub)
		for pid in world.players:
			var row := HBoxContainer.new()
			box.add_child(row)
			var n := Label.new(); n.text = world.players[pid].get("nick", pid); n.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			row.add_child(n)
			if pid in mine.get("guests", []):
				_add_button(row, "撤销访问", func(): Net.send({"t": "space_revoke", "pid": pid}))
			else:
				_add_button(row, "邀请", func(): Net.send({"t": "space_invite", "pid": pid}), "Invite_" + pid)
		for g in mine.get("guests", []):
			if not world.players.has(g):
				var row := HBoxContainer.new()
				box.add_child(row)
				var n := Label.new(); n.text = "已邀请 " + g; n.size_flags_horizontal = Control.SIZE_EXPAND_FILL; row.add_child(n)
				_add_button(row, "撤销访问", func(): Net.send({"t": "space_revoke", "pid": g}))
		if world.space.get("id", "") == mine["id"]:
			var trow := HBoxContainer.new()
			box.add_child(trow)
			var tl := Label.new(); tl.text = "这条历史的时间："; trow.add_child(tl)
			_add_button(trow, "暂停", func(): Net.send({"t": "space_time", "action": "pause"}))
			_add_button(trow, "继续", func(): Net.send({"t": "space_time", "action": "resume"}))
			_add_button(trow, "快进 6 小时", func(): Net.send({"t": "space_time", "action": "advance", "ticks": 6}))


# ------------------------------------------------------------------ messages
func _on_net_state(state: String, detail: String) -> void:
	match state:
		"login":
			welcomed = false
			hud.layer = 20
			status_label.visible = false
			_native_login_form(detail)
		"account_approval":
			welcomed = false
			hud.layer = 20
			var box := _panel("请在会馆网站确认，并输入匹配码：" + Net.account_match_code, 460.0)
			_add_button(box, "打开会馆网站", func(): OS.shell_open(Net.account_approval_url))
			_add_button(box, "取消", Net.cancel_account_login)
		"authenticating", "logging_out":
			welcomed = false
			hud.layer = 20
			_panel("正在登录…" if state == "authenticating" else "正在退出…", 460.0)
		"connecting", "reconnecting":
			status_label.text = "正在连接西木会馆…" if not connected_once else "连接中断，正在重连…"
			status_label.visible = true
		"open":
			connected_once = true
		"unauthorized":
			if not WebBridge.is_web():
				Net.require_login("会话已失效，请重新登录。")
				return
			status_label.text = "测试码已失效或会话已过期，请重新输入测试码"
			status_label.visible = true
			await get_tree().create_timer(2.0).timeout
			WebBridge.goto_login()


func _on_message(m: Dictionary) -> void:
	match m.get("t"):
		"welcome":
			_clear_panels()
			welcomed = true
			status_label.visible = false
			world.me_pid = m["pid"]
			world.set_space(m["space"])
			world.me["x"] = float(m["you"]["x"]); world.me["z"] = float(m["you"]["z"])
			for p in m["players"]:
				world.upsert_player(p)
			world.objects = m["objects"]
			world.set_npcs(m["npcs"])
			world.clock = m.get("clock", {})
			space_spaces = m.get("spaces", [])
			move_target = null
			chat_log.clear()
			for c in m.get("chat", []):
				_chat_line(c)
			if Profile.nick == "" and m.get("nick", "") != "":
				Profile.nick = m["nick"]
			guide.apply_server_state(m.get("guide", {}))
			if Profile.has_profile():
				_send_profile()
				guide.on_event("welcome")
			else:
				_open_setup()
			_refresh_top()
			toast("来到 " + str(m["space"]["title"]))
			guide.on_event("space_entered", m["space"].get("kind", "public"))
		"join":
			world.upsert_player(m["player"])
			_chat_sys("%s 来了" % (m["player"].get("nick", "") if m["player"].get("nick", "") != "" else "一位旅人"))
		"leave":
			if world.players.has(m["pid"]):
				world.players.erase(m["pid"])
				if m.get("reason") != "replaced":
					_chat_sys("%s 离开了" % (m.get("nick", "") if m.get("nick", "") != "" else "一位旅人"))
		"profile":
			if world.players.has(m["pid"]):
				world.players[m["pid"]]["nick"] = m["nick"]
		"s":
			world.apply_snapshot(m["p"])
			if m.get("full", false):
				for r in m["p"]:
					if r[0] != world.me_pid and not world.players.has(r[0]):
						world.upsert_player({"pid": r[0], "x": r[1], "z": r[2], "dir": r[3], "anim": r[4]})
		"correct":
			world.me["x"] = float(m["x"]); world.me["z"] = float(m["z"])
			last_sent = Vector3(world.me["x"], world.me["z"], world.me["dir"])
			print("LABCORRECT " + str(m.get("reason")))
		"chat":
			_chat_line(m)
			if world.players.has(m["pid"]):
				world.players[m["pid"]]["bubble"] = m["text"]
				world.players[m["pid"]]["bubble_until"] = Time.get_ticks_msec() / 1000.0 + 5.0
			elif m["pid"] == world.me_pid:
				world.me["bubble"] = m["text"]
				world.me["bubble_until"] = Time.get_ticks_msec() / 1000.0 + 5.0
		"emote":
			var target: Dictionary = world.me if m["pid"] == world.me_pid else world.players.get(m["pid"], {})
			if not target.is_empty():
				target["emote"] = EMOTE_TEXT.get(m["id"], m["id"])
				target["emote_until"] = Time.get_ticks_msec() / 1000.0 + 2.5
		"oc_changed":
			world.oc_digest[m["pid"]] = m["digest"]
		"oc":
			var tx := LabWorld.texture_from_png(Marshalls.base64_to_raw(m["png"]))
			if tx:
				world.textures[m["digest"]] = tx
				world.oc_digest[m["pid"]] = m["digest"]
		"oc_result":
			if m.get("ok"):
				toast("形象已同步给同一空间的玩家")
			else:
				toast("形象没有通过检查：" + str(m.get("reason")))
		"npcs":
			world.set_npcs(m["npcs"])
			world.clock = m.get("clock", world.clock)
			_refresh_top()
		"clock":
			world.clock = m["clock"]
			_refresh_top()
		"object":
			world.objects[m["id"]] = m["state"]
			if m["state"].has("rings"):
				world.objects[m["id"]]["_rung_at"] = Time.get_ticks_msec() / 1000.0
		"guide":
			guide.apply_server_state(m)
		"board":
			var box := _panel("会馆告示", 480)
			var l := Label.new(); l.text = m["text"]; l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			l.custom_minimum_size = Vector2(440, 0); box.add_child(l)
		"portal", "spaces":
			space_spaces = m["spaces"]
			if m["t"] == "portal" or panel_holder.get_child_count() > 0:
				_render_spaces()
		"space_created":
			space_spaces = m["spaces"]
			toast("灵质空间「%s」已开辟" % m["space"]["title"])
			_render_spaces()
		"invited":
			toast("%s 邀请你去「%s」，到虹之间前往" % [m["from"], m["space"]["title"]], 6)
		"notice":
			if m.get("code") == "access_revoked":
				toast("空间主人收回了访问权限，你回到了会馆", 5)
		"kicked":
			if m.get("reason") == "replaced":
				status_label.text = "你在另一个窗口进入了会馆，这里已断开"
				status_label.visible = true
				Net.stopped = true
			elif str(m.get("reason", "")).begins_with("code_") or m.get("reason") == "session_ended":
				status_label.text = "测试码已失效，请重新输入"
				status_label.visible = true
				Net.stopped = true
				await get_tree().create_timer(2.0).timeout
				WebBridge.goto_login()
		"error":
			var msgs := {"go_to_rainbow_door": "要在会馆的「虹之间」彩虹门前操作", "space_forbidden": "你没有这个空间的访问权限",
				"too_far": "再走近一点", "chat_rate_limited": "说得太快啦", "space_exists": "你已经有自己的灵质空间了",
				"not_space_owner": "只有空间主人可以调整时间"}
			toast(msgs.get(m.get("code"), "操作未完成：" + str(m.get("code"))))


func _chat_line(c: Dictionary) -> void:
	chat_log.append_text("%s：%s\n" % [c.get("nick", "旅人"), c.get("text", "")])


func _chat_sys(text: String) -> void:
	chat_log.append_text("· " + text + "\n")


func _send_chat(text: String) -> void:
	text = text.strip_edges()
	if text != "":
		Net.send({"t": "chat", "text": text})
		guide.on_event("chatted")
	chat_input.text = ""
	chat_input.release_focus()


func _refresh_top() -> void:
	var c: Dictionary = world.clock
	var time_text := ""
	if c.get("available", false):
		var pops: Dictionary = c.get("populations", {})
		time_text = " · 世界时间 第%d天 %02d:00 · 羊 %d 狼 %d%s" % [int(c.get("day", 1)), int(c.get("hour", 0)),
			int(pops.get("Sheep", 0)), int(pops.get("Wolf", 0)), "（暂停）" if c.get("paused", false) or not c.get("running", true) else ""]
	top_label.text = "%s%s · 在线 %d · %s · %d ms" % [world.space.get("title", "西木会馆"), time_text, world.players.size() + 1,
		"3D 像素" if Profile.view_mode == "3d" else "2D", int(Net.rtt_ms)]


func _toggle_view() -> void:
	Profile.view_mode = "3d" if Profile.view_mode == "2d" else "2d"
	Profile.save_local()
	_apply_view()
	Net.send({"t": "hello_view", "client": Profile.view_mode})
	guide.on_event("view_toggled", Profile.view_mode)


func _apply_view() -> void:
	view2d.activate(Profile.view_mode == "2d")
	view3d.activate(Profile.view_mode == "3d")
	if top_label:
		_refresh_top()


# ------------------------------------------------------------------ input + prediction
func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and pending_upload:
		pending_upload = false
		_pick_oc(null)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ENTER and not chat_input.has_focus():
			chat_input.grab_focus()
			get_viewport().set_input_as_handled()
		elif event.keycode == KEY_E and near_object != "":
			Net.send({"t": "interact", "object": near_object})
			guide.on_event("interacted")
		elif event.keycode == KEY_F3:
			_toggle_view()

	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT and welcomed and watch_every == 0.0:
		if panel_holder.get_child_count() == 0:
			var p: Vector2 = view2d.screen_to_world(event.position) if Profile.view_mode == "2d" else view3d.screen_to_world(event.position)
			move_target = p


func _process(delta: float) -> void:
	if Time.get_ticks_msec() / 1000.0 > toast_until:
		toast_label.text = ""
	if not welcomed:
		return
	_run_auto(delta)
	var wish := Vector2.ZERO
	if not chat_input.has_focus() and panel_holder.get_child_count() == 0:
		wish = Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
		if Input.is_key_pressed(KEY_A): wish.x -= 1
		if Input.is_key_pressed(KEY_D): wish.x += 1
		if Input.is_key_pressed(KEY_W): wish.y -= 1
		if Input.is_key_pressed(KEY_S): wish.y += 1
	if wish != Vector2.ZERO:
		move_target = null
	elif move_target != null:
		var to: Vector2 = move_target - Vector2(world.me["x"], world.me["z"])
		if to.length() < 0.1:
			move_target = null
		else:
			wish = to
	var moving := wish.length() > 0.01
	if moving:
		var step := wish.normalized() * SPEED * minf(delta, 0.1)
		var from := Vector2(world.me["x"], world.me["z"])
		var nxt := world.step_toward(from, step)
		if nxt == from:
			move_target = null
		guide.on_event("moved", from.distance_to(nxt))
		world.me["x"] = nxt.x; world.me["z"] = nxt.y
		world.me["dir"] = atan2(wish.y, wish.x)
		world.me["anim"] = "walk"
	else:
		world.me["anim"] = "idle"
	send_timer += delta
	var cur := Vector3(world.me["x"], world.me["z"], world.me["dir"])
	if send_timer >= 1.0 / SEND_HZ and cur.distance_to(last_sent) > 0.01:
		send_timer = 0.0
		seq += 1
		last_sent = cur
		Net.send({"t": "move", "x": snappedf(cur.x, 0.001), "z": snappedf(cur.y, 0.001), "dir": snappedf(cur.z, 0.01), "anim": world.me["anim"], "seq": seq})
	world.interpolate()
	for pid in world.players:
		var d = world.oc_digest.get(pid, null)
		if d != null and not world.textures.has(d) and requested_oc.get(pid, "") != d:
			requested_oc[pid] = d
			Net.send({"t": "oc_get", "pid": pid})
	var was_near := near_object
	near_object = ""
	for o in world.template.get("objects", []):
		if Vector2(world.me["x"], world.me["z"]).distance_to(Vector2(o["position"][0], o["position"][2])) <= float(o["radius"]):
			near_object = o["id"]
			hint_label.text = "按 E 互动：" + o["name"]
	if near_object != "" and was_near == "":
		guide.on_event("near_object", near_object)
	if near_object == "":
		hint_label.text = ""
	if Engine.get_process_frames() % 30 == 0:
		_refresh_top()


# ------------------------------------------------------------------ scripted input (automated tests)
func _run_auto(delta: float) -> void:
	if watch_every > 0.0:
		watch_t -= delta
		if watch_t <= 0.0:
			watch_t = watch_every
			auto_actions.push_front("report")
			auto_t = 0.0
	if auto_actions.is_empty():
		return
	auto_t -= delta
	if auto_t > 0:
		return
	var a: String = auto_actions.pop_front()
	var parts := a.split(":")
	match parts[0]:
		"wait": auto_t = float(parts[1])
		"goto": move_target = Vector2(float(parts[1]), float(parts[2])); auto_t = 0.1
		"chat": Net.send({"t": "chat", "text": parts[1].uri_decode()})
		"emote": Net.send({"t": "emote", "id": parts[1]})
		"interact": Net.send({"t": "interact", "object": parts[1]}); guide.on_event("interacted")
		"view": Profile.view_mode = parts[1]; _apply_view()
		"create": Net.send({"t": "space_create"})
		"enter": Net.send({"t": "space_enter", "space": parts[1]})
		"invite_all":
			for pid in world.players:
				Net.send({"t": "space_invite", "pid": pid})
		"enter_invited":
			for s in space_spaces:
				if s["kind"] == "private" and not s.get("mine", false):
					Net.send({"t": "space_enter", "space": s["id"]})
		"enter_mine":
			for s in space_spaces:
				if s.get("mine", false):
					Net.send({"t": "space_enter", "space": s["id"]})
		"nick":
			Profile.nick = parts[1].uri_decode()
			Profile.save_local()
		"upload":
			pending_upload = true        # browsers only open a file chooser right after a real click
		"editor":
			_open_editor()
			editor._randomize()
			editor._finish()
		"arrive":
			if move_target != null:
				auto_actions.push_front("arrive")
				auto_t = 0.2
		"watch":
			watch_every = float(parts[1]) if parts.size() > 1 else 1.0
		"done":
			_clear_panels()
			_send_profile()
			guide.on_event("profile_ready")
		"report":
			var seen := {}
			for pid in world.players:
				var p: Dictionary = world.players[pid]
				seen[pid] = {"nick": p.get("nick", ""), "x": snappedf(p["x"], 0.01), "z": snappedf(p["z"], 0.01),
					"has_oc_texture": world.texture_for(pid) != null}
			print("LABSTATE " + JSON.stringify({"pid": world.me_pid, "space": world.space.get("id", ""),
				"me": {"x": snappedf(world.me["x"], 0.01), "z": snappedf(world.me["z"], 0.01)}, "players": seen,
				"view": Profile.view_mode, "npcs": world.npc_view.size(), "clock": world.clock,
				"objects": world.objects, "chat": chat_log.get_parsed_text().right(300), "nick": Profile.nick,
				"oc_bytes": Profile.oc_png.size(), "fps": Engine.get_frames_per_second(), "rtt": Net.rtt_ms,
				"guide": {"status": guide.status, "seen": guide.seen, "showing": guide._current.get("key", "")}}))
