"""Focused OC regression; each module owns disposable test storage and loopback ports."""
import argparse
import json
import os
import shutil
from pathlib import Path
import subprocess
import sys
import tempfile
import time
ROOT=Path(__file__).resolve().parents[2]
MODULES=[
 'services/platform/tests/test_oc_store.py',
 'services/platform/tests/test_oc_migration_cli.py',
 'services/platform/tests/test_oc_load.py',
 'apps/huiguan/tests/test_oc_sql_api.py',
 'apps/huiguan/tests/test_fan_owner_edit.py',
 'apps/huiguan/tests/test_original_image_access.py',
 'apps/huiguan/tests/test_edit_role_column.py',
 'apps/huiguan/tests/test_fan_reaction_migration.py',
 'apps/huiguan/tests/test_fanart_upload_limit.py',
 'apps/huiguan/tests/test_fanart_volumes.py',
 'apps/huiguan/tests/test_official_title_blacklist.py',
 'services/platform/tests/test_account_progress.py',
 'services/platform/tests/test_game_save_scope.py',
 'services/platform/tests/test_huiguan_oauth_session.py',
 'services/platform/tests/test_static_security.py',
 'services/platform/tests/test_source_export.py',
 'apps/cards/tests/test_gate_identity_scope.py',
]


def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--report',type=Path);args=parser.parse_args()
 results=[]
 with tempfile.TemporaryDirectory(prefix='oc-regression-') as temporary:
  env={k:v for k,v in os.environ.items() if not k.startswith('IRIDESCENTLY_')}
  env.update(IRIDESCENTLY_STORAGE_ROOT=temporary,IRIDESCENTLY_ENVIRONMENT='test',IRIDESCENTLY_PROJECT_ROOT=str(ROOT),PYTHONDONTWRITEBYTECODE='1',HX_SSO_SECRET='oc-regression-test-only')
  subprocess.run([sys.executable,'-c',
                  "import sys;sys.path.insert(0,sys.argv[1]);from storage_paths import initialize_storage;initialize_storage()",
                  str(ROOT/'services/platform')],env=env,check=True,capture_output=True)
  for relative in MODULES:
   start=time.monotonic()
   result=subprocess.run([sys.executable,str(ROOT/relative)],env=env,cwd=ROOT,capture_output=True,text=True,timeout=90)
   print(relative+': '+('PASS' if result.returncode==0 else 'FAIL'),flush=True)
   if result.returncode: print(result.stdout+result.stderr,flush=True)
   import re
   match=re.search(r'Ran (\d+) tests?',result.stderr)
   entry={'module':relative,'passed':result.returncode==0,'tests':int(match.group(1)) if match else None,'seconds':round(time.monotonic()-start,3)}
   if relative.endswith('test_oc_load.py') and result.returncode==0:
    entry['synthetic_capacity']=json.loads(result.stdout.strip().splitlines()[-1])
   results.append(entry)
 node=shutil.which('node')
 for relative in ('apps/huiguan/tests/oc-revisions.cjs','apps/huiguan/tests/oc-member-delete.cjs'):
  result=subprocess.run([node,str(ROOT/relative)],capture_output=True,text=True) if node else None
  if result and result.returncode: print(result.stdout+result.stderr,flush=True)
  results.append({'module':relative,'passed':bool(result and result.returncode==0),'tests':1,'seconds':0})
 report={'passed':all(x['passed'] for x in results),'checks':results,'tests':sum(x['tests'] or 0 for x in results)}
 if args.report:
  args.report.parent.mkdir(parents=True,exist_ok=True);args.report.write_text(json.dumps(report,indent=2))
 print(json.dumps(report,indent=2))
 return 0 if report['passed'] else 1


if __name__=='__main__':sys.exit(main())
