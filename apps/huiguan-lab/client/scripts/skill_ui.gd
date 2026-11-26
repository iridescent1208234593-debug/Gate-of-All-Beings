extends CanvasLayer
## Skill bar (4 slots, keys 1-4, bottom centre) and the full-screen skill tree (key K, or the 技能 button).
## The tree stays closed while playing, so only the small bar covers the scene.

var S                                   # the Skills autoload
var mobile := false
var root: Control
var bar: PanelContainer
var slot_buttons: Array = []
var points_button: Button
var toast_label: Label
var toast_until := 0.0

var tree_root: Control
var branch_list: VBoxContainer
var branch_buttons := {}
var tiers_box: VBoxContainer
var branch_title: Label
var points_label: Label
var detail_name: Label
var detail_meta: Label
var detail_desc: Label
var detail_state: Label
var preview: TextureRect
var unlock_button: Button
var equip_buttons: Array = []
var unequip_button: Button
var current_branch := ""
var current_skill := ""
var preview_start := 0.0


func setup(skills) -> void:
	S = skills
	mobile = WebBridge.is_mobile()
	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	_build_bar()
	_build_tree()
	toast_label = Label.new()
	toast_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	toast_label.offset_top = -132; toast_label.offset_bottom = -104
	toast_label.offset_left = -260; toast_label.offset_right = 260
	toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast_label.add_theme_constant_override("outline_size", 6)
	toast_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	toast_label.add_theme_color_override("font_color", Color("ffe08a"))
	toast_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(toast_label)
	S.state_changed.connect(_refresh)
	S.fx_ready.connect(func(_id): _refresh_bar())
	bar.visible = false


func toast(text: String, seconds := 2.5) -> void:
	toast_label.text = text
	toast_until = Time.get_ticks_msec() / 1000.0 + seconds


# ------------------------------------------------------------------ bar
func _build_bar() -> void:
	bar = PanelContainer.new()
	bar.name = "SkillBar"
	# A slim column on the right edge, above the interact button: the bottom centre holds main's hint line and
	# the bottom left the chat, so this covers the least of the scene.
	bar.anchor_left = 1.0; bar.anchor_right = 1.0; bar.anchor_top = 1.0; bar.anchor_bottom = 1.0
	var side := 60.0 if mobile else 54.0
	var height := side * 4 + 6 * 4 + 44 + 8
	var bottom := -136.0 if mobile else -96.0
	bar.offset_right = -10; bar.offset_left = -10 - side - 12
	bar.offset_bottom = bottom; bar.offset_top = bottom - height
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.1, 0.09, 0.72)
	style.set_corner_radius_all(8)
	style.content_margin_left = 6; style.content_margin_right = 6; style.content_margin_top = 4; style.content_margin_bottom = 4
	bar.add_theme_stylebox_override("panel", style)
	root.add_child(bar)
	var row := VBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	bar.add_child(row)
	points_button = Button.new()
	points_button.name = "SkillTreeButton"
	points_button.text = "技能\n0 点"
	points_button.custom_minimum_size = Vector2(side, 44)
	points_button.add_theme_constant_override("line_spacing", -4)
	points_button.focus_mode = Control.FOCUS_NONE
	points_button.add_theme_font_size_override("font_size", 13)
	points_button.tooltip_text = "打开技能树（K）"
	points_button.pressed.connect(toggle_tree)
	row.add_child(points_button)
	for i in 4:
		var b := Button.new()
		b.name = "SkillSlot%d" % (i + 1)
		b.custom_minimum_size = Vector2(side, side)
		b.focus_mode = Control.FOCUS_NONE
		b.expand_icon = true
		b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		b.vertical_icon_alignment = VERTICAL_ALIGNMENT_CENTER
		b.clip_text = true
		b.add_theme_font_size_override("font_size", 11)
		b.add_theme_constant_override("icon_max_width", int(side) - 8)
		b.pressed.connect(func(): S.cast_slot(i))
		row.add_child(b)
		var key := Label.new()
		key.text = str(i + 1)
		key.position = Vector2(4, 0)
		key.add_theme_font_size_override("font_size", 12)
		key.add_theme_constant_override("outline_size", 4)
		key.add_theme_color_override("font_outline_color", Color.BLACK)
		key.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(key)
		var name := Label.new()
		name.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
		name.offset_top = -16
		name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		name.add_theme_font_size_override("font_size", 11)
		name.add_theme_constant_override("outline_size", 4)
		name.add_theme_color_override("font_outline_color", Color.BLACK)
		name.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(name)
		var shade := ColorRect.new()
		shade.color = Color(0, 0, 0, 0.6)
		shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(shade)
		slot_buttons.append({"button": b, "name": name, "shade": shade})


func _refresh_bar() -> void:
	bar.visible = S.ready_state
	points_button.text = "技能\n%d 点" % S.points
	for i in slot_buttons.size():
		var sb: Dictionary = slot_buttons[i]
		var id: String = S.equipped[i] if i < S.equipped.size() else ""
		var b: Button = sb["button"]
		if id == "":
			b.icon = null
			sb["name"].text = "空"
			b.tooltip_text = "空技能格：在技能树里选技能装上"
		else:
			var s: Dictionary = S.skill(id)
			sb["name"].text = s.get("name", id)
			b.tooltip_text = "%s（%d）" % [s.get("name", id), i + 1]
			b.icon = _icon(id)


func _icon(id: String) -> Texture2D:
	if not S.fx_ready_for(id):
		return null
	var n := int(S.fx[id]["info"]["n"])
	return S.fx_frame(id, int(n * 0.45))


# ------------------------------------------------------------------ tree
func tree_open() -> bool:
	return tree_root.visible


func toggle_tree() -> void:
	tree_root.visible = not tree_root.visible
	if tree_root.visible:
		if current_branch == "" and not S.branches().is_empty():
			_select_branch(S.branches()[0]["id"])
		_refresh()


func _build_tree() -> void:
	tree_root = Control.new()
	tree_root.name = "SkillTree"
	tree_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	tree_root.mouse_filter = Control.MOUSE_FILTER_STOP
	tree_root.visible = false
	root.add_child(tree_root)
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.55)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	tree_root.add_child(shade)
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	var m := 8 if mobile else 28
	panel.offset_left = m; panel.offset_top = m; panel.offset_right = -m; panel.offset_bottom = -m
	var ps := StyleBoxFlat.new()
	ps.bg_color = Color(0.1, 0.13, 0.11, 0.97)
	ps.set_corner_radius_all(10)
	ps.set_content_margin_all(12)
	panel.add_theme_stylebox_override("panel", ps)
	tree_root.add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 8)
	panel.add_child(col)
	var head := HBoxContainer.new()
	col.add_child(head)
	var title := Label.new()
	title.text = "技能树"
	title.add_theme_font_size_override("font_size", 22)
	head.add_child(title)
	points_label = Label.new()
	points_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	points_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	head.add_child(points_label)
	var close := Button.new()
	close.name = "SkillTreeClose"
	close.text = "关闭（K）"
	close.focus_mode = Control.FOCUS_NONE
	close.pressed.connect(toggle_tree)
	head.add_child(close)
	var body := HBoxContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 10)
	col.add_child(body)
	var left := ScrollContainer.new()
	left.custom_minimum_size.x = 112 if mobile else 150
	left.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	body.add_child(left)
	branch_list = VBoxContainer.new()
	branch_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left.add_child(branch_list)
	for b in S.branches():
		var bb := Button.new()
		bb.name = "Branch_" + b["id"]
		bb.toggle_mode = true
		bb.focus_mode = Control.FOCUS_NONE
		bb.alignment = HORIZONTAL_ALIGNMENT_LEFT
		bb.pressed.connect(_select_branch.bind(b["id"]))
		branch_list.add_child(bb)
		branch_buttons[b["id"]] = bb
	var right := VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_child(right)
	branch_title = Label.new()
	branch_title.add_theme_font_size_override("font_size", 18)
	right.add_child(branch_title)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	right.add_child(scroll)
	tiers_box = VBoxContainer.new()
	tiers_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tiers_box.add_theme_constant_override("separation", 6)
	scroll.add_child(tiers_box)
	# detail strip
	var detail := PanelContainer.new()
	right.add_child(detail)
	var drow := HBoxContainer.new()
	drow.add_theme_constant_override("separation", 12)
	detail.add_child(drow)
	var pv := PanelContainer.new()
	var pvs := StyleBoxFlat.new()
	pvs.bg_color = Color("1d2a22")
	pv.add_theme_stylebox_override("panel", pvs)
	drow.add_child(pv)
	preview = TextureRect.new()
	preview.name = "SkillPreview"
	preview.custom_minimum_size = Vector2(150, 110) if mobile else Vector2(220, 150)
	preview.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	preview.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	preview.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	pv.add_child(preview)
	var info := VBoxContainer.new()
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	drow.add_child(info)
	detail_name = Label.new()
	detail_name.add_theme_font_size_override("font_size", 18)
	info.add_child(detail_name)
	detail_meta = Label.new()
	detail_meta.add_theme_font_size_override("font_size", 13)
	detail_meta.modulate = Color(1, 1, 1, 0.7)
	info.add_child(detail_meta)
	detail_desc = Label.new()
	detail_desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	detail_desc.add_theme_font_size_override("font_size", 12)
	detail_desc.modulate = Color(1, 1, 1, 0.6)
	detail_desc.custom_minimum_size.x = 200
	info.add_child(detail_desc)
	detail_state = Label.new()
	info.add_child(detail_state)
	var actions := HFlowContainer.new()
	info.add_child(actions)
	unlock_button = Button.new()
	unlock_button.name = "SkillUnlock"
	unlock_button.focus_mode = Control.FOCUS_NONE
	unlock_button.pressed.connect(func(): if current_skill != "": S.request_unlock(current_skill))
	actions.add_child(unlock_button)
	for i in 4:
		var e := Button.new()
		e.name = "SkillEquip%d" % (i + 1)
		e.text = "装到 %d" % (i + 1)
		e.focus_mode = Control.FOCUS_NONE
		e.pressed.connect(func(): if current_skill != "": S.request_equip(i, current_skill))
		actions.add_child(e)
		equip_buttons.append(e)
	unequip_button = Button.new()
	unequip_button.text = "卸下"
	unequip_button.focus_mode = Control.FOCUS_NONE
	unequip_button.pressed.connect(func():
		var k: int = S.equipped.find(current_skill)
		if k >= 0: S.request_equip(k, ""))
	actions.add_child(unequip_button)


func _select_branch(bid: String) -> void:
	current_branch = bid
	for k in branch_buttons:
		branch_buttons[k].button_pressed = k == bid
	var b := _branch(bid)
	if not b.is_empty() and (current_skill == "" or S.skill(current_skill).get("branch") != bid):
		_select_skill(b["skills"][0])
	_refresh()


func _select_skill(id: String) -> void:
	current_skill = id
	preview_start = Time.get_ticks_msec() / 1000.0
	S.ensure_fx(id)
	_refresh()


func _branch(bid: String) -> Dictionary:
	for b in S.branches():
		if b["id"] == bid:
			return b
	return {}


func _refresh() -> void:
	_refresh_bar()
	if not tree_root.visible:
		return
	var nxt: float = S.seconds_to_next_point()
	points_label.text = "可用技能点：%d　·　已解锁 %d / %d　·　在线每 %d 分钟 +1 点（还差 %d:%02d）" % [
		S.points, S.unlocked.size(), S.catalog.get("skills", {}).size(), int(S.catalog.get("minutes_per_point", 10)),
		int(nxt) / 60, int(nxt) % 60]
	for b in S.branches():
		var have := 0
		for id in b["skills"]:
			if S.is_unlocked(id): have += 1
		branch_buttons[b["id"]].text = "%s  %d/%d" % [b["name"], have, b["skills"].size()]
	var br := _branch(current_branch)
	if br.is_empty():
		return
	branch_title.text = "%s · %s" % [br["name"], br["blurb"]]
	for c in tiers_box.get_children():
		tiers_box.remove_child(c)
		c.queue_free()
	var by_tier := {}
	for id in br["skills"]:
		var tk := int(S.skill(id)["tier"])
		if not by_tier.has(tk): by_tier[tk] = []
		by_tier[tk].append(id)
	var tiers := by_tier.keys()
	tiers.sort()
	for t in tiers:
		var row := HBoxContainer.new()
		tiers_box.add_child(row)
		var tl := Label.new()
		tl.text = "第 %d 层\n%d 点" % [t, t]
		tl.custom_minimum_size.x = 56
		tl.add_theme_font_size_override("font_size", 12)
		tl.modulate = Color(1, 1, 1, 0.7)
		row.add_child(tl)
		var flow := HFlowContainer.new()
		flow.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(flow)
		for id in by_tier[t]:
			flow.add_child(_card(id))
	_refresh_detail()


func _card(id: String) -> Button:
	var s: Dictionary = S.skill(id)
	var b := Button.new()
	b.name = "Skill_" + id.replace("/", "__")
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(118 if mobile else 132, 44)
	b.toggle_mode = true
	b.button_pressed = id == current_skill
	var block: String = S.unlock_block(id)
	var mark := ""
	if S.is_unlocked(id):
		var slot: int = S.equipped.find(id)
		mark = "已装在 %d" % (slot + 1) if slot >= 0 else "已解锁"
		b.modulate = Color(1, 0.95, 0.75)
	elif block == "":
		mark = "可解锁"
		b.modulate = Color(0.8, 1, 0.85)
	else:
		mark = "未解锁"
		b.modulate = Color(1, 1, 1, 0.55)
	b.text = "%s\n%s" % [s["name"], mark]
	b.add_theme_font_size_override("font_size", 13)
	b.pressed.connect(_select_skill.bind(id))
	return b


func _refresh_detail() -> void:
	if current_skill == "":
		return
	var s: Dictionary = S.skill(current_skill)
	detail_name.text = s["name"]
	var kind := "持续 %.1f 秒" % float(s["play"]) if s["loop"] else "一次 %.1f 秒" % float(s["duration"])
	var where: String = {"front": "面前释放", "self": "围绕自身", "screen": "全屏（天象：附近玩家可见；转场：只有自己）"}.get(s["anchor"], "")
	detail_meta.text = "%s　第 %d 层 · %d 点　%s　冷却 %.1f 秒　%s" % [s["en"], int(s["tier"]), int(s["cost"]), kind, float(s["cooldown"]), where]
	detail_desc.text = s["desc"]
	var block: String = S.unlock_block(current_skill)
	var unlocked: bool = S.is_unlocked(current_skill)
	detail_state.text = {"unlocked": "已解锁", "": "可以解锁", "needs_previous": "需要先解锁上一层的任意一个技能",
		"no_points": "技能点不够"}.get(block, "")
	unlock_button.text = "解锁（%d 点）" % int(s["cost"])
	unlock_button.visible = not unlocked
	unlock_button.disabled = block != ""
	for i in equip_buttons.size():
		equip_buttons[i].visible = unlocked
		equip_buttons[i].disabled = i < S.equipped.size() and S.equipped[i] == current_skill
	unequip_button.visible = unlocked and current_skill in S.equipped


# ------------------------------------------------------------------ per frame
func _process(_delta: float) -> void:
	var now := Time.get_ticks_msec() / 1000.0
	toast_label.visible = now < toast_until
	if bar.visible:
		for i in slot_buttons.size():
			var sb: Dictionary = slot_buttons[i]
			var id: String = S.equipped[i] if i < S.equipped.size() else ""
			var b: Button = sb["button"]
			if id != "" and b.icon == null and S.fx_ready_for(id):
				b.icon = _icon(id)
			var left: float = S.cooldown_left(id) if id != "" else 0.0
			var total := maxf(0.8, float(S.skill(id).get("cooldown", 1.0))) if id != "" else 1.0
			var k := clampf(left / total, 0.0, 1.0)
			var shade: ColorRect = sb["shade"]
			shade.visible = k > 0.0
			shade.position = Vector2(0, b.size.y * (1.0 - k))
			shade.size = Vector2(b.size.x, b.size.y * k)
	if tree_root.visible and current_skill != "":
		if S.fx_ready_for(current_skill):
			var info: Dictionary = S.fx[current_skill]["info"]
			var i := int((now - preview_start) * float(info["fps"])) % int(info["n"])
			preview.texture = S.fx_frame(current_skill, i)
		else:
			preview.texture = null
		if int(now * 2) != int((now - _delta) * 2):
			var nxt: float = S.seconds_to_next_point()
			points_label.text = points_label.text.left(points_label.text.rfind("（") + 1) + "还差 %d:%02d）" % [int(nxt) / 60, int(nxt) % 60]
