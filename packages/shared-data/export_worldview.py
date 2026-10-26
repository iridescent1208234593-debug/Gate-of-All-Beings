"""Generate the shared catalogue and arena balance from a read-only DB snapshot."""
import argparse
import hashlib
import importlib.util
import json
import re
import sqlite3
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATABASE = ROOT.parent / 'assets/罗小黑战记数据库/db/worldview_luoxiaohei_v4.db'

def export(database=DATABASE, source='local-reference', output=None, media_manifest=None):
    target = Path(output or ROOT / 'shared-data')
    target.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(Path(database).resolve().as_uri() + '?mode=ro', uri=True) as db:
        db.row_factory = sqlite3.Row
        all_characters = list(db.execute('SELECT * FROM characters ORDER BY id'))
        active = [r for r in all_characters if r['merged_to'] is None]
        targets = {r['id']: r['merged_to'] for r in all_characters}
        def canonical(cid):
            seen=set()
            while targets.get(cid) is not None:
                if cid in seen: raise ValueError('Character merge cycle: '+str(cid))
                seen.add(cid);cid=targets[cid]
            if cid not in targets: raise ValueError('Unknown merged character: '+str(cid))
            return cid
        abilities = {}
        unresolved_abilities=[]
        for row in db.execute('SELECT character_id, ability FROM character_abilities UNION SELECT character_id, ability FROM character_abilities_ext'):
            if row['character_id'] not in targets:
                unresolved_abilities.append(dict(row));continue
            abilities.setdefault(canonical(row['character_id']), []).append(row['ability'])
        facts = [{'id': r['id'], 'name': r['name'], 'aliases': r['aliases'] or '',
                'species': r['species'] or r['original_form'] or '',
                'affiliation': r['affiliation'] or '',
                'abilities': sorted(set(abilities.get(r['id'], []))),
                'abilitiesSummary': r['abilities_summary'] or '',
                'summary': r['story_summary'] or '', 'category': r['category'] or '',
                'gender': r['gender'] or '', 'personality': r['personality'] or '',
                'appearance': r['appearance'] or '', 'voice': r['voice_actor'] or '',
                'sourceUrl': r['source_url'] or ''} for r in active]
        # Match ability-system labels explicitly; arena's five-element + space axes are separate.
        labels = {'yuling':'御灵', 'shengling':'生灵', 'zaowu':'造物',
                  'kongjian':'空间', 'xinling':'心灵', 'suoyu':'锁御'}
        for c in facts:
            text = c['abilitiesSummary'] + ';' + ';'.join(c['abilities'])
            c['systems'] = [key for key, label in labels.items() if label + '系' in text]
            c['elements'] = [key for key, label in {'jin':'金','mu':'木','shui':'水','huo':'火','tu':'土'}.items()
                             if re.search(r'御灵系[·—\-：:]?' + label, text)]
        by_id={c['id']:c for c in facts}
        canonical_names={}
        alternate_names={}
        for row in all_characters:
            cid=canonical(row['id'])
            for name in [row['name'],*re.split(r'[、,，;；\n]',row['aliases'] or '')]:
                if name.strip():alternate_names.setdefault(name.strip(),set()).add(cid)
        for c in facts:canonical_names.setdefault(c['name'],set()).add(c['id'])
        unresolved_profiles=[]
        profile_conflicts=[]
        for row in db.execute('SELECT * FROM character_info ORDER BY id'):
            ids=canonical_names.get(row['character_name']) or alternate_names.get(row['character_name']) or set()
            if len(ids)!=1:
                unresolved_profiles.append({'rowId':row['id'],'name':row['character_name'],'candidateIds':sorted(ids)})
                continue
            c=by_id[next(iter(ids))]
            if 'profile' not in c:
                c['profile']={k:row[k] or '' for k in ('identity','personality','appearance','voice_actor','source_url')}
                c['profile']['sourceRowId']=row['id']
                c['profile']['sourceRowIds']=[row['id']]
            else:
                c['profile']['sourceRowIds'].append(row['id'])
                for key in ('identity','personality','appearance','voice_actor','source_url'):
                    if not c['profile'][key]:c['profile'][key]=row[key] or ''
                    elif row[key] and c['profile'][key]!=row[key]:profile_conflicts.append({'characterId':c['id'],'field':key,'retainedRowId':c['profile']['sourceRowId'],'otherRowId':row['id'],'retained':c['profile'][key],'other':row[key]})
        media=json.loads(Path(media_manifest).read_text(encoding='utf-8'))['media'] if media_manifest else {}
        image_candidates={}
        for row in db.execute('SELECT id,character_id,image_path FROM character_images ORDER BY COALESCE(sort_order,id),id'):
            if row['character_id'] not in targets:continue
            path=(row['image_path'] or '').replace('\\','/')
            for prefix in ('/srv/iridescently/data/','E:/Projects/'):
                if path.startswith(prefix):path=path[len(prefix):]
            if not path.startswith('assets/罗小黑战记数据库/images/') or path not in media:continue
            if any(word in path for word in ('配音演员','未定','同人','候审','ai-art')):continue
            image_candidates.setdefault(canonical(row['character_id']),[]).append(row['id'])
        avatar_ids={r['id']:r['avatar_id'] for r in active}
        for c in facts:
            choices=image_candidates.get(c['id'],[])
            if choices:
                selected=avatar_ids[c['id']] if avatar_ids[c['id']] in choices else choices[0]
                c['imageRef']={'kind':'character-image','id':selected,'url':'/api/official/img-id?id='+str(selected)+'&t=1'}
        fingerprint = hashlib.sha256(json.dumps(facts, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        data = {
            'schemaVersion': 2,
            'source': 'worldview_luoxiaohei_v4.db',
            'provenance': {'source': source, 'characterFactsSha256': fingerprint,
                           'schema': dict(db.execute('SELECT key,value FROM meta')).get('schema_version'),
                           'sourceRows':len(all_characters), 'activeCharacters':len(active)},
            'redirects': {str(r['id']):canonical(r['id']) for r in all_characters if r['merged_to'] is not None},
            'characterAliases': [{'id':canonical(r['id']), 'name':r['name'], 'aliases':r['aliases'] or ''} for r in all_characters],
            'idMappings': [dict(r) for r in db.execute('SELECT * FROM character_id_map ORDER BY system,system_local_id')],
            'characters': facts,
            'locations': [dict(r) for r in db.execute('SELECT id,name,type,description FROM locations ORDER BY id')],
            'timeline': [{ 'id':r['id'], 'era':r['era'] or '', 'event':r['event'] or '',
                'description':r['description'] or '', 'relatedCharacters':r['related_characters'] or ''
            } for r in db.execute('SELECT * FROM timeline_v2 ORDER BY id')],
            'terms': [dict(r) for r in db.execute('SELECT id,category,term,definition FROM spirit_lifecycle ORDER BY id')],
            'organizations': [dict(r) for r in db.execute('SELECT * FROM organizations ORDER BY id')],
        }
    arena = Path(__file__).parent / 'arena'
    def load_script(name):
        spec = importlib.util.spec_from_file_location(name, arena / 'scripts' / (name + '.py'))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    stats_generator = load_script('generate_stats')
    decks_generator = load_script('generate_decks')
    model = json.loads((arena / 'stat-model.json').read_text(encoding='utf-8'))
    systems = json.loads((arena / 'six-systems.json').read_text(encoding='utf-8'))
    overrides = json.loads((arena / 'manual-overrides.json').read_text(encoding='utf-8'))
    model_fingerprint=hashlib.sha256(b''.join((arena/name).read_bytes() for name in ('stat-model.json','six-systems.json','manual-overrides.json','scripts/generate_stats.py','scripts/generate_decks.py'))).hexdigest()
    data['provenance']['balanceModelSha256']=model_fingerprint
    data['provenance']['mediaManifestSha256']=hashlib.sha256(Path(media_manifest).read_bytes()).hexdigest() if media_manifest else None
    stats = stats_generator.build_records(str(Path(database).resolve()), model, systems, 'all', overrides)
    meta = {'source': source, 'characterFactsSha256': fingerprint, 'model_version': model['version'], 'balanceModelSha256':model_fingerprint,
            'note': '游戏平衡推导值；境界/稀有度不是原作事实。arena systems 为五行加空间的历史游戏维度。'}
    (target / 'arena').mkdir(exist_ok=True)
    stat_file = target / 'arena/character_stats.json'
    stat_file.write_text(json.dumps({'meta':meta, 'characters':stats}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    _, decks, violations, _, _ = decks_generator.build_decks(str(stat_file), systems, model)
    if violations:
        raise ValueError('Arena pacing violations: ' + str(violations))
    assert {c['id'] for c in facts} == {c['id'] for c in stats} == {d['character_id'] for d in decks}
    (target / 'arena/decks.json').write_text(json.dumps({'meta':meta, 'decks':decks}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    by_id = {c['id']:c for c in stats}
    for c in facts:
        s = by_id[c['id']]
        c['balance'] = {k:s[k] for k in ('hp','attack','defense','power','tier','rarity','realm_key','realm_name')}
        c['balance']['modelVersion'] = model['version']
    (target / 'worldview.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    (target / 'worldview-data.js').write_text('// Generated by export_worldview.py; edit the DB or model, then regenerate.\nexport default '+json.dumps(data, ensure_ascii=False, separators=(',', ':'))+';\n', encoding='utf-8')
    index = {'names':{str(c['id']):c['name'] for c in facts}, 'redirects':data['redirects']}
    (target / 'identities.js').write_text('// Generated lightweight identity index; full facts stay lazy-loaded.\nconst index='+json.dumps(index,ensure_ascii=False,separators=(',',':'))+';\nexport function identityById(id){const key=index.redirects[id]??Number(id);return index.names[key]?{id:key,name:index.names[key]}:undefined;}\n',encoding='utf-8')
    (target / 'consolidation.json').write_text(json.dumps({'source':source,'sourceRows':len(all_characters),'canonicalCharacters':len(facts),'retiredIds':data['redirects'],'profilesMatched':sum('profile' in c for c in facts),'unresolvedProfiles':unresolved_profiles,'profileConflicts':profile_conflicts,'unresolvedAbilities':unresolved_abilities},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:len(v) for k,v in data.items() if isinstance(v,list)},ensure_ascii=False))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, required=True)
    parser.add_argument('--source', required=True)
    parser.add_argument('--out', type=Path)
    parser.add_argument('--media-manifest',type=Path)
    parser.add_argument('--verify',action='store_true',help='Regenerate in a temporary directory and compare all generated files; verify source DB bytes unchanged')
    args = parser.parse_args()
    if args.verify:
        before=hashlib.sha256(args.db.read_bytes()).hexdigest()
        expected=args.out or Path(__file__).parent
        with tempfile.TemporaryDirectory(prefix='lxh-catalog-verify-') as directory:
            export(args.db,args.source,Path(directory),args.media_manifest)
            files=list(Path(directory).rglob('*'))
            generated=[p for p in files if p.is_file()]
            for p in generated:
                if p.read_bytes()!=(expected/p.relative_to(directory)).read_bytes():raise SystemExit('Generated data drift: '+str(p.relative_to(directory)))
        if before!=hashlib.sha256(args.db.read_bytes()).hexdigest():raise SystemExit('Source DB was modified')
        print(json.dumps({'verifiedGeneratedFiles':len(generated),'sourceUnchanged':True}))
    else:export(args.db, args.source, args.out,args.media_manifest)
