"""Build the shared host inventory from existing repo + CF/Tunnel evidence."""
import argparse
import ast
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--before", type=Path, required=True)
parser.add_argument("--control", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--website-manager", type=Path, required=True,
                    help="网站恢复/website-manager.py in the Operations directory (outside Git)")
args = parser.parse_args()
tree = ast.parse(args.website_manager.read_text("utf-8-sig"))
portal = next(node for node in ast.walk(tree) if isinstance(node, ast.Call) and
              any(k.arg == 'key' and isinstance(k.value, ast.Constant) and k.value.value == 'portal' for k in node.keywords))
repo_hosts = set(ast.literal_eval(next(k.value for k in portal.keywords if k.arg == 'domains')))
records = json.loads(args.before.read_text("utf-8"))["records"]
tunnels = json.loads((args.control / 'tunnels.json').read_text('utf-8'))['pages'][0]['result']
nodes = {'zszm-hk-ecsvkdu0': 'hk', 'iridescently-pc-preview': 'pc'}
hosts = []
for record in records:
    tunnel = next((t for t in tunnels if record['content'] == t['id'] + '.cfargotunnel.com'), None)
    node = nodes.get(tunnel['name']) if tunnel else None
    mapped = record['name']
    if node == 'pc':
        mapped = 'iridescently.xyz' if mapped == 'pc.iridescently.xyz' else mapped.removeprefix('pc-')
    active = mapped in repo_hosts and node in {'hk', 'pc'}
    config = None
    if active:
        ingress = json.loads((args.control / ('tunnel-config-' + tunnel['id'] + '.json')).read_text('utf-8'))['pages'][0]['result']['config']['ingress']
        matches = [i for i in ingress if i.get('hostname') == record['name']]
        assert len(matches) == 1 and not any('*' in i.get('hostname', '') for i in ingress)
        assert ingress[-1].get('service') == 'http_status:404'
        config = matches[0]
    hosts.append({'hostname': record['name'], 'node': node if active else 'external' if record.get('meta', {}).get('r2_bucket') else 'retired-or-test',
                  'application_host': mapped if active else None, 'registered': active,
                  'dns_target': record['content'], 'tunnel_id': tunnel['id'] if tunnel else None,
                  'service': config['service'] if config else None})
assert {h['hostname'] for h in hosts if h['node'] == 'hk'} == repo_hosts
assert len([h for h in hosts if h['node'] == 'pc']) == len(repo_hosts)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps({'schema': 1, 'trailing_dot': 'reject', 'ip_literals': 'reject',
    'sources': ['repository portal SITES.domains', args.before.name, 'Cloudflare Tunnel configuration snapshots 2026-10-24'],
    'hosts': sorted(hosts, key=lambda h: h['hostname'])}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Inventory:',len(hosts),'known names;',sum(h['registered'] for h in hosts),'registered app hosts')
