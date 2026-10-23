"""Independent desktop control for PC preview, HK code and reference assets."""
import importlib.util
import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import threading
import tkinter as tk
from tkinter import messagebox
import webbrowser

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('site_manager_style',HERE/'网站恢复/website-manager.py')
style=importlib.util.module_from_spec(spec);spec.loader.exec_module(style)
control_spec=importlib.util.spec_from_file_location('server_control',HERE/'server-control.py')
control=importlib.util.module_from_spec(control_spec);control_spec.loader.exec_module(control)

class App:
    def __init__(self,root):
        self.root=root;self.busy=False;self.events=queue.Queue()
        root.title('Iridescently · 服务器管家');root.geometry('1120x800');root.minsize(920,700);root.configure(bg=style.QC['bg'])
        outer=tk.Frame(root,bg=style.QC['bg']);outer.pack(fill='both',expand=True,padx=24,pady=20)
        tk.Label(outer,text='服务器管家',bg=style.QC['bg'],fg=style.QC['text'],font=(style.TEXT_FONT,22,'bold')).pack(anchor='w')
        tk.Label(outer,text='两种代码版本 · 香港统一账户与存档 · 资产独立更新',bg=style.QC['bg'],fg=style.QC['dim'],font=(style.TEXT_FONT,12)).pack(anchor='w',pady=8)
        self.status=tk.StringVar(value='正在检查两台服务器…')
        tk.Label(outer,textvariable=self.status,bg=style.QC['bg'],fg=style.QC['text'],font=(style.TEXT_FONT,12),wraplength=1040,justify='left').pack(anchor='w',pady=8)
        self.section(outer,'服务器 1 · 本机新版','页面与已有构建产物即时取本机；API、房间、账户和存档转到香港。关机或网络中断时，选择稳定版。',[
            ('启用本机新版并登录自启','pc-start'),('停止本机新版并取消自启','pc-stop'),('配置本机入口','pc-configure')])
        self.section(outer,'服务器 2 · 香港稳定版 / 代码更新','先完成本地构建和本地发布；此处只发布程序，不改资产库、账户或存档。',[
            ('预览代码包','code-prepare'),('发布香港代码','code-publish'),('回滚香港代码','code-rollback')])
        self.section(outer,'香港服务器缓存与旧版本清理','先预览清理范围；仅针对专用 npm 缓存、很旧的失败 release 和早于 current/previous 的旧 release。current、previous、运行中版本及用户数据会保留。',[
            ('预览清理范围','cleanup-preview'),('确认并清理','cleanup-apply')])
        self.section(outer,'独立资产库更新','先下载香港基线，在编辑副本修改资料/媒体，预览增量，再发布。遇到线上并发改动会停止。',[
            ('下载资产编辑副本','assets-init'),('预览资产更新','assets-plan'),('发布资产更新','assets-publish'),('回滚上次资产更新','assets-rollback')])
        bar=tk.Frame(outer,bg=style.QC['bg']);bar.pack(fill='x',pady=10)
        for text,fn in [('刷新两服状态',lambda:self.run('status')),('打开玩家选服页',lambda:webbrowser.open('https://zszm.iridescently.xyz/__server/select')),('打开资产工作目录',self.open_workspace),('README',lambda:os.startfile(str(HERE/'服务器管家/README.md')))]:
            style.QcButton(bar,text,fn,variant='ghost').pack(side='left',padx=(0,8))
        self.log=tk.Text(outer,height=13,wrap='word',font=(style.TEXT_FONT,11),bg=style.QC['panel'],fg=style.QC['text']);self.log.pack(fill='both',expand=True)
        self.write('代码发布和资产更新互不替代。香港是唯一玩家数据源；本机不是第二份可写数据库。')
        root.after(100,self.drain);root.after(200,lambda:self.run('status'))

    def section(self,parent,title,description,actions):
        frame=tk.LabelFrame(parent,text=title,bg=style.QC['panel'],fg=style.QC['text'],font=(style.TEXT_FONT,13,'bold'),padx=14,pady=9);frame.pack(fill='x',pady=7)
        tk.Label(frame,text=description,bg=style.QC['panel'],fg=style.QC['dim'],font=(style.TEXT_FONT,11),wraplength=1000,justify='left').pack(anchor='w')
        buttons=tk.Frame(frame,bg=style.QC['panel']);buttons.pack(anchor='w',pady=(8,0))
        for text,action in actions:
            callback=self.confirm_cleanup if action=='cleanup-apply' else lambda a=action:self.run(a)
            style.QcButton(buttons,text,callback,variant='ghost' if 'rollback' in action or action=='cleanup-apply' else 'primary').pack(side='left',padx=(0,10))

    def write(self,text):self.log.insert('end',text+'\n');self.log.see('end')
    def open_workspace(self):
        try:os.startfile(str(control.workspace()))
        except Exception as error:self.write(str(error))
    def run(self,action):
        if self.busy:self.write('上一个操作尚未结束，请稍候。');return
        self.busy=True;self.write('执行：'+action)
        def worker():
            try:
                result=subprocess.run([str(control.PYTHON),'-X','utf8',str(HERE/'server-control.py'),action],capture_output=True,encoding='utf-8',errors='replace',creationflags=control.NO_WINDOW)
                if result.returncode:raise RuntimeError(result.stderr.strip() or result.stdout.strip())
                # Configuration may also print narrow DNS update summaries before its final JSON.
                decoder=json.JSONDecoder();text=result.stdout.strip();last=None
                while text:
                    last,index=decoder.raw_decode(text);text=text[index:].lstrip()
                self.events.put(('result',last))
                if action!='status':
                    try:self.events.put(('result',control.perform('status')))
                    except Exception as error:self.events.put(('error','操作完成，刷新状态失败：'+str(error)))
            except Exception as error:self.events.put(('error',str(error)))
            finally:self.events.put(('idle',None))
        threading.Thread(target=worker,daemon=True).start()

    def confirm_cleanup(self):
        plan=control.STATE/'cleanup-plan.json'
        if not plan.exists():
            messagebox.showinfo('需要先预览','请先点击“预览清理范围”，确认候选 release 和缓存大小。',parent=self.root);return
        if messagebox.askyesno('确认清理香港服务器','将重新核对预览状态，并只删除预览列出的旧/失败 release 与专用 npm 缓存。current、previous、运行中版本和用户数据会保留。继续吗？',parent=self.root):
            self.run('cleanup-apply')
    def drain(self):
        try:
            while True:
                kind,value=self.events.get_nowait()
                if kind=='idle':self.busy=False
                elif kind=='error':self.write('操作失败：'+value)
                else:
                    self.write(json.dumps(value,ensure_ascii=False,indent=2))
                    if 'hong_kong' in value:
                        hk=value['hong_kong'];pc=value['pc']
                        self.status.set('香港：'+hk['current']+'，服务 '+str(sum(v=='active' for v in hk['services'].values()))+'/5；本机网关：'+('运行' if pc['gateway'] else '停止')+'；本机隧道：'+str(pc.get('connections',0))+' 条边缘连接')
        except queue.Empty:pass
        self.root.after(100,self.drain)

if __name__=='__main__':
    root=tk.Tk();app=App(root)
    if '--smoke-test' in sys.argv:
        root.withdraw();root.update();print(json.dumps({'ok':True,'buttons':[w.cget('text') for w in style.walk_widgets(root) if isinstance(w,style.QcButton)]},ensure_ascii=False));root.destroy()
    else:root.mainloop()
