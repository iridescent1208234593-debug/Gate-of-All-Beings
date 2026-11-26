"""Repacks PixelFX sprite sheets (from `pfx sheets`) into small, web-friendly pages for the LAB skill system.

For each effect: keep every other frame when the source runs at 24 fps or more (pixel art reads fine at 15),
crop every frame to the union of their visible pixels, and lay the frames out on pages no larger than
2048 x 2048 (the safe WebGL texture size). Output, served by the gateway at /fx/:

    <out>/<category>/<name>.json   {fps, loop, n, w, h, origin:[x,y], cols, per_page, pages:[file...]}
    <out>/<category>/<name>_<k>.webp  (lossless)
    <out>/manifest.json            {id: {bytes, pages, n}}

    server/.venv/Scripts/python.exe scripts/pack_skill_fx.py <sheets dir> [out dir]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

LAB = Path(__file__).resolve().parents[1]
PAGE = 2048
MAX_FRAMES = 96          # the longest effects (nuke, big explosion) drop further frames to stay this long


def pack(sheet_json: Path, out_dir: Path) -> dict:
    meta = json.loads(sheet_json.read_text(encoding="utf-8"))
    px = meta["meta"]["pixelfx"]
    sheet = Image.open(sheet_json.with_suffix(".png")).convert("RGBA")
    rects = [f["frame"] for f in meta["frames"]]
    fps = float(px.get("fps", 30))
    loop = bool(px.get("loop", False))
    n0 = len(rects)
    step = 2 if fps >= 24 else 1
    while (n0 + step - 1) // step > MAX_FRAMES:
        step += 1
    keep = list(range(0, n0, step))
    if not loop and keep[-1] != n0 - 1:
        keep.append(n0 - 1)
    frames = [sheet.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"])) for r in (rects[i] for i in keep)]
    box = None
    for f in frames:
        b = f.getchannel("A").getbbox()
        if b:
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    if box is None:
        box = (0, 0, 1, 1)
    frames = [f.crop(box) for f in frames]
    w, h = box[2] - box[0], box[3] - box[1]
    pivot = px.get("pivot") or [rects[0]["w"] // 2, rects[0]["h"]]
    cols = max(1, PAGE // w)
    rows = max(1, PAGE // h)
    per_page = cols * rows
    name = sheet_json.stem
    out_dir.mkdir(parents=True, exist_ok=True)
    pages, total = [], 0
    for k in range(0, len(frames), per_page):
        chunk = frames[k:k + per_page]
        pc = min(cols, len(chunk))
        pr = (len(chunk) + cols - 1) // cols
        page = Image.new("RGBA", (pc * w, pr * h), (0, 0, 0, 0))
        for i, f in enumerate(chunk):
            page.paste(f, ((i % cols) * w, (i // cols) * h))
        fn = f"{name}_{len(pages)}.webp"
        page.save(out_dir / fn, lossless=True, quality=100, method=5)
        total += (out_dir / fn).stat().st_size
        pages.append(fn)
    info = {"fps": round(fps / step, 3), "loop": loop, "n": len(frames), "w": w, "h": h,
            "origin": [pivot[0] - box[0], pivot[1] - box[1]], "cols": cols, "per_page": per_page, "pages": pages,
            "source_size": [rects[0]["w"], rects[0]["h"]]}
    (out_dir / f"{name}.json").write_text(json.dumps(info), encoding="utf-8")
    return {"bytes": total, "pages": len(pages), "n": len(frames)}


def main() -> None:
    src = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else LAB / "build" / "skill-fx"
    manifest = {}
    for j in sorted(src.glob("*/*.json")):
        fid = f"{j.parent.name}/{j.stem}"
        manifest[fid] = pack(j, out / j.parent.name)
        print(f"{fid:36s} {manifest[fid]['bytes'] / 1024:8.0f} KB  {manifest[fid]['n']:3d} frames")
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    print(f"{len(manifest)} effects, {sum(m['bytes'] for m in manifest.values()) / 1048576:.1f} MB -> {out}")


if __name__ == "__main__":
    main()
