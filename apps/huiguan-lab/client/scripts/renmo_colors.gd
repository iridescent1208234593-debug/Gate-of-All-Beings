class_name RenmoColors
extends RefCounted
static var parts: Array = JSON.parse_string(FileAccess.get_file_as_string("res://assets/renmo1/parts.json"))
static var rows := {}
static var signatures := {}
static var image := Image.create(32,128,false,Image.FORMAT_RGBA8)
static var texture := ImageTexture.create_from_image(image)
static func row_for(pid: String, colors: Dictionary) -> int:
 if not rows.has(pid):
  for candidate in range(1,128):
   if candidate not in rows.values():
    rows[pid] = candidate
    break
  if not rows.has(pid): return 0
 var row: int = rows[pid]
 var signature := JSON.stringify(colors)
 if signatures.get(pid,"") != signature:
  signatures[pid] = signature
  for part in parts:
   var value: String = colors.get(part.mesh,"")
   image.set_pixel(part.id,row,Color.from_string("#"+value.trim_prefix("#"),Color.TRANSPARENT) if value != "" else Color.TRANSPARENT)
  texture.update(image)
 return row

static func release_unused(active: Array) -> void:
 for pid in rows.keys():
  if pid not in active and pid not in ["editor-preview","profile-preview"]:
   rows.erase(pid)
   signatures.erase(pid)
