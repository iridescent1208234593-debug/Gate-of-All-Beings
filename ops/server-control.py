"""Local operations shared by Server Manager and the command line."""
import argparse
from datetime import datetime, timezone
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import time
import urllib.request
import server_assets as assets

ROOT=Path(__file__).resolve().parents[1]
STATE=ROOT/'.releases/server-manager'
STATE.mkdir(parents=True,exist_ok=True)
PYTHON=Path.home()/'AppData/Local/Python/pythoncore-3.14-64/python.exe'
if not PYTHON.exists():PYTHON=Path(sys.executable)
NO_WINDOW=getattr(subprocess,'CREATE_NO_WINDOW',0)

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

release=load('hk_release',ROOT/'ops/hk-release.py')

def stamp():return datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')

def pc_configure():
    cf=load('cf_control',ROOT/'work/hk-bandwidth/cf_control.py')
    gateway=load('pc_preview',ROOT/'ops/pc-preview.py')
    private=STATE/'pc-tunnel.json'
    if not private.exists():
        existing=cf.api('GET',f'/accounts/{cf.ACCOUNT}/cfd_tunnel?name=iridescently-pc-preview&is_deleted=false')
        if existing:raise RuntimeError('PC tunnel exists without local credentials; inspect before creating a replacement')
        import base64
        secret=base64.b64encode(os.urandom(32)).decode()
        tunnel=cf.api('POST',f'/accounts/{cf.ACCOUNT}/cfd_tunnel',{'name':'iridescently-pc-preview','tunnel_secret':secret,'config_src':'local'})
        private.write_text(json.dumps({'AccountTag':cf.ACCOUNT,'TunnelID':tunnel['id'],'TunnelSecret':secret}))
        subprocess.run(['icacls',str(private),'/inheritance:r','/grant:r',os.environ['USERDOMAIN']+'\\'+os.environ['USERNAME']+':F','*S-1-5-18:F'],capture_output=True,check=True)
    tunnel=json.loads(private.read_text())['TunnelID']
    for host in gateway.HOSTS:
        found=cf.records(host)
        if found and any(r['type']!='CNAME' or r['content']!=tunnel+'.cfargotunnel.com' for r in found):
            raise RuntimeError('域名已由其他服务使用，未覆盖：'+host)
        cf.cname(host,tunnel)
    config='tunnel: '+tunnel+'\ncredentials-file: '+json.dumps(str(private))+'\nprotocol: http2\nmetrics: 127.0.0.1:20190\ningress:\n'
    config+=''.join('  - hostname: '+host+'\n    service: http://127.0.0.1:18190\n' for host in gateway.HOSTS)
    config+='  - service: http_status:404\n'
    (STATE/'pc-config.yml').write_text(config,encoding='utf-8')
    return {'tunnel':tunnel,'hosts':list(gateway.HOSTS),'data':'HK'}

def process_alive(record):
    if not record:return False
    # psutil is not required by the manager: query only our exact PID/creation time via PowerShell.
    result=subprocess.run(['powershell.exe','-NoProfile','-Command',
      '(Get-Process -Id '+str(int(record['pid']))+' -ErrorAction SilentlyContinue).StartTime.ToUniversalTime().Ticks'],capture_output=True,text=True,creationflags=NO_WINDOW)
    return result.returncode==0 and result.stdout.strip()==record.get('ticks')

def record_process(process):
    result=subprocess.run(['powershell.exe','-NoProfile','-Command','(Get-Process -Id '+str(process.pid)+').StartTime.ToUniversalTime().Ticks'],capture_output=True,text=True,check=True,creationflags=NO_WINDOW)
    return {'pid':process.pid,'ticks':result.stdout.strip()}

def pc_state():
    file=STATE/'pc-processes.json'
    info=json.loads(file.read_text()) if file.exists() else {}
    result={key:process_alive(info.get(key)) for key in ['gateway','tunnel']}
    result['connections']=0
    if result['tunnel']:
        try:
            opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open('http://127.0.0.1:20190/metrics',timeout=2) as response:
                import re
                match=re.search(r'^cloudflared_tunnel_ha_connections\s+(\d+)',response.read().decode(),re.M)
                if match:result['connections']=int(match.group(1))
        except OSError:pass
    result['online']=result['gateway'] and result['tunnel'] and result['connections']>0
    return result

def pc_start():
    if not (STATE/'pc-config.yml').exists():raise RuntimeError('请先配置本机入口')
    file=STATE/'pc-processes.json';info=json.loads(file.read_text()) if file.exists() else {}
    commands={'gateway':[str(PYTHON),'-X','utf8',str(ROOT/'ops/pc-preview.py')],
              'tunnel':[r'C:\Program Files (x86)\cloudflared\cloudflared.exe','tunnel','--config',str(STATE/'pc-config.yml'),'run']}
    for key,command in commands.items():
        if process_alive(info.get(key)):continue
        with (STATE/(key+'.log')).open('ab') as log:
            process=subprocess.Popen(command,cwd=STATE,stdout=log,stderr=log,creationflags=NO_WINDOW)
        time.sleep(.2)
        if process.poll() is not None:raise RuntimeError(key+' 启动失败，请查看日志 '+str(STATE/(key+'.log')))
        info[key]=record_process(process)
        assets.write_json(file,info)
    startup=Path(os.environ['APPDATA'])/'Microsoft/Windows/Start Menu/Programs/Startup/Iridescently-PC-Preview.vbs'
    pythonw=PYTHON.with_name('pythonw.exe')
    command='"'+str(pythonw)+'" "'+str(ROOT/'ops/server-control.py')+'" pc-start'
    startup.write_text('CreateObject("WScript.Shell").Run "'+command.replace('"','""')+'", 0, False\n',encoding='utf-16')
    deadline=time.monotonic()+20
    state=pc_state()
    while not state['online'] and time.monotonic()<deadline:
        time.sleep(1);state=pc_state()
    return {'pc':state,'autostart':True,'data':'HK; no local account or save writes'}

def pc_stop():
    file=STATE/'pc-processes.json';info=json.loads(file.read_text()) if file.exists() else {}
    for key,record in info.items():
        if process_alive(record):subprocess.run(['taskkill.exe','/PID',str(record['pid']),'/F'],capture_output=True,check=True,creationflags=NO_WINDOW)
    startup=Path(os.environ['APPDATA'])/'Microsoft/Windows/Start Menu/Programs/Startup/Iridescently-PC-Preview.vbs'
    startup.unlink(missing_ok=True);assets.write_json(file,{})
    return {'pc':pc_state(),'autostart':False}

def workspace():
    config=STATE/'workspace.json'
    if not config.exists():raise RuntimeError('请先下载香港资产基线')
    path=Path(json.loads(config.read_text())['path'])
    if not path.resolve().is_relative_to((ROOT/'.releases/asset-workspaces').resolve()):raise ValueError('Workspace outside managed directory')
    return path

def asset_init():
    snapshot=release.remote('assets-export')
    path=ROOT/'.releases/asset-workspaces'/stamp()
    assets.create_workspace(snapshot,path)
    (STATE/'workspace.json').write_text(json.dumps({'path':str(path)}))
    return {'workspace':str(path),'tables':len(snapshot['tables']),'media_index':len(snapshot['media']),
            'message':'在 library.sqlite3 编辑参考资料；修改的媒体放 media 下同名路径；账户/存档不在工作副本里'}

def package_assets(path,plan):
    archive=path/'assets-update.tar.gz'
    with tarfile.open(archive,'w:gz',compresslevel=1) as tar:
        content=json.dumps(plan,ensure_ascii=False).encode();info=tarfile.TarInfo('plan.json');info.size=len(content);info.mode=0o600;tar.addfile(info,io.BytesIO(content))
        for item in plan['files']:
            if item['after']:tar.add(path/'media'/item['path'],arcname='files/'+item['path'],recursive=False)
    return archive

def asset_plan(apply=False):
    path=workspace();plan=assets.plan_workspace(path)
    summary={'records':len(plan['rows']),'files':len(plan['files']),'plan_sha256':assets.digest(plan),'workspace':str(path)}
    review=path/'review.json'
    if apply:
        if not review.exists() or json.loads(review.read_text())['plan_sha256']!=summary['plan_sha256']:raise RuntimeError('资产编辑已变化，请先重新预览')
    archive=package_assets(path,plan)
    result=release.remote('assets-apply' if apply else 'assets-check',archive)
    if not apply:
        (path/'plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
        review.write_text(json.dumps(summary))
    message='只读预览通过；详细变更见工作目录 plan.json'
    if apply:message='资产更新完成；下次编辑请重新下载基线' if plan['rows'] or plan['files'] else '无资产变更，未写入香港数据'
    return {**summary,**result,'message':message}

def perform(action):
    if action=='status':
        return {'hong_kong':release.remote('status'),'pc':pc_state(),'workspace':str(workspace()) if (STATE/'workspace.json').exists() else None}
    if action=='pc-configure':return pc_configure()
    if action=='pc-start':return pc_start()
    if action=='pc-stop':return pc_stop()
    if action=='assets-init':return asset_init()
    if action=='assets-plan':return asset_plan()
    if action=='assets-publish':return asset_plan(True)
    if action=='assets-rollback':return release.remote('assets-rollback')
    if action=='code-prepare':return release.prepare()
    if action=='code-rollback':return release.remote('rollback')
    if action=='code-publish':
        candidate=release.prepare();staged=release.remote('stage '+candidate['version'],Path(candidate['archive']))
        return {**release.remote('activate '+candidate['version']),'staged':staged}
    if action=='cleanup-preview':
        result=release.cleanup_preview()
        (STATE/'cleanup-plan.json').write_text(json.dumps({'plan_token':result['plan_token']},ensure_ascii=False),encoding='utf-8')
        return result
    if action=='cleanup-apply':
        plan=STATE/'cleanup-plan.json'
        if not plan.exists():raise RuntimeError('请先预览清理范围')
        token=json.loads(plan.read_text(encoding='utf-8')).get('plan_token')
        result=release.cleanup_apply(token)
        plan.unlink(missing_ok=True)
        return result
    raise ValueError('Unknown operation')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['status','pc-configure','pc-start','pc-stop','assets-init','assets-plan','assets-publish','assets-rollback','code-prepare','code-publish','code-rollback','cleanup-preview','cleanup-apply'])
    try:
        action=parser.parse_args().action
        if action.startswith('pc-') and os.name=='nt':
            import msvcrt
            with (STATE/'pc-operation.lock').open('a+b') as lock:
                lock.seek(0);lock.write(b'\0');lock.flush();lock.seek(0)
                try:msvcrt.locking(lock.fileno(),msvcrt.LK_NBLCK,1)
                except OSError:raise RuntimeError('已有本机入口管理操作正在执行，请稍后刷新状态')
                result=perform(action)
        else:result=perform(action)
        print(json.dumps(result,ensure_ascii=False,indent=2))
    except Exception as error:
        if sys.stderr is not None:print(str(error),file=sys.stderr)
        sys.exit(1)
