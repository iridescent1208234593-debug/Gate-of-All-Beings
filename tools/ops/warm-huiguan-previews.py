#!/usr/bin/env python3
"""Pre-generate the huiguan fan gallery's WebP thumbnails and site versions.

Read-only by design: it only sends the same public GET requests a visitor's browser sends
(/api/fan/list, then /api/uploads/preview?...&t=1 and the 1600px site version). The service
writes the results into its rebuildable preview cache (cache root, huiguan/previews); upload
originals and databases are never opened for writing. Undo = nothing to undo; the cache files
can be deleted at any time and are regenerated on demand.

    python tools/ops/warm-huiguan-previews.py --base http://127.0.0.1:8090 --dry-run
    python tools/ops/warm-huiguan-previews.py --base https://<huiguan host> --delay 0.3
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PREVIEW_PATHS = ("/api/uploads/preview", "/api/image-preview")


def fetch(url, timeout):
    request = urllib.request.Request(url, headers={"User-Agent": "Iridescently-PreviewWarm/1.0", "Accept": "*/*"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.status, response.headers.get("Content-Type", ""), response.read()


def gallery_images(base, views, timeout):
    seen = []
    for view in views:
        page = 1
        while True:
            query = urllib.parse.urlencode({"view": view, "page": page, "limit": 60})
            _, _, body = fetch(f"{base}/api/fan/list?{query}", timeout)
            data = json.loads(body.decode("utf-8"))
            rows = data.get("characters") or []
            for row in rows:
                image = row.get("image_data") or ""
                if urllib.parse.urlsplit(image).path in PREVIEW_PATHS and image not in seen:
                    seen.append(image)
            if not rows or page * 60 >= int(data.get("total") or 0):
                break
            page += 1
    return seen


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--base", required=True, help="huiguan origin, e.g. http://127.0.0.1:8090")
    parser.add_argument("--views", default="art,ai", help="gallery sections to warm (default art,ai)")
    parser.add_argument("--delay", type=float, default=0.2, help="seconds between image requests")
    parser.add_argument("--timeout", type=float, default=60)
    parser.add_argument("--thumbs-only", action="store_true", help="skip the 1600px site versions")
    parser.add_argument("--dry-run", action="store_true", help="list what would be requested")
    args = parser.parse_args()
    base = args.base.rstrip("/")
    images = gallery_images(base, [v.strip() for v in args.views.split(",") if v.strip()], args.timeout)
    targets = []
    for image in images:
        targets.append(image + ("&" if "?" in image else "?") + "t=1")
        if not args.thumbs_only:
            targets.append(image)
    print(f"{len(images)} gallery images, {len(targets)} preview requests")
    if args.dry_run:
        for target in targets:
            print(target)
        return 0
    failures, total = 0, 0
    for index, target in enumerate(targets, 1):
        started = time.monotonic()
        try:
            status, content_type, body = fetch(base + target, args.timeout)
            ok = status == 200 and content_type.startswith("image/webp")
        except (urllib.error.URLError, OSError) as error:
            ok, status, body = False, getattr(error, "code", "ERR"), b""
        total += len(body)
        failures += not ok
        print(f"[{index}/{len(targets)}] {'ok ' if ok else 'FAIL'} {status} {len(body):>8} B "
              f"{time.monotonic() - started:5.2f}s {target}")
        time.sleep(args.delay)
    print(f"done: {len(targets) - failures} ok, {failures} failed, {total / 1048576:.1f} MiB served")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
