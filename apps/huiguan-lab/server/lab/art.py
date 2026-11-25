"""LAB shared art copies. Originals stay in the artists' asset library."""
from __future__ import annotations

import asyncio
import json
import secrets
import time
from urllib.parse import unquote

from .config import SOURCE_ROOT
from .oc import OCRejected, normalize_image

CATEGORIES = {'creature', 'plant', 'tree', 'bridge', 'ground', 'building', 'character', 'prop', 'other'}


def catalog(store):
    manifest = SOURCE_ROOT / 'client/data/art-catalog.json'
    builtin = json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else []
    uploaded = [dict(r) for r in store.all(
        "SELECT id,filename AS name,category,width,height FROM art_assets WHERE status='approved' ORDER BY created_at DESC")]
    return builtin + uploaded


async def upload(request, lab, uploader):
    category = request.headers.get('x-art-category', 'other')
    if category not in CATEGORIES:
        raise OCRejected('bad_category')
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > lab.cfg.art_max_bytes:
            raise OCRejected('too_large')
        data.extend(chunk)
    # Source accepts 8 MiB / 4096 px; the live copy is bounded for mobile/network use.
    png, w, h, _ = await asyncio.to_thread(normalize_image, bytes(data), lab.cfg.art_max_bytes, 4096, 2048)
    preview, _, _, _ = await asyncio.to_thread(normalize_image, png, 32 * 1024 * 1024, 2048, 512)
    aid = 'a_' + secrets.token_hex(6)
    name = unquote(request.headers.get('x-art-name', '未命名')).replace('\x00', '')[:80]
    (lab.cfg.art_dir / 'approved' / f'{aid}.png').write_bytes(png)
    (lab.cfg.art_dir / 'approved' / f'{aid}.preview.png').write_bytes(preview)
    lab.store.exec("INSERT INTO art_assets(id,uploader,category,filename,mime,width,height,bytes,status,created_at,reviewed_at,reviewer) "
                   "VALUES(?,?,?,?,?,?,?,?, 'approved',?,?,'lab-live')",
                   (aid, uploader, category, name, 'image/png', w, h, len(png), time.time(), time.time()))
    lab.store.audit(uploader, 'art.upload', aid, category=category, bytes=len(data))
    return {'ok': True, 'id': aid, 'status': 'approved', 'width': w, 'height': h}
