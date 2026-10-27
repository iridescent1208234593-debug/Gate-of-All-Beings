# -*- coding: utf-8 -*-
"""Externalize OC image/HTML assets through the active Store; offline, never a SQL import.

Stop ALL service writers first. Production use requires separate owner authorization.
JSON source is backed up; SQL source requires a verified SQLite/storage backup before running.
"""
import argparse
from pathlib import Path
import shutil
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--confirm-stopped', action='store_true')
    parser.add_argument('--allow-production', action='store_true')
    args = parser.parse_args()
    if not args.confirm_stopped: parser.error('stop all writers and pass --confirm-stopped')
    from storage_paths import environment
    if environment() == 'production' and not args.allow_production: parser.error('separate production authorization required')
    import server_huiguan as S
    from oc_store import parse_owner
    store = S.character_store()
    moved_html = moved_img = 0
    with store.transaction(write=True) as session:
        if store.backend == 'json' and Path(S.DATA_FILE).exists():
            backup = S.DATA_FILE + '.bak_' + time.strftime('%Y%m%d_%H%M%S')
            if Path(backup).exists(): raise FileExistsError('backup already exists')
            shutil.copy2(S.DATA_FILE, backup)
        for key in session.snapshot():
            ident = parse_owner(key)
            for record in session.list(ident):
                changed = False
                if record.get('html'):
                    record['html_ref'] = S.store_showcase_html(record.pop('html'))
                    moved_html += 1; changed = True
                data = record.get('data') or {}
                if isinstance(data.get('image'), str) and data['image'].startswith('data:'):
                    data['image'] = S.store_data_uri(data['image']); moved_img += 1; changed = True
                if isinstance(data.get('images'), list):
                    for index, image in enumerate(data['images']):
                        if isinstance(image, str) and image.startswith('data:'):
                            data['images'][index] = S.store_data_uri(image); moved_img += 1; changed = True
                if changed:
                    session.save(ident, record, record.get('_oc_version'))
    print({'externalized_html': moved_html, 'externalized_images': moved_img})


if __name__ == '__main__':
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'services/platform'))
    main()
