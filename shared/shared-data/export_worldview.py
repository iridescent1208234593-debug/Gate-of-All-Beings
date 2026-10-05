"""Export read-only facts. Run after an intentional database update."""
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATABASE = ROOT.parent / 'assets/罗小黑战记数据库/db/worldview_luoxiaohei_v4.db'

def export():
    with sqlite3.connect(DATABASE.as_uri() + '?mode=ro', uri=True) as db:
        db.row_factory = sqlite3.Row
        active = list(db.execute('SELECT * FROM characters WHERE merged_to IS NULL ORDER BY id'))
        abilities = {}
        for row in db.execute('SELECT character_id, ability FROM character_abilities UNION SELECT character_id, ability FROM character_abilities_ext'):
            abilities.setdefault(row['character_id'], []).append(row['ability'])
        data = {
            'schemaVersion': 1,
            'source': 'worldview_luoxiaohei_v4.db',
            'characters': [{
                'id': r['id'], 'name': r['name'], 'aliases': r['aliases'] or '',
                'species': r['species'] or r['original_form'] or '',
                'affiliation': r['affiliation'] or '',
                'abilities': sorted(set(abilities.get(r['id'], []))),
                'sourceUrl': r['source_url'] or '',
            } for r in active],
            'locations': [dict(r) for r in db.execute('SELECT id,name,type,description FROM locations ORDER BY id')],
            'timeline': [{ 'id':r['id'], 'era':r['era'] or '', 'event':r['event'] or '',
                'description':r['description'] or '', 'relatedCharacters':r['related_characters'] or ''
            } for r in db.execute('SELECT * FROM timeline_v2 ORDER BY id')],
            'terms': [dict(r) for r in db.execute('SELECT id,category,term,definition FROM spirit_lifecycle ORDER BY id')],
            'organizations': [dict(r) for r in db.execute('SELECT * FROM organizations ORDER BY id')],
        }
    out = ROOT / 'shared-data/worldview.json'
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k:len(v) for k,v in data.items() if isinstance(v,list)},ensure_ascii=False))

if __name__ == '__main__':
    export()
