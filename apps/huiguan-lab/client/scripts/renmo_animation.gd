extends RefCounted
# Shared baked Cubism frames for browser and desktop; uploaded OCs retain priority.
# Produced by the renmo pipeline (renmo1-live2d/pipeline): one body set with every face feature
# removed, plus one small cropped set per face option (eyes / brows / mouth ...). The layout is
# described by assets/renmo1/variants.json; a player's choice is p.face = {slot_id: option_id}.
const ROOT := "res://assets/renmo1/"
const FW := 256.0
const FH := 320.0
static var variants: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(ROOT + "variants.json"))
static var option_dirs := {}   # "slot:option" -> dir
static var option_meta := {}   # "slot:option" -> animations.json
var metadata: Dictionary
var atlases := {}
var frames := {}

static func slots() -> Array:
 return variants.slots

static func default_face() -> Dictionary:
 var face := {}
 for s in variants.slots: face[s.id] = s.default
 return face

static func valid_face(face) -> Dictionary:
 ## Unknown slots/options fall back to the defaults, so old or tampered profiles still draw.
 var out := default_face()
 if face is Dictionary:
  for s in variants.slots:
   var want = face.get(s.id, "")
   for o in s.options:
    if o.id == want: out[s.id] = want
 return out

static var draw_slots: Array = []  # slots sorted by z (draw order of their front layers)
static var back_slots: Array = []  # slots sorted by back_z (draw order of their back layers)

static func _ensure_dirs() -> void:
 if not draw_slots.is_empty(): return
 for s in variants.slots:
  for o in s.options:
   if o.has("dir"): option_dirs[s.id + ":" + o.id] = ROOT + o.dir + "/"
   if o.has("back_dir"): option_dirs[s.id + ":" + o.id + ":back"] = ROOT + o.back_dir + "/"
 draw_slots = variants.slots.duplicate()
 draw_slots.sort_custom(func(a, b): return float(a.get("z", 0)) < float(b.get("z", 0)))
 back_slots = variants.slots.duplicate()
 back_slots.sort_custom(func(a, b): return float(a.get("back_z", a.get("z", 0))) < float(b.get("back_z", b.get("z", 0))))

func _init() -> void:
 _ensure_dirs()
 metadata = JSON.parse_string(FileAccess.get_file_as_string(ROOT + variants.body + "/animations.json"))

func _pick(p: Dictionary, time: float) -> Array:
 var name: String = p.get("anim", "idle")
 if not metadata.has(name): name = "idle"
 var now := Time.get_ticks_msec() / 1000.0
 if p.get("emote_until", 0.0) > now and p.get("anim","idle") == "idle":
  var actions := {"wave":"wave", "bow":"nod", "heart":"shy", "laugh":"cheer", "sleep":"idleCute", "surprise":"headTilt", "music":"sway", "sparkle":"cheer"}
  var action: String = p.get("emote_id", "")
  name = action if metadata.has(action) else actions.get(action,name)
  time = maxf(0.0, now - float(p.get("emote_started",now)))
 var info: Dictionary = metadata[name]
 var looped: bool = p.get("emote_until",0.0) <= now or name in ["idle","idleCute","walk","run"]
 var index := int(fmod(time,float(info.duration))*12)%int(info.frames) if looped else mini(int(time*12),int(info.frames)-1)
 return [name, index]

func _frame(key: String, dir: String, name: String, index: int, w: float, h: float) -> AtlasTexture:
 var fkey := key + ":" + name + ":" + str(index)
 if not frames.has(fkey):
  var akey := key + ":" + name
  if not atlases.has(akey): atlases[akey] = load(dir + name + ".png")
  var frame := AtlasTexture.new()
  frame.atlas = atlases[akey]
  frame.region = Rect2((index%12)*w,(index/12)*h,w,h)
  frames[fkey] = frame
 return frames[fkey]

func texture_for(p: Dictionary, time: float) -> AtlasTexture:
 ## The body frame (256x320, feet at the same place in every frame).
 var pick := _pick(p, time)
 return _frame("body", ROOT + variants.body + "/", pick[0], pick[1], FW, FH)

func layers_for(p: Dictionary, time: float) -> Array:
 ## Face features to draw over the body frame: [{tex: AtlasTexture, rect: Rect2 in body-frame pixels}].
 var pick := _pick(p, time)
 var face := valid_face(p.get("face", {}))
 if p.has("mouth") and not (p.get("face", {}) is Dictionary and p.face.has("mouth")):
  face = valid_face(face.merged({"mouth": p.mouth}, true))  # profiles saved before face slots existed
 # Back layers (back hair, an ear behind the head...) of every slot first, then the front layers;
 # both by slot z. The body was baked as holdout, so plain compositing gives the right overlap.
 var keys := []
 for suffix in [":back", ""]:
  for s in (back_slots if suffix == ":back" else draw_slots):
   var opt := _option(s, face[s.id])
   if opt.is_empty() or not _requirements_met(opt, face): continue
   var key: String = s.id + ":" + face[s.id] + suffix
   if option_dirs.has(key): keys.append(key)
 var out := []
 for key in keys:
  if not option_meta.has(key):
   option_meta[key] = JSON.parse_string(FileAccess.get_file_as_string(option_dirs[key] + "animations.json"))
  var info: Dictionary = option_meta[key].get(pick[0], {})
  if info.is_empty(): continue
  var r: Array = info.rect
  var index := mini(int(pick[1]), int(info.frames) - 1)
  out.append({"tex": _frame(key, option_dirs[key], pick[0], index, r[2], r[3]), "rect": Rect2(r[0], r[1], r[2], r[3])})
 return out

static func _option(slot: Dictionary, id: String) -> Dictionary:
 for o in slot.options:
  if o.id == id: return o
 return {}

static func _requirements_met(opt: Dictionary, face: Dictionary) -> bool:
 ## e.g. sleeve patterns only show when the chosen top has sleeves.
 for slot_id in opt.get("requires", {}):
  if not face.get(slot_id, "") in opt.requires[slot_id]: return false
 return true

func draw_on(canvas: CanvasItem, p: Dictionary, time: float, body_rect: Rect2, modulate: Color, flip := false) -> void:
 ## Draw body + face layers locked in one coordinate space.
 ## A negative-width rect is NOT mirrored by Godot (draw_texture_rect only takes the absolute
 ## width and keeps growing right), which makes the face layers drift off the body; the
 ## left-facing pose is mirrored through a canvas transform instead.
 var mirror := flip or body_rect.size.x < 0.0
 var rect := Rect2(body_rect.position + Vector2(minf(body_rect.size.x, 0.0), minf(body_rect.size.y, 0.0)), body_rect.size.abs())
 if mirror:
  canvas.draw_set_transform(Vector2(rect.position.x + rect.size.x, rect.position.y), 0.0, Vector2(-1, 1))
  _draw_rig(canvas, p, time, Rect2(Vector2.ZERO, rect.size), modulate)
  canvas.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
 else:
  _draw_rig(canvas, p, time, rect, modulate)

func _draw_rig(canvas: CanvasItem, p: Dictionary, time: float, rect: Rect2, modulate: Color) -> void:
 var sx := rect.size.x / FW
 var sy := rect.size.y / FH
 canvas.draw_texture_rect(texture_for(p, time), rect, false, modulate)
 for layer in layers_for(p, time):
  var r: Rect2 = layer.rect
  canvas.draw_texture_rect(layer.tex, Rect2(rect.position.x + r.position.x * sx, rect.position.y + r.position.y * sy, r.size.x * sx, r.size.y * sy), false, modulate)
