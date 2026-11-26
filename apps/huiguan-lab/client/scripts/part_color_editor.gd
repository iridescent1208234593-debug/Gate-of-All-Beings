extends VBoxContainer
signal applied(colors: Dictionary)
const Anim = preload("res://scripts/renmo_animation.gd")
const MOTION_LABELS := {
 "idle": "待机", "blink": "眨眼", "nod": "点头", "shake": "摇头",
 "crouch": "蹲下", "weightShift": "重心切换", "shy": "害羞", "wave": "挥手",
 "headTilt": "歪头", "cheer": "欢呼", "legKick": "踢腿", "sway": "摇摆",
 "idleCute": "可爱待机", "walk": "走路", "run": "跑步",
}
var draft := {}
var face := {}                 # {slot_id: option_id}, slots come from assets/renmo1/variants.json
var selected := 0
var selecting := false
var picker: ColorPicker
var preview
var pose := {"anim":"idle"}
func setup(colors: Dictionary, mobile: bool, initial_face = {}) -> void:
 draft = colors.duplicate(true)
 face = Anim.valid_face(initial_face)
 pose["face"] = face
 var content: BoxContainer = VBoxContainer.new() if mobile else HBoxContainer.new()
 add_child(content)
 var left := VBoxContainer.new()
 content.add_child(left)
 preview = preload("res://scripts/renmo_avatar_view.gd").new()
 preview.palette_id = "editor-preview"
 preview.custom_minimum_size = Vector2(220,230) if mobile else Vector2(280,350)
 left.add_child(preview)
 var motion_title := Label.new()
 motion_title.text = "动作试玩（仅预览）"
 left.add_child(motion_title)
 var motion_row := HBoxContainer.new()
 left.add_child(motion_row)
 var motions := OptionButton.new()
 motions.name = "PreviewMotion"
 motions.size_flags_horizontal = Control.SIZE_EXPAND_FILL
 for action in preview.animation.metadata:
  motions.add_item(MOTION_LABELS.get(action, action))
  motions.set_item_metadata(motions.item_count - 1, action)
 motions.item_selected.connect(func(index): _play_motion(motions.get_item_metadata(index)))
 motion_row.add_child(motions)
 var replay := Button.new()
 replay.name = "ReplayMotion"
 replay.text = "播放"
 replay.pressed.connect(func(): _play_motion(motions.get_item_metadata(motions.selected)))
 motion_row.add_child(replay)
 var grids := {}
 for slot in Anim.slots():
  var group: String = slot.get("group", "形象")
  if not grids.has(group):
   var title := Label.new()
   title.text = group
   left.add_child(title)
   var g := GridContainer.new()
   g.name = "FaceSlots" if grids.is_empty() else "FaceSlots" + str(grids.size())
   g.columns = 2 if mobile else 4
   left.add_child(g)
   grids[group] = g
  var expression_grid: GridContainer = grids[group]
  var label := Label.new()
  label.text = slot.label
  expression_grid.add_child(label)
  var choice := OptionButton.new()
  choice.name = "Face_" + slot.id
  for o in slot.options:
   choice.add_item(o.label)
   if o.id == face[slot.id]: choice.selected = choice.item_count - 1
  choice.item_selected.connect(func(index):
   face[slot.id] = slot.options[index].id
   pose["face"] = face)
  expression_grid.add_child(choice)
 var right := VBoxContainer.new()
 content.add_child(right)
 var parts := OptionButton.new()
 parts.name = "BodyPart"
 for part in RenmoColors.parts: parts.add_item(part.name)
 parts.item_selected.connect(func(index): selected=index; _select())
 right.add_child(parts)
 picker = ColorPicker.new()
 picker.name = "PartColorWheel"
 picker.edit_alpha = false
 picker.picker_shape = ColorPicker.SHAPE_HSV_WHEEL
 picker.custom_minimum_size = Vector2(240,320) if mobile else Vector2(300,340)
 picker.color_changed.connect(func(color):
  if not selecting: draft[RenmoColors.parts[selected].mesh] = color.to_html(false))
 right.add_child(picker)
 var row: BoxContainer = VBoxContainer.new() if mobile else HBoxContainer.new()
 add_child(row)
 var reset := Button.new()
 reset.text = "恢复当前部件"
 reset.pressed.connect(func(): draft.erase(RenmoColors.parts[selected].mesh); _select())
 row.add_child(reset)
 var reset_all := Button.new()
 reset_all.text = "恢复全部原色"
 reset_all.pressed.connect(func(): draft.clear(); _select())
 row.add_child(reset_all)
 var save := Button.new()
 save.name = "SavePartColors"
 save.text = "保存并使用"
 save.pressed.connect(func(): applied.emit(draft.duplicate(true)))
 row.add_child(save)
 _select()
func _play_motion(action: String) -> void:
 var now := Time.get_ticks_msec() / 1000.0
 var duration: float = preview.animation.metadata[action].duration
 pose = {"anim":"idle","face":face,"emote_id":action,"emote_started":now,"emote_until":now+duration}

func _select() -> void:
 selecting = true
 var part: Dictionary = RenmoColors.parts[selected]
 picker.color = Color.from_string("#"+str(draft.get(part.mesh,"ffede6")).trim_prefix("#"),Color("ffede6"))
 selecting = false
func _process(_delta: float) -> void:
 if preview == null: return
 preview.colors = draft
 preview.pose = pose
