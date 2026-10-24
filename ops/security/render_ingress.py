"""Render Nginx/Tunnel artifacts from server/allowed_hosts.json; no live writes."""
import argparse
import json
from pathlib import Path
import re
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'server'))
from host_policy import INVENTORY

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
args.output.mkdir(parents=True,exist_ok=True)
hosts=[h for h in INVENTORY['hosts'] if h['registered'] and h['node']=='hk']
names=[h['hostname'] for h in hosts]
mapping=['# http context; generated from server/allowed_hosts.json',
         'map $http_host $iridescently_registered_host {', '    default "";']
mapping += ['    ~*^'+re.escape(h)+'(?::(?:80|443))?$ '+h+';' for h in names]
mapping += ['}', 'map $http_x_forwarded_proto $iridescently_visitor_https {', '    default 0;', '    https 1;', '}']
(args.output/'host-map.conf').write_text('\n'.join(mapping)+'\n',encoding='utf-8')
(args.output/'origin-default.conf').write_text('''# Never open public 80/443 for a Tunnel-only origin.
server {
    listen 127.0.0.1:8080 default_server;
    server_name _;
    return 444;
}
''',encoding='utf-8')
(args.output/'origin-guards.conf').write_text('''# Include inside the existing, exact-name business server on 127.0.0.1:8080.
# cloudflared must preserve visitor X-Forwarded-Proto; only loopback can connect.
if ($iridescently_registered_host = "") { return 421; }
if ($iridescently_visitor_https = 0) {
    return 308 https://$iridescently_registered_host$request_uri;
}
''',encoding='utf-8')
(args.output/'business-server-name.conf').write_text('server_name '+' '.join(names)+';\n',encoding='utf-8')
# Install only if a separately authorized origin TLS listener actually exists.
# This is deliberately not part of the Tunnel-only HTTP listener configuration.
(args.output/'tls-default-if-needed.conf').write_text('''# Conditional, NOT for automatic installation: Nginx >= 1.19.4.
# Keep this listener private. Do not create a new public Web ingress.
server {
    listen 127.0.0.1:8443 ssl default_server;
    server_name _;
    ssl_reject_handshake on;
}
# In each named TLS business vhost use a certificate covering that exact name.
# Reject Host/SNI disagreement BEFORE proxying:
# if ($ssl_server_name != $host) { return 421; }
''',encoding='utf-8')
for node in ('hk','pc'):
    entries=[h for h in INVENTORY['hosts'] if h['registered'] and h['node']==node]
    config={'ingress':[{'hostname':h['hostname'],'service':h['service']} for h in entries]+[{'service':'http_status:404'}]}
    (args.output/('tunnel-'+node+'-ingress.json')).write_text(json.dumps(config,indent=2)+'\n',encoding='utf-8')
print('Rendered',len(list(args.output.iterdir())),'files from',len(names),'HK hostnames')
