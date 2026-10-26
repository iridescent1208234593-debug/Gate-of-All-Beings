"""Bounded external negative tests. Never disables certificate validation."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import datetime as dt
import http.client
import json
from pathlib import Path
import socket
import ssl
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[2] / "services" / "platform"))
# Probe what is deployed, not every host the application would accept.
PRODUCTION_HOSTS = frozenset(h['hostname'] for h in json.loads((Path(__file__).with_name('deployed-hosts.json')).read_text('utf-8'))['hosts']
                             if h['registered'] and h['node'] == 'hk')

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--origin-ip',required=True)
parser.add_argument('--edge-ip',required=True)
parser.add_argument('--output',type=Path,required=True)
parser.add_argument('--edge-only',action='store_true')
args=parser.parse_args()

def probe(job):
    ip,port,sni,host=job
    row={'ip':ip,'port':port,'sni':sni,'host':host}
    raw=conn=None
    try:
        raw=socket.create_connection((ip,port),timeout=4)
        if sni:
            raw=ssl.create_default_context().wrap_socket(raw,server_hostname=sni)
        conn=http.client.HTTPConnection(ip,port,timeout=4);conn.sock=raw
        conn.request('GET','/',headers={'Host':host,'Connection':'close','User-Agent':'Iridescently-Host-Isolation/1'})
        response=conn.getresponse();body=response.read(16384)
        row.update(status=response.status,location=response.getheader('Location'),body_bytes=len(body))
        row['ok']=response.status>=400 and not any(mark in body for mark in (b'id="root"',b'iridescently-shell-view',b'page-home'))
    except ssl.SSLCertVerificationError as error:
        row.update(ok=True,result='TLS client validation rejected; not proof of server handshake reject',error=str(error))
    except ssl.SSLError as error:
        row.update(ok=True,result='TLS handshake rejected',error=str(error))
    except ConnectionRefusedError:
        row.update(ok=True,result='TCP refused')
    except (TimeoutError,socket.timeout):
        row.update(ok=False,result='inconclusive timeout; do not count as firewall proof')
    except (ConnectionResetError,http.client.RemoteDisconnected) as error:
        row.update(ok=True,result='connection rejected/closed',error=str(error))
    except Exception as error:
        row.update(ok=False,error=str(error))
    finally:
        if conn:conn.close()
        elif raw:raw.close()
    return row

jobs=[(args.origin_ip,p,None,'zszm.iridescently.xyz') for p in (80,4173,5174,5177,5178,8080,18180,18190)]
jobs += [(args.origin_ip,443,sni,host) for sni,host in [(args.origin_ip,args.origin_ip),('evil.example','zszm.iridescently.xyz')]]
jobs += [(args.edge_ip,443,sni,host) for sni,host in [('zszm.iridescently.xyz','evil.example'),('evil.example','zszm.iridescently.xyz'),('evil.example','evil.example'),('unregistered-isolation.iridescently.xyz','unregistered-isolation.iridescently.xyz')]]
if args.edge_only:
    jobs=[job for job in jobs if job[0]==args.edge_ip]
rows=list(ThreadPoolExecutor(max_workers=4).map(probe,jobs))
result={'at_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'ok':all(r['ok'] for r in rows),
        'network':'single local network; not two independent networks','scope':'edge negatives only' if args.edge_only else 'origin and edge negatives','checks':rows}
args.output.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
for row in rows:print(json.dumps(row))
sys.exit(0 if result['ok'] else 1)
