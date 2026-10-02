# -*- coding: utf-8 -*-
"""网站管家 · Website Manager（西木会馆风格）

统一托管本机全部站点与 Cloudflare 隧道：

  · 「一键恢复全部」按站点清单逐个启动未运行的站点，并一并拉起主站与公网隧道
  · 端口被占用但页面不健康时只报告，绝不强制结束进程
  · 站点清单与 cloudflared config.yml 合并展示，清单未收录的域名标注「未配置启动方式」
  · 界面沿用「西木会馆 · Design System」的 --qc-* 设计 token（乳白宣纸 / 松绿 / 描金）
  · 零第三方依赖：仅 Python 标准库 + tkinter

用法：python website-manager.py            正常打开窗口
      python website-manager.py --smoke-test  自检（构建界面 + 状态扫描，不启动任何站点）
"""

import concurrent.futures
import datetime
import os
from pathlib import Path
import queue
import socket
import subprocess
import sys
import threading
import time
import tkinter as tk
from tkinter import font as tkfont
import traceback
import urllib.error
import urllib.request
import webbrowser

# ------------------------------------------------------------------ 路径与常量

HERE = Path(__file__).resolve().parent
LOGS = HERE / 'logs'
PYTHON = Path(r'C:\Users\hp\AppData\Local\Python\pythoncore-3.14-64\python.exe')
NODE = Path(r'C:\Program Files\nodejs\node.exe')
NPX_CMD = Path(r'C:\Program Files\nodejs\npx.cmd')
CMD = Path(os.environ.get('ComSpec', r'C:\Windows\System32\cmd.exe'))
POWERSHELL = (Path(os.environ.get('SystemRoot', r'C:\Windows'))
              / 'System32' / 'WindowsPowerShell' / 'v1.0' / 'powershell.exe')
CLOUDFLARED = Path(r'C:\Program Files (x86)\cloudflared\cloudflared.exe')
CONFIG = Path.home() / '.cloudflared' / 'config.yml'
PUBLIC_MAIN = 'https://iridescently.xyz/'
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))

# ------------------------------------------------------- 西木会馆 · Design Tokens
# 与 E:\Projects\portal\huiguan\design-system\design-system.css 的 :root 一一对应，
# 仅在此处做映射，界面代码不出现任何硬编码色值。
QC = {
    'bg': '#f5f0e8',       # --qc-bg     页面底 · 乳白宣纸
    'panel': '#fbf8f2',    # --qc-panel  卡片/面板底
    'border': '#d4cfbe',   # --qc-border 描边
    'text': '#3a4a3e',     # --qc-text   正文 · 墨绿
    'dim': '#7a8a7e',      # --qc-dim    次级文字
    'accent': '#5a9e8f',   # --qc-accent 主色 · 松绿
    'gold': '#d4a840',     # --qc-gold   点缀 · 描金
    'danger': '#b3543f',   # --qc-danger 警示 · 赭红
    'nav': '#222d26',      # --qc-nav-bg 深色导航
    'fs_xs': 10, 'fs_sm': 11, 'fs_md': 12, 'fs_base': 13, 'fs_lg': 15, 'fs_xl': 21,
    'r_sm': 4, 'r_md': 6, 'r_lg': 10, 'r_xl': 12,
}

WHITE = '#ffffff'


def blend(base, over, weight):
    """把 base 以 weight 权重叠在 over 上，等价于设计系统的半透明派生色（--qc-*-glow），
    使得透明色由 token 派生而非硬编码。"""
    def channels(value):
        value = value.lstrip('#')
        return [int(value[i:i + 2], 16) for i in (0, 2, 4)]
    first, second = channels(base), channels(over)
    return '#%02x%02x%02x' % tuple(
        max(0, min(255, round(a * weight + b * (1 - weight)))) for a, b in zip(first, second))


TONE = {
    'good': (QC['accent'], blend(QC['accent'], QC['panel'], 0.12)),
    'bad': (QC['danger'], blend(QC['danger'], QC['panel'], 0.12)),
    'warn': (QC['gold'], blend(QC['gold'], QC['panel'], 0.16)),
    'idle': (QC['dim'], blend(QC['dim'], QC['panel'], 0.12)),
}

# ------------------------------------------------------------------ 站点清单
# cwd 为项目目录；args 为启动参数；env 为追加环境变量；wait 为启动等待秒数。

VITE = 'node_modules/vite/bin/vite.js'

SITES = [
    dict(key='portal', name='统一门户 · 本地（Phase 1）', cwd=r'E:\Projects\server',
         domains=[], port=8080, runner='python', args=['-u', 'portal_server.py'], wait=30,
         note='统一入口：按 Host 分发 www/huiguan/oc；本地验证用，未接隧道'),
    dict(key='main', name='主站 · Iridescently', cwd=r'E:\Projects\portal\www',
         domains=['iridescently.xyz', 'www.iridescently.xyz'], port=8088,
         runner='python', args=['-u', 'server.py'], wait=25,
         note='其余站点的公共入口'),
    dict(key='huiguan', name='会馆 · 西木会馆', cwd=r'E:\Projects\portal\huiguan',
         domains=['huiguan.iridescently.xyz'], port=8089,
         runner='python', args=['-u', 'server_huiguan.py'], wait=25,
         note='被主站引用的公共模块目录'),
    dict(key='oc', name='三足乌·虹 · 人设站', cwd=r'E:\Projects\portal\oc',
         domains=['oc.iridescently.xyz'], port=8090,
         runner='python', args=['-u', 'server.py'], wait=25, note=''),
    dict(key='zszm', name='众生之门 · 前端', cwd=r'E:\Projects\server\app\src\cards',
         domains=['zszm.iridescently.xyz'], port=5173,
         runner='node',
         args=[VITE, '--host', '127.0.0.1', '--port', '5173', '--strictPort'], wait=45,
         note='Vite 开发服务器（源码已并入 server/app/src/cards）'),
    dict(key='zszm-oauth', name='众生之门 · OAuth 代理', cwd=r'E:\Projects\server\app\src\cards',
         domains=[], port=5174, runner='python', args=['-u', 'server.py'], wait=25,
         note='无独立域名，供 zszm 站内回调使用'),
    dict(key='game', name='旧卡牌入口 · 转向众生之门', cwd=r'E:\Projects\server\app\src\cards',
         domains=['game.iridescently.xyz'], port=5176, runner='node',
         args=['scripts/legacy-redirect.mjs'], wait=25,
         note='旧网址自动转向新版，不运行旧工程'),
    dict(key='juling', name='众生之门 · 聚灵', cwd=r'E:\Projects\server\app\src\juling',
         domains=['juling.iridescently.xyz'], port=5177, runner='node',
         args=['server.js'], env={'PORT': '5177'}, wait=25, note='Node 服务，端口取自 PORT 变量'),
    dict(key='softie', name='软乎乎 · 预览（统一入口 API 上游）', cwd=r'E:\Projects\server\app\src\softie-webgpu',
         domains=[], port=4173, runner='node',
         args=[VITE, 'preview', '--host', '127.0.0.1', '--port', '4173'], wait=25,
         note='供统一入口 /app/modules/softie/api 使用'),
    dict(key='lingjing', name='灵境 · 会馆', cwd=r'E:\Projects\server\app\src\management',
         domains=['lingjing.iridescently.xyz'], port=5179, runner='node',
         args=[VITE, '--host', '127.0.0.1', '--port', '5179', '--strictPort'], wait=45,
         note='Vite 开发服务器（源码已并入 server/app/src/management）'),
    dict(key='psyche', name='心理评估数据库平台 · psyche',
         cwd=r'E:\心理\心理评估数据库平台_v2',
         domains=['psyche.iridescently.xyz'], port=8000, runner='powershell',
         args=['-File', r'C:\Users\hp\marvis-services\start-psyche.ps1'], wait=90,
         note='Docker 方式启动，首次拉起引擎较慢'),
    dict(key='psy', name='psy · 未部署', cwd=None,
         domains=['psy.iridescently.xyz'], port=5000, deployed=False,
         note='本机暂未找到对应项目，清单中标注为未部署'),
]

TUNNEL_SITE = dict(key='tunnel', name='公网连接 · Cloudflare 隧道', kind='process',
                   cwd=str(HERE), runner='cloudflared', args=[], domains=[], wait=0,
                   note='把本机端口发布到 *.iridescently.xyz')

LOCK = threading.Lock()


# ------------------------------------------------------------------ 基础工具

def now_text():
    moment = datetime.datetime.now()
    return (f"{moment.year:04d}-{moment.month:02d}-{moment.day:02d} "
            f"{moment.hour:02d}:{moment.minute:02d}:{moment.second:02d}")


def clock_text():
    moment = datetime.datetime.now()
    return f"{moment.hour:02d}:{moment.minute:02d}:{moment.second:02d}"


def port_listening(port, timeout=0.5):
    try:
        with socket.create_connection(('127.0.0.1', int(port)), timeout=timeout):
            return True
    except OSError:
        return False


def http_status(url, timeout=5):
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with OPENER.open(request, timeout=timeout) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code
    except Exception:
        return None


def healthy(code):
    return code is not None and 200 <= code < 400


def local_url(site):
    return 'http://127.0.0.1:%d/' % site['port']


def public_url(site):
    if site.get('domains'):
        return 'https://' + site['domains'][0] + '/'
    return local_url(site)


def log_path(site):
    return LOGS / (site['key'] + '.log')


def tunnel_routes():
    """读取 cloudflared 配置中的 hostname → 本机服务 映射。"""
    result = []
    if not CONFIG.is_file():
        return result
    hostname = None
    for line in CONFIG.read_text(encoding='utf-8-sig').splitlines():
        stripped = line.strip().lstrip('- ').strip()
        if stripped.startswith('hostname:'):
            hostname = stripped.split(':', 1)[1].strip()
        elif hostname and stripped.startswith('service:'):
            service = stripped.split(':', 1)[1].strip()
            if service.startswith('http://'):
                result.append((hostname, service.replace('localhost', '127.0.0.1')))
            hostname = None
    return result


def tunnel_running():
    """返回 True / False；无法确认时返回 None。"""
    try:
        check = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq cloudflared.exe', '/FO', 'CSV', '/NH'],
                               capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
    except Exception:
        return None
    if check.returncode != 0:
        return None
    return b'cloudflared.exe' in check.stdout.lower()


def build_command(site):
    runner = site.get('runner')
    args = list(site.get('args') or [])
    if runner == 'python':
        exe = PYTHON if PYTHON.is_file() else Path(sys.executable)
        return [str(exe)] + args
    if runner == 'node':
        exe = NODE if NODE.is_file() else Path('node')
        return [str(exe)] + args
    if runner == 'npx':
        return [str(CMD), '/c', str(NPX_CMD)] + args
    if runner == 'powershell':
        return [str(POWERSHELL), '-NoProfile', '-ExecutionPolicy', 'Bypass'] + args
    if runner == 'cloudflared':
        return [str(CLOUDFLARED), 'tunnel', '--config', str(CONFIG), 'run']
    raise RuntimeError('未知的启动方式：%s' % runner)


def launch(site):
    """按站点清单启动进程；日志写入 logs/<key>.log。仅启动，不结束任何已有进程。"""
    LOGS.mkdir(parents=True, exist_ok=True)
    target = log_path(site)
    handle = target.open('ab')
    try:
        header = ('\n--- ' + now_text() + '  启动：' + ' '.join(build_command(site)) + ' ---\n')
        handle.write(header.encode('utf-8'))
        handle.flush()
        env = os.environ.copy()
        env.update(site.get('env') or {})
        cwd = site.get('cwd') or str(HERE)
        return subprocess.Popen(build_command(site), cwd=cwd, env=env,
                                stdin=subprocess.DEVNULL, stdout=handle, stderr=handle,
                                creationflags=subprocess.CREATE_NO_WINDOW)
    finally:
        handle.close()


def entry_missing(site):
    """Python 站点检查入口脚本是否存在。"""
    if site.get('runner') != 'python':
        return None
    script = Path(site['cwd']) / site['args'][-1]
    return None if script.is_file() else str(script)


# ------------------------------------------------------------------ 状态检测

def evaluate(site):
    """只读检测单个站点，返回 (level, 文本)。不启动、不结束任何进程。"""
    if site.get('kind') == 'process':
        state = tunnel_running()
        if state is None:
            return 'warn', '无法确认进程状态'
        return ('good', '进程运行中') if state else ('bad', '进程未运行')
    if not site.get('deployed', True):
        return 'warn', '未部署 · 本机暂无对应项目'
    port = site['port']
    if not port_listening(port):
        return 'bad', '未监听 · 未启动'
    code = http_status(local_url(site))
    if healthy(code):
        return 'good', '正常 · HTTP %d' % code
    if code is None:
        return 'bad', '端口占用 · 无响应（未强制结束进程）'
    return 'bad', '端口占用 · HTTP %d（未强制结束进程）' % code


def inspect_all(include_public=True):
    targets = SITES + [TUNNEL_SITE]

    def probe(site):
        return site['key'], evaluate(site)

    result = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        for key, value in pool.map(probe, targets):
            result[key] = value
    if include_public:
        result['public'] = http_status(PUBLIC_MAIN, timeout=6)
    return result


# ------------------------------------------------------------------ 启动逻辑

def recover_site(site, report, quiet=False):
    """启动单个站点。返回 True（可用）/ False（异常）/ None（跳过）。"""
    if site.get('kind') == 'process':
        state = tunnel_running()
        if state is None:
            report('「公网连接」无法确认进程状态，请检查任务管理器。', 'warn')
            return False
        if state:
            if not quiet:
                report('「公网连接」已在运行，无需重复启动。')
            return True
        if not CLOUDFLARED.is_file():
            report('找不到 cloudflared 程序：%s' % CLOUDFLARED, 'bad')
            return False
        launch(site)
        report('「公网连接」已启动，可能需要数秒完成连接。')
        return True

    if not site.get('deployed', True):
        if not quiet:
            report('跳过「%s」：%s' % (site['name'], site.get('note') or '未部署'), 'warn')
        return None

    port = site['port']
    if port_listening(port):
        code = http_status(local_url(site))
        if healthy(code):
            if not quiet:
                report('「%s」已在运行（HTTP %d），无需重复启动。' % (site['name'], code))
            return True
        report('「%s」端口 %d 已被占用但页面不健康（%s）；按安全策略不强制结束进程，'
               '请点该行「查看日志」。' % (site['name'], port,
                                          'HTTP %s' % code if code else '无响应'),
               'bad')
        return False

    cwd = site.get('cwd')
    if not cwd or not Path(cwd).is_dir():
        report('「%s」项目目录不存在：%s' % (site['name'], cwd), 'bad')
        return False
    missing = entry_missing(site)
    if missing:
        report('「%s」找不到入口脚本：%s' % (site['name'], missing), 'bad')
        return False

    try:
        child = launch(site)
    except Exception as error:
        report('「%s」启动失败：%s' % (site['name'], error), 'bad')
        return False

    deadline = time.time() + int(site.get('wait', 30))
    while time.time() < deadline:
        if port_listening(port):
            break
        if child.poll() is not None:
            report('「%s」进程已退出；请点该行「查看日志」查看原因。' % site['name'], 'bad')
            return False
        time.sleep(0.4)

    code = http_status(local_url(site))
    if healthy(code):
        if site.get('domains'):
            report('「%s」已启动 · 本机 HTTP %d · %s' % (site['name'], code, public_url(site)))
        else:
            report('「%s」已启动 · 本机 HTTP %d' % (site['name'], code))
        return True
    report('「%s」已启动但页面未就绪（%s），请点该行「查看日志」。'
           % (site['name'], 'HTTP %s' % code if code else '端口无响应'), 'bad')
    return False


def recover_all(report, quiet=False):
    """一键恢复全部：逐个启动未运行的站点，并拉起主站与公网隧道。"""
    with LOCK:
        report('开始一键恢复全部：共 %d 个站点 + 公网隧道。' % len(SITES))
        results = {}
        for site in SITES:
            try:
                results[site['key']] = recover_site(site, report, quiet)
            except Exception as error:
                report('「%s」检测异常：%s' % (site['name'], error), 'bad')
                results[site['key']] = False
        try:
            results['tunnel'] = recover_site(TUNNEL_SITE, report, quiet)
        except Exception as error:
            report('「公网连接」检测异常：%s' % error, 'bad')
            results['tunnel'] = False
        ok = sum(1 for value in results.values() if value is True)
        bad = sum(1 for value in results.values() if value is False)
        skipped = sum(1 for value in results.values() if value is None)
        report('一键恢复完成：可用 %d · 异常 %d · 跳过 %d。' % (ok, bad, skipped),
               'bad' if bad else 'good')
        return results


# ------------------------------------------------------------------ 界面组件

class QcButton(tk.Label):
    """对应设计系统 .qc-btn：primary / ghost / gold / gold-ghost / danger。"""

    PALETTE = {
        'primary': (QC['accent'], WHITE, QC['accent']),
        'ghost': (QC['panel'], QC['accent'], QC['accent']),
        'gold': (QC['gold'], WHITE, QC['gold']),
        'gold-ghost': (QC['panel'], QC['gold'], QC['gold']),
        'danger': (QC['danger'], WHITE, QC['danger']),
    }

    def __init__(self, master, text, command=None, variant='primary', small=True):
        background, foreground, border = self.PALETTE[variant]
        self.base_bg = background
        self.hover_bg = (blend(WHITE, background, 0.12) if variant in ('primary', 'gold', 'danger')
                         else blend(foreground, QC['panel'], 0.12))
        super().__init__(master, text=text, bg=background, fg=foreground, cursor='hand2',
                         font=(TEXT_FONT, QC['fs_sm']),
                         padx=9 if small else 16, pady=3 if small else 7,
                         highlightthickness=1, highlightbackground=border, highlightcolor=border)
        self.command = command
        self.enabled = command is not None
        self.bind('<Enter>', self.on_enter)
        self.bind('<Leave>', self.on_leave)
        self.bind('<Button-1>', self.on_click)
        if not self.enabled:
            self.base_bg = QC['panel']
            self.configure(fg=QC['dim'], cursor='arrow',
                           highlightbackground=QC['border'], bg=QC['panel'])

    def on_enter(self, _event=None):
        if self.enabled:
            self.configure(bg=self.hover_bg)

    def on_leave(self, _event=None):
        if self.enabled:
            self.configure(bg=self.base_bg)

    def on_click(self, _event=None):
        if self.enabled and self.command:
            self.command()


class SiteRow:
    """表格中的一行：站点 / 本机地址 / 状态 / 操作。"""

    WIDTHS = (336, 176, 214, 268)

    def __init__(self, parent, site, app, kind='site'):
        self.site = site
        self.app = app
        self.kind = kind
        self.card = tk.Frame(parent, bg=QC['panel'], bd=0,
                             highlightbackground=QC['border'], highlightthickness=1)
        self.card.pack(fill='x', pady=(0, 6))
        body = tk.Frame(self.card, bg=QC['panel'])
        body.pack(fill='x', padx=15, pady=11)
        first, second, third, fourth = self.WIDTHS
        body.grid_columnconfigure(0, minsize=first)
        body.grid_columnconfigure(1, minsize=second)
        body.grid_columnconfigure(2, minsize=third)
        body.grid_columnconfigure(3, minsize=fourth)

        # 第 1 列：站点名 + 域名
        name_box = tk.Frame(body, bg=QC['panel'])
        name_box.grid(row=0, column=0, sticky='w')
        tk.Label(name_box, text=site['name'], bg=QC['panel'], fg=QC['text'],
                 font=(HAND_FONT, QC['fs_base'], 'bold'), anchor='w').pack(anchor='w')
        if site.get('domains'):
            domain_text = ' / '.join(site['domains'])
        elif kind == 'tunnel':
            domain_text = 'cloudflared tunnel run'
        else:
            domain_text = '无独立域名'
        tk.Label(name_box, text=domain_text, bg=QC['panel'], fg=QC['dim'],
                 font=(TEXT_FONT, QC['fs_xs']), anchor='w').pack(anchor='w', pady=(2, 0))

        # 第 2 列：本机地址
        if site.get('port'):
            address = local_url(site)
        elif kind == 'tunnel':
            address = 'tunnel: 4c3072da…c51dc05'
        else:
            address = '—'
        tk.Label(body, text=address, bg=QC['panel'], fg=QC['dim'], anchor='w',
                 font=(TEXT_FONT, QC['fs_sm'])).grid(row=0, column=1, sticky='w')

        # 第 3 列：状态徽标
        self.badge = tk.Label(body, text='检测中…', bg=TONE['idle'][1], fg=TONE['idle'][0],
                              font=(TEXT_FONT, QC['fs_xs']), padx=8, pady=3)
        self.badge.grid(row=0, column=2, sticky='w')

        # 第 4 列：操作
        actions = tk.Frame(body, bg=QC['panel'])
        actions.grid(row=0, column=3, sticky='e')
        if kind == 'extra':
            QcButton(actions, '打开站点', lambda: webbrowser.open('https://' + site['domains'][0] + '/')).pack(side='left', padx=(0, 6))
            QcButton(actions, '打开目录').pack(side='left', padx=(0, 6))
            QcButton(actions, '查看日志').pack(side='left')
        elif kind == 'tunnel':
            QcButton(actions, '打开站点').pack(side='left', padx=(0, 6))
            QcButton(actions, '打开目录').pack(side='left', padx=(0, 6))
            QcButton(actions, '查看日志', lambda: app.open_log(site)).pack(side='left')
        else:
            QcButton(actions, '打开站点', lambda: app.open_site(site)).pack(side='left', padx=(0, 6))
            open_dir = (lambda: app.open_dir(site)) if site.get('cwd') else None
            QcButton(actions, '打开目录', open_dir).pack(side='left', padx=(0, 6))
            QcButton(actions, '查看日志', lambda: app.open_log(site)).pack(side='left')

        if site.get('note'):
            tk.Label(body, text=site['note'], bg=QC['panel'], fg=QC['dim'], anchor='w',
                     font=(TEXT_FONT, QC['fs_xs'])).grid(row=1, column=0, columnspan=4,
                                                         sticky='w', pady=(6, 0))

    def set_status(self, level, text):
        foreground, background = TONE[level]
        self.badge.configure(text=text, fg=foreground, bg=background)

    def children(self):
        return walk_widgets(self.card)


def walk_widgets(widget):
    result = [widget]
    for child in widget.winfo_children():
        result.extend(walk_widgets(child))
    return result


# ------------------------------------------------------------------ 主窗口

class App:
    def __init__(self, root):
        self.root = root
        self.events = queue.Queue()
        self.busy = False
        self.rows = []
        self.extra_rows = []
        self.states = {}
        self.public_status = None
        self.pending_refresh = False

        root.title('Iridescently · 网站管家')
        root.geometry('1220x860')
        root.minsize(1080, 740)
        root.configure(bg=QC['bg'])
        self.log_seen = False

        outer = tk.Frame(root, bg=QC['bg'])
        outer.pack(fill='both', expand=True, padx=24, pady=20)

        # 标题区
        header = tk.Frame(outer, bg=QC['bg'])
        header.pack(fill='x')
        tk.Label(header, text='网站管家', bg=QC['bg'], fg=QC['text'],
                 font=(HAND_FONT, QC['fs_xl'], 'bold')).pack(side='left')
        tk.Label(header, text='西木会馆 · Design System', bg=QC['bg'], fg=QC['gold'],
                 font=(TEXT_FONT, QC['fs_sm'])).pack(side='left', padx=(10, 0), pady=(8, 0))
        tk.Label(header, text='本机 %d 个站点  →  公网隧道  →  你的域名' % len(SITES),
                 bg=QC['bg'], fg=QC['dim'], font=(TEXT_FONT, QC['fs_sm'])).pack(side='right', pady=(8, 0))

        # 概览行
        summary_box = tk.Frame(outer, bg=QC['bg'])
        summary_box.pack(fill='x', pady=(14, 0))
        self.summary = tk.StringVar(value='正在检查站点状态…')
        tk.Label(summary_box, textvariable=self.summary, bg=QC['bg'], fg=QC['text'],
                 font=(TEXT_FONT, QC['fs_lg'], 'bold')).pack(side='left')
        self.clock = tk.StringVar(value='')
        tk.Label(summary_box, textvariable=self.clock, bg=QC['bg'], fg=QC['dim'],
                 font=(TEXT_FONT, QC['fs_sm'])).pack(side='right')

        # 工具条
        toolbar = tk.Frame(outer, bg=QC['bg'])
        toolbar.pack(fill='x', pady=(12, 14))
        QcButton(toolbar, '一键恢复全部', self.recover_all, variant='primary', small=False).pack(side='left', padx=(0, 8))
        QcButton(toolbar, '刷新状态', self.refresh, variant='ghost', small=False).pack(side='left', padx=(0, 8))
        QcButton(toolbar, '打开主站', lambda: webbrowser.open(PUBLIC_MAIN), variant='ghost', small=False).pack(side='left', padx=(0, 8))
        QcButton(toolbar, '打开日志目录', self.open_logs_dir, variant='ghost', small=False).pack(side='left')
        self.watch = tk.BooleanVar(value=False)
        tk.Checkbutton(toolbar, text='窗口开启时自动照看（每 30 秒；仅启动端口空闲的站点，不结束任何进程）',
                       variable=self.watch, bg=QC['bg'], fg=QC['text'], activebackground=QC['bg'],
                       activeforeground=QC['text'], selectcolor=QC['panel'], bd=0,
                       highlightthickness=0, font=(TEXT_FONT, QC['fs_sm']),
                       cursor='hand2').pack(side='right')

        # 表头
        head = tk.Frame(outer, bg=QC['bg'])
        head.pack(fill='x', padx=16)
        for index, (title, width) in enumerate(zip(('站点 / 域名', '本机地址', '本机检测结果', '操作'),
                                                   SiteRow.WIDTHS)):
            head.grid_columnconfigure(index, minsize=width)
            tk.Label(head, text=title, bg=QC['bg'], fg=QC['dim'], anchor='w',
                     font=(TEXT_FONT, QC['fs_xs'])).grid(row=0, column=index, sticky='w')
        tk.Frame(outer, bg=QC['border'], height=1).pack(fill='x', pady=(4, 8))

        # 站点表格（可滚动）
        body = tk.Frame(outer, bg=QC['bg'])
        body.pack(fill='both', expand=True)
        self.canvas = tk.Canvas(body, bg=QC['bg'], highlightthickness=0, bd=0)
        scrollbar = tk.Scrollbar(body, orient='vertical', command=self.canvas.yview)
        self.canvas.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side='right', fill='y')
        self.canvas.pack(side='left', fill='both', expand=True)
        self.list_frame = tk.Frame(self.canvas, bg=QC['bg'])
        self.window = self.canvas.create_window((0, 0), window=self.list_frame, anchor='nw')
        self.list_frame.bind('<Configure>',
                             lambda event: self.canvas.configure(scrollregion=self.canvas.bbox('all')))
        self.canvas.bind('<Configure>',
                         lambda event: self.canvas.itemconfigure(self.window, width=event.width))

        for site in SITES:
            self.rows.append(SiteRow(self.list_frame, site, self))
        self.rows.append(SiteRow(self.list_frame, TUNNEL_SITE, self, kind='tunnel'))

        # 未纳入清单的域名
        covered = {domain for site in SITES for domain in site.get('domains', [])}
        extras = [host for host, _ in tunnel_routes() if host not in covered]
        if extras:
            tk.Label(self.list_frame, text='未配置启动方式（cloudflared 配置中存在，但不在站点清单中）',
                     bg=QC['bg'], fg=QC['gold'], anchor='w',
                     font=(TEXT_FONT, QC['fs_sm'])).pack(fill='x', pady=(10, 6))
            for host in extras:
                extra = SiteRow(self.list_frame, dict(key='extra-' + host, name=host,
                                                      domains=[host], port=None, note='未配置启动方式'),
                                self, kind='extra')
                extra.set_status('warn', '未配置启动方式')
                self.extra_rows.append(extra)

        for widget in walk_widgets(self.canvas):
            widget.bind('<MouseWheel>', self.on_wheel, add='+')

        # 日志面板
        panel = tk.Frame(outer, bg=QC['panel'], highlightbackground=QC['border'], highlightthickness=1)
        panel.pack(fill='x', pady=(12, 0))
        tk.Label(panel, text='运行记录', bg=QC['panel'], fg=QC['text'],
                 font=(HAND_FONT, QC['fs_md'], 'bold')).pack(anchor='w', padx=12, pady=(9, 0))
        self.text = tk.Text(panel, height=6, bg=QC['panel'], fg=QC['text'], relief='flat',
                            font=(TEXT_FONT, QC['fs_sm']), padx=4, pady=4, wrap='word',
                            highlightthickness=0, state='disabled')
        self.text.pack(fill='x', padx=12, pady=(2, 10))

        tips = tk.Frame(outer, bg=QC['bg'])
        tips.pack(fill='x', pady=(8, 0))
        tk.Label(tips, text='安全策略：端口被占用但页面不健康时只报告，绝不强制结束进程；'
                            '关闭窗口不会关闭任何网站。',
                 bg=QC['bg'], fg=QC['dim'], font=(TEXT_FONT, QC['fs_xs'])).pack(anchor='w')
        tk.Label(tips, text='电脑关机、休眠或断网将导致域名无法访问；重启后回到本窗口点「一键恢复全部」即可。',
                 bg=QC['bg'], fg=QC['dim'], font=(TEXT_FONT, QC['fs_xs'])).pack(anchor='w', pady=(2, 0))

        self.write('站点清单已加载：%d 个站点 + 公网隧道；日志目录 %s' % (len(SITES), LOGS))
        self.write('「一键恢复全部」会按顺序启动未运行的站点；已在运行的站点不会重复启动。')
        root.after(100, self.drain)
        root.after(200, self.refresh)
        root.after(30000, self.tick)

    # -------------------------------------------------- 界面动作
    def on_wheel(self, event):
        self.canvas.yview_scroll(-1 if event.delta > 0 else 1, 'units')

    def write(self, message, level=None):
        prefix = {'bad': '注意  ', 'warn': '提示  ', 'good': '完成  '}.get(level or '', '')
        self.text.configure(state='normal')
        self.text.insert('end', clock_text() + '  ' + prefix + message + '\n')
        self.text.see('end')
        self.text.configure(state='disabled')

    def open_site(self, site):
        target = public_url(site)
        webbrowser.open(target)
        self.write('已在浏览器打开「%s」：%s' % (site['name'], target))

    def open_dir(self, site):
        cwd = site.get('cwd')
        if cwd and Path(cwd).is_dir():
            os.startfile(str(cwd))
            self.write('已打开项目目录：%s' % cwd)
        else:
            self.write('「%s」没有可打开的项目目录。' % site['name'], 'warn')

    def open_log(self, site):
        LOGS.mkdir(parents=True, exist_ok=True)
        target = log_path(site)
        if target.is_file():
            os.startfile(str(target))
            self.write('已打开日志：%s' % target)
        else:
            self.write('「%s」暂无日志文件，已打开日志目录。' % site['name'], 'warn')
            os.startfile(str(LOGS))

    def open_logs_dir(self):
        LOGS.mkdir(parents=True, exist_ok=True)
        os.startfile(str(LOGS))
        self.write('已打开日志目录：%s' % LOGS)

    # -------------------------------------------------- 后台任务
    def work(self, function, kind):
        if self.busy:
            self.write('上一次检查尚未结束，请稍候。', 'warn')
            return
        self.busy = True

        def run():
            try:
                self.events.put((kind, function()))
            except Exception as error:
                self.events.put(('error', str(error)))
            finally:
                self.events.put(('idle', None))

        threading.Thread(target=run, daemon=True).start()

    def refresh(self):
        self.work(lambda: inspect_all(True), 'status')

    def recover_all(self):
        if self.busy:
            self.write('上一次检查尚未结束，请稍候。', 'warn')
            return

        def report(message, level=None):
            self.events.put(('log', (message, level)))

        def task():
            return recover_all(report)

        self.busy = True
        self.write('开始一键恢复全部……')

        def run():
            try:
                self.events.put(('recovered', task()))
            except Exception as error:
                self.events.put(('error', str(error)))
            finally:
                self.events.put(('idle', None))

        threading.Thread(target=run, daemon=True).start()

    def tick(self):
        if not self.busy:
            if self.watch.get():
                self.auto_care()
            else:
                self.refresh()
        self.root.after(30000, self.tick)

    def auto_care(self):
        def report(message, level=None):
            self.events.put(('log', (message, level)))

        def task():
            recover_all(report, quiet=True)
            return inspect_all(False)

        self.busy = True

        def run():
            try:
                self.events.put(('status', task()))
            except Exception as error:
                self.events.put(('error', str(error)))
            finally:
                self.events.put(('idle', None))

        threading.Thread(target=run, daemon=True).start()

    # -------------------------------------------------- 事件循环
    def drain(self):
        try:
            while True:
                kind, value = self.events.get_nowait()
                if kind == 'status':
                    self.apply_states(value)
                elif kind == 'log':
                    message, level = value
                    self.write(message, level)
                elif kind == 'recovered':
                    self.pending_refresh = True
                elif kind == 'idle':
                    self.busy = False
                    if self.pending_refresh:
                        self.pending_refresh = False
                        self.root.after(150, self.refresh)
                else:
                    self.write(('错误：' if kind == 'error' else '') + str(value), 'bad')
        except queue.Empty:
            pass
        self.root.after(100, self.drain)

    def apply_states(self, states):
        self.states = states
        for row in self.rows:
            key = row.site['key']
            if key in states:
                row.set_status(*states[key])
        total = len(SITES)
        good = bad = pending = 0
        for site in SITES:
            level = states.get(site['key'], ('idle', ''))[0]
            if level == 'good':
                good += 1
            elif level == 'bad':
                bad += 1
            else:
                pending += 1
        tunnel = states.get('tunnel')
        tunnel_text = '运行中' if tunnel and tunnel[0] == 'good' else ('未运行' if tunnel else '—')
        public = states.get('public')
        if public is None:
            public_text = '公网主站：未检测'
        elif public == 200:
            public_text = '公网主站：HTTP 200'
        else:
            public_text = '公网主站：HTTP %s' % public
        summary = ('站点 %d：正常 %d · 异常 %d · 未部署 %d    隧道：%s    %s'
                   % (total, good, bad, pending, tunnel_text, public_text))
        if self.extra_rows:
            summary += '    未配置域名 %d' % len(self.extra_rows)
        self.summary.set(summary)
        self.clock.set(clock_text())

    # -------------------------------------------------- 自检
    def smoke_test(self):
        self.root.update_idletasks()
        self.root.update()
        states = inspect_all(include_public=False)
        self.apply_states(states)
        self.root.update_idletasks()
        self.root.update()
        widgets = len(walk_widgets(self.root))
        rows = len(self.rows) + len(self.extra_rows)
        good = sum(1 for site in SITES if states.get(site['key'], ('idle',))[0] == 'good')
        bad = sum(1 for site in SITES if states.get(site['key'], ('idle',))[0] == 'bad')
        print('[smoke-test] 界面构建成功：控件 %d 个，表格行 %d 行（含未配置域名 %d）'
              % (widgets, rows, len(self.extra_rows)))
        print('[smoke-test] 字体：正文 %s / 标题 %s' % (TEXT_FONT, HAND_FONT))
        print('[smoke-test] 站点状态扫描完成：正常 %d · 异常 %d · 未部署 %d（未启动任何进程）'
              % (good, bad, len(SITES) - good - bad))
        for site in SITES:
            level, text = states.get(site['key'], ('idle', '未检测'))
            print('[smoke-test]   [%s] %-26s 端口 %-5s %s'
                  % (level, site['name'], site.get('port') or '—', text))
        level, text = states.get('tunnel', ('idle', '未检测'))
        print('[smoke-test]   [%s] %-26s 端口 %-5s %s' % (level, TUNNEL_SITE['name'], '—', text))


# ------------------------------------------------------------------ 入口

def main():
    smoke = '--smoke-test' in sys.argv
    root = tk.Tk()
    global TEXT_FONT, HAND_FONT
    TEXT_FONT = pick_font('Noto Serif SC', 'Source Han Serif SC', 'LXGW WenKai', 'Microsoft YaHei UI')
    HAND_FONT = pick_font('LXGW WenKai', 'Noto Serif SC', 'Microsoft YaHei UI')
    app = App(root)
    if smoke:
        code = 0
        try:
            app.smoke_test()
            print('[smoke-test] OK：脚本正常启动，界面无异常退出。')
        except Exception:
            traceback.print_exc()
            print('[smoke-test] FAILED：自检过程中出现异常。')
            code = 1
        root.destroy()
        return code
    root.mainloop()
    return 0


def pick_font(*candidates):
    try:
        available = set(tkfont.families())
    except Exception:
        available = set()
    for name in candidates:
        if name in available:
            return name
    return 'Microsoft YaHei UI'


TEXT_FONT = 'Microsoft YaHei UI'
HAND_FONT = 'Microsoft YaHei UI'

if __name__ == '__main__':
    sys.exit(main())
