"""盘点八个游戏模块：各自怎么构建、有哪些测试、实际跑了什么。

默认只读：盘点模式只读 ``package.json``、测试文件和模块目录，不执行任何命令，也不写文件。
``--run`` 用一次性临时存储根执行项目自己的构建与测试命令，因此基线不会读写 development 或
生产数据。``--serve`` 再把构建产物按门户自己的路径挂到回环端口，逐个抓取模块入口。

状态沿用 Issue 要求的四个值，含义就是：

``PASS``    命令退出码 0；或入口页面与它引用的资源全部返回 200。
``FAIL``    命令退出码非 0、超过单命令时限被终止；或引用的资源缺失。
``SKIP``    检查不适用或当前无法运行（无 test 脚本、依赖未安装、没有构建产物）。跳过不计为通过。
``NOT RUN`` 本轮没有尝试执行，也是盘点模式的默认值。

``--run`` 的每条命令（聚合构建、各模块测试、附加检查）都有 ``COMMAND_TIMEOUT`` 秒上限：超时
会终止 npm 及其派生的整棵进程树，记 FAIL 并在结果里带 ``timeout`` 字段，与「测试失败」分开，
避免一个卡住的模块让基线命令永远不退出。整轮还有 ``TOTAL_TIMEOUT`` 秒墙钟预算：每条命令的
上限会被剩余预算压低（所以 ``--command-timeout`` 大于 ``--total-timeout`` 是合法配置，不是
错误）；用尽后不再启动新命令，剩余检查保持 NOT RUN，整轮以非 0 退出，避免「跑完了」和
「没跑完」看起来一样。两个上限都可以在命令行覆盖（``--command-timeout`` / ``--total-timeout``，
单位秒）。

DSH 受限沙箱无法派发 Node 测试工作进程或浏览器进程，``--run`` 与 ``--serve`` 请在普通终端或
CI 任务里运行。

用法::

    python tools/checks/module_baseline.py                       # 只盘点（Markdown）
    python tools/checks/module_baseline.py --run                 # 构建 + 单元测试
    python tools/checks/module_baseline.py --run --serve          # 再探测各模块入口
    python tools/checks/module_baseline.py --run --command-timeout 300 --total-timeout 600
    python tools/checks/module_baseline.py --json out.json --markdown out.md
"""
import argparse
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[2]
PASS, FAIL, SKIP, NOT_RUN = "PASS", "FAIL", "SKIP", "NOT RUN"

# 单条命令的上限。AEON 的 headless 用例本机约 124 秒，600 秒留足余量；卡住的模块会被终止并
# 记为带 ``timeout`` 标记的 FAIL，基线不会因为一条命令挂死而一直不退出。
COMMAND_TIMEOUT = 600
KILL_TIMEOUT = 10

# 整轮 ``--run`` 的墙钟预算：10 条命令各自 600 秒的最坏情况是 100 分钟，正常一轮约 5 分钟。
# 预算用尽后不再启动新命令，剩余检查保持 NOT RUN，整轮以非 0 退出：不能让「跑完了」和
# 「没跑完」在报表上看起来一样。
TOTAL_TIMEOUT = 1800

# 聚合构建是门户实际发布的唯一产物来源；juling、aeon、slay 没有独立构建步骤，所以它们的
# 构建状态取自同一次运行。启动器只解析一次：Windows 的 CreateProcess 不会为 "npm" 搜索 PATHEXT。
NODE = shutil.which("node") or "node"
NPM = shutil.which("npm") or "npm"
AGGREGATE_BUILD = [NODE, "tools/build/build-modules.mjs"]

MODULES = (
    {
        "key": "cards",
        "name": "众生之门 · 卡牌",
        "build_script": "build",
        "test_script": "test",
        "extra_scripts": {"类型检查": "check:game", "后端单测": "test:backend"},
        "test_globs": ("src/game/core/*.test.ts", "src/world/*.test.ts",
                       "src/activities/*/*.test.ts", "server/*.test.ts"),
    },
    {
        "key": "management",
        "name": "灵境会馆",
        "build_script": "build",
        "test_script": "test",
        "extra_scripts": {},
        "test_globs": ("tests/*.test.js",),
    },
    {
        "key": "ecology",
        "name": "生态进化",
        "build_script": "build",
        "test_script": "test",
        "extra_scripts": {},
        "test_globs": ("tests/*.test.js",),
    },
    {
        "key": "juling",
        "name": "聚灵",
        "build_script": None,          # public/ 原样拷贝
        "test_script": None,           # 暂无自动化测试
        "extra_scripts": {},
        "test_globs": (),
        "static_note": "无构建步骤，发布时拷贝 public/",
    },
    {
        "key": "aeon",
        "name": "AEON",
        "build_script": None,          # 静态拷贝，零依赖
        "test_script": "test",
        "extra_scripts": {},
        "test_globs": ("test/headless.mjs",),
        "static_note": "无构建步骤，发布时按过滤器拷贝源码",
    },
    {
        "key": "world-map",
        "name": "罗小黑世界地图",
        "build_script": "build",
        "test_script": None,           # 只有类型检查
        "extra_scripts": {"类型检查": "check"},
        "test_globs": (),
    },
    {
        "key": "slay",
        "name": "重生之门",
        "build_script": None,          # 发布时拷贝 public/；package.json 的 build 属于上游 snowpack
        "test_script": "test",
        "extra_scripts": {},
        "test_globs": ("tests/*.js",),
        "static_note": "package.json 的 build 是上游 snowpack，会 --clean 删除已跟踪的 "
                       "public/web_modules，不参与本项目发布；发布时拷贝 public/",
    },
    {
        "key": "softie",
        "name": "灵体互动",
        "build_script": "build",
        "test_script": "test",
        "extra_scripts": {},
        "test_globs": ("tests/*.test.js",),
    },
)

# 门户自己提供的路径（见 services/platform/portal_server.py 第 253-263 行）：前缀按目录匹配，
# 其余是精确路径。写成宽前缀会把模块自己的 "/assets/x.png"、"/avatar-cropper.jsx" 或
# "/map-editor/" 误判成门户资源，从而把缺失资源当成通过。
PORTAL_PREFIXES = ("/design-system/", "/api/", "/assets/uploads/")
PORTAL_PATHS = (
    "/avatar-cropper.js", "/avatar-cropper.css",
    "/assets/site-language.js", "/assets/iridescently-mark.png",
    "/map", "/map/",
)

MIME = {
    ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
    ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
    ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
    ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ico": "image/x-icon",
}


def npm_command(script, module_key):
    """返回不需要 shell 的 npm 命令。"""
    return [NPM, "run", script, "--prefix", f"apps/{module_key}"]


def classify_exit(code):
    return PASS if code == 0 else FAIL


def classify_ref(ref):
    """给页面引用分类：本模块、共享包、门户提供，或站外。"""
    target = urlsplit(ref)
    if target.scheme or target.netloc or ref.startswith("//"):
        return "external"
    if target.path.startswith("/shared/"):
        return "shared"
    if target.path in PORTAL_PATHS or target.path.startswith(PORTAL_PREFIXES):
        return "portal"
    return "module"


def resolve_url(url_path, modules_root, packages_root):
    """把门户 URL 映射到它对应的文件；越出根目录的路径一律拒绝。

    边界取 ``modules_root`` / ``packages_root``，而不是 ``modules_root/<head>``：否则
    ``/app/modules/../modules.json`` 这类路径能借 ``..`` 读走 modules 之外的文件。
    """
    path = unquote(url_path)
    if path.startswith("/shared/"):
        root, boundary, relative = packages_root, packages_root, path[len("/shared/"):]
    elif path.startswith("/app/modules/"):
        head, _, tail = path[len("/app/modules/"):].partition("/")
        if not head:
            return None
        root, boundary, relative = modules_root / head, modules_root, tail or "index.html"
    else:
        return None
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(boundary.resolve())
    except ValueError:
        return None
    return candidate


def count_test_files(module_dir, globs):
    return sorted({str(path.relative_to(module_dir)).replace(os.sep, "/")
                   for pattern in globs for path in module_dir.glob(pattern) if path.is_file()})


def dependencies_installed(module_key, package):
    """没有声明依赖的模块不需要安装。

    应用模块装在自己的 ``node_modules``；world-map 是仓库根的 workspace 成员，依赖提升到根。
    """
    declared = {**(package.get("dependencies") or {}), **(package.get("devDependencies") or {})}
    if not declared:
        return True
    if (ROOT / "apps" / module_key / "node_modules").is_dir():
        return True
    return module_key == "world-map" and (ROOT / "node_modules").is_dir()


def read_package(module_key):
    try:
        return json.loads((ROOT / "apps" / module_key / "package.json").read_text("utf-8"))
    except (OSError, ValueError):
        return {}


def inventory():
    rows = []
    for spec in MODULES:
        module_dir = ROOT / "apps" / spec["key"]
        package = read_package(spec["key"])
        scripts = package.get("scripts") or {}
        tests = count_test_files(module_dir, spec["test_globs"])
        build_script = spec["build_script"] if spec["build_script"] in scripts else None
        row = {
            "module": spec["key"],
            "name": spec["name"],
            "package": package.get("name"),
            "build_command": (f"npm run {build_script} --prefix apps/{spec['key']}"
                              if build_script else "静态拷贝（tools/build/build-modules.mjs）"),
            "test_command": (f"npm test --prefix apps/{spec['key']}"
                             if spec["test_script"] in scripts else None),
            "extra_commands": {label: f"npm run {name} --prefix apps/{spec['key']}"
                               for label, name in spec["extra_scripts"].items() if name in scripts},
            "test_files": tests,
            "test_file_count": len(tests),
            "entry": "index.html",
            "entry_present": (module_dir / "index.html").is_file(),
            "dependencies_installed": dependencies_installed(spec["key"], package),
            "build": NOT_RUN,
            "unit": NOT_RUN,
            "entry_check": NOT_RUN,
            "notes": [],
        }
        if spec["test_script"] not in scripts:
            row["notes"].append("package.json 无 test 脚本")
        if spec.get("static_note"):
            row["notes"].append(spec["static_note"])
        elif not build_script:
            row["notes"].append("无独立构建脚本，由聚合构建静态拷贝")
        if not row["dependencies_installed"]:
            row["notes"].append(f"依赖未安装：npm ci --prefix apps/{spec['key']}")
        rows.append(row)
    return rows


def _tail(text):
    return [line for line in text.splitlines() if line.strip()][-12:]


class _WindowsJob:
    """在 Windows 上把子进程放进 job 对象：终止它等于终止 npm 派生出的整棵进程树。

    ``taskkill`` 需要重新打开子进程，在受限令牌下会得到 Access denied；job 对象用的是
    ``Popen`` 已经持有的句柄，不需要额外权限。创建或分配失败时退化为只终止直接子进程，
    并打印一次警告：不能让「以为杀了整棵树、其实只杀了 npm」变成无声降级。
    """

    _warned = False

    def __init__(self, process):
        import ctypes
        self._kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        self._handle = self._kernel32.CreateJobObjectW(None, None)
        error = None
        if not self._handle:
            error = ctypes.get_last_error()
        elif not self._kernel32.AssignProcessToJobObject(self._handle, int(process._handle)):
            error = ctypes.get_last_error()
            self.close()
        if error is not None and not _WindowsJob._warned:
            _WindowsJob._warned = True
            print(f"警告：无法把子进程放进 job 对象（WinError {error}）；"
                  f"超时只能终止直接子进程，孙进程可能残留。", file=sys.stderr)

    def terminate(self):
        if self._handle:
            self._kernel32.TerminateJobObject(self._handle, 1)

    def attached(self):
        """job 是否真的接管了进程；创建或分配失败时为 False，调用方要退回直接杀子进程。"""
        return bool(self._handle)

    def close(self):
        if self._handle:
            self._kernel32.CloseHandle(self._handle)
            self._handle = None


def _start(command, env, output):
    """启动命令，输出写临时文件而不是管道。

    管道写端会被 npm 派生的 node 孙进程继承；只杀 npm 时读端等不到 EOF，``subprocess.run``
    的 timeout 反而会卡在收集输出上（实测会等到孙进程自己结束）。写文件就没有这个问题。
    POSIX 上另起会话，便于把整棵进程树一起终止。
    """
    options = {"cwd": ROOT, "env": env, "stdout": output, "stderr": subprocess.STDOUT}
    if os.name != "nt":
        options["start_new_session"] = True
    return subprocess.Popen(command, **options)


def _terminate(process, job):
    """终止整棵进程树：npm 会派生子进程，只杀 npm 会留下仍在跑的测试。"""
    if job is not None and job.attached():
        job.terminate()
    elif os.name == "nt":
        process.kill()
    else:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except OSError:
            process.kill()
    try:
        process.wait(timeout=KILL_TIMEOUT)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=KILL_TIMEOUT)


def run(command, env, timeout=COMMAND_TIMEOUT):
    started = time.monotonic()
    with tempfile.TemporaryFile() as output:
        try:
            process = _start(command, env, output)
        except OSError as error:
            return {"status": FAIL, "command": command, "seconds": 0.0, "error": str(error)}
        job = _WindowsJob(process) if os.name == "nt" else None
        try:
            code = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            _terminate(process, job)
            output.seek(0)
            return {
                "status": FAIL,
                "command": command,
                "seconds": round(time.monotonic() - started, 2),
                "timeout": timeout,
                "error": f"超过 {timeout}s 未结束，已终止整棵进程树",
                "tail": _tail(output.read().decode("utf-8", "replace")),
            }
        finally:
            if job is not None:
                job.close()
        output.seek(0)
        tail = _tail(output.read().decode("utf-8", "replace"))
    return {
        "status": classify_exit(code),
        "command": command,
        "seconds": round(time.monotonic() - started, 2),
        "exit_code": code,
        "tail": tail,
    }


class _Budget:
    """整轮 ``--run`` 的墙钟预算：给每条命令分配不超过剩余时间的上限。"""

    def __init__(self, seconds, command_timeout=COMMAND_TIMEOUT):
        self.seconds = seconds
        self.command_timeout = command_timeout
        self.exhausted = False
        self._deadline = time.monotonic() + seconds

    def take(self):
        """返回下一条命令可用的秒数；预算不够再启动一条命令时返回 None。"""
        remaining = int(self._deadline - time.monotonic())
        if remaining < 1:
            self.exhausted = True
            return None
        return min(self.command_timeout, remaining)


def run_build(rows, env, storage_root, budget):
    """只构建一次，再按这次运行产出的候选文件逐个判定模块。"""
    timeout = budget.take()
    if timeout is None:
        return None
    result = run(AGGREGATE_BUILD, env, timeout=timeout)
    candidate = storage_root / "test" / "releases" / "candidate" / "modules"
    for row in rows:
        entry = candidate / row["module"] / "index.html"
        if entry.is_file() and entry.stat().st_size:
            row["build"] = PASS
            row["build_seconds"] = result["seconds"]
        else:
            row["build"] = FAIL
            row["build_detail"] = result.get("error") or result.get("tail") or "缺少候选入口文件"
    return result


def _not_run(budget):
    """整轮预算用尽时，未启动的附加检查仍要在结果里出现，不能悄悄省略。"""
    return {"status": NOT_RUN, "seconds": 0.0, "timeout": None,
            "detail": f"整轮预算 {budget.seconds}s 已用尽，未执行"}


def run_tests(rows, env, only, budget):
    for row in rows:
        spec = next(spec for spec in MODULES if spec["key"] == row["module"])
        if row["module"] not in only:
            continue
        if not row["dependencies_installed"]:
            row["unit"] = SKIP
            continue
        timeout = budget.take()
        if timeout is None:
            # 预算耗尽：unit 保持 inventory 给的 NOT RUN；附加检查也要留下 NOT RUN 记录。
            if row["extra_commands"]:
                row["extra_results"] = {label: _not_run(budget) for label in row["extra_commands"]}
            continue
        if row["test_command"]:
            result = run(npm_command(spec["test_script"], row["module"]), env, timeout=timeout)
            row["unit"] = result["status"]
            row["unit_command"] = " ".join(result["command"])
            row["unit_seconds"] = result["seconds"]
            if result["status"] == FAIL:
                row["unit_detail"] = result.get("error") or result.get("tail")
                if result.get("timeout"):
                    row["unit_timeout"] = result["timeout"]
        else:
            row["unit"] = SKIP
        # 附加检查与该模块有没有 test 脚本无关：world-map 唯一的自动化检查就是这条 tsc。
        if row["extra_commands"]:
            row["extra_results"] = {}
            for label in row["extra_commands"]:
                timeout = budget.take()
                if timeout is None:
                    row["extra_results"][label] = _not_run(budget)
                    continue
                extra = run(npm_command(spec["extra_scripts"][label], row["module"]), env, timeout=timeout)
                row["extra_results"][label] = {
                    "status": extra["status"], "seconds": extra["seconds"],
                    "timeout": extra.get("timeout"),
                    "detail": None if extra["status"] == PASS else extra.get("error") or extra.get("tail"),
                }


def make_handler(modules_root, packages_root):
    class Handler(SimpleHTTPRequestHandler):
        def log_message(self, *args):
            return

        def do_GET(self):
            parts = urlsplit(self.path)
            if not parts.path.startswith(("/app/modules/", "/shared/")):
                self.send_error(404)
                return
            target = resolve_url(parts.path, modules_root, packages_root)
            if target is None or not target.is_file():
                self.send_error(404)
                return
            body = target.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", MIME.get(target.suffix.lower(), "application/octet-stream"))
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    return Handler


def _attribute_pattern(name):
    """匹配 ``name="..."`` 或 ``name='...'``；两种引号都算，值里允许出现另一种引号。"""
    return re.compile(rf'\b{name}\s*=\s*(?:"([^"]*)"|\'([^\']*)\')', re.IGNORECASE)


def _attribute_value(match):
    return match.group(1) if match.group(1) is not None else match.group(2)


def collect_refs(html):
    """返回页面真正加载的 ``(引用, 是否装饰性)`` 对。

    只有 ``src`` 属性和 ``<link>`` 标签会加载资源；``<a href>`` 是导航，不能算缺失资源。
    属性值用双引号或单引号都接受。favicon 属于装饰性资源：它 404 不影响模块渲染与交互。
    """
    refs = [(_attribute_value(match), False) for match in _attribute_pattern("src").finditer(html)]
    for tag in re.findall(r"<link\b([^>]*)>", html, flags=re.IGNORECASE):
        href = _attribute_pattern("href").search(tag)
        if not href:
            continue
        rel = _attribute_pattern("rel").search(tag)
        refs.append((_attribute_value(href), "icon" in (_attribute_value(rel) if rel else "").lower()))
    return refs


def fetch(url):
    with urllib.request.urlopen(url, timeout=20) as response:
        return response.read()


def serve_probe(rows, modules_root, packages_root):
    """抓取每个模块入口，以及它引用的同源资源。"""
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(modules_root, packages_root))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        for row in rows:
            url = f"{base}/app/modules/{row['module']}/"
            detail = {"url": f"/app/modules/{row['module']}/"}
            try:
                body = fetch(url)
            except OSError as error:
                detail.update({"status": FAIL, "error": str(error)})
                row.update({"entry_check": FAIL, "entry_detail": detail})
                continue
            detail["bytes"] = len(body)
            missing, cosmetic_missing, checked = [], [], 0
            for ref, cosmetic in collect_refs(body.decode("utf-8", "replace")):
                if classify_ref(ref) not in ("module", "shared"):
                    continue
                checked += 1
                try:
                    fetch(urljoin(url, ref))
                except OSError:
                    (cosmetic_missing if cosmetic else missing).append(ref)
            detail.update({"assets_checked": checked, "missing": sorted(set(missing)),
                           "missing_cosmetic": sorted(set(cosmetic_missing))})
            if not checked:
                detail.update({"status": SKIP, "reason": "入口未引用同源资源，无法据此判断可运行性"})
            else:
                detail["status"] = PASS if not missing else FAIL
            row.update({"entry_check": detail["status"], "entry_detail": detail})
    finally:
        server.shutdown()
        server.server_close()


def markdown(rows, aggregate, budget=None):
    lines = [
        "| 模块 | 构建 | 单元测试 | 最小交互入口 | 测试文件 | 说明 |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for row in rows:
        notes = list(row["notes"])
        if row.get("extra_results"):
            notes.append("；".join(f"{label} {value['status']}"
                                   f"{'（超时已终止）' if value.get('timeout') else ''}"
                                   for label, value in row["extra_results"].items()))
        if row.get("unit_timeout"):
            notes.append(f"单测超时（上限 {row['unit_timeout']}s），已终止")
        elif row.get("unit_detail"):
            notes.append("单测失败，详见 JSON 的 unit_detail")
        notes_text = "；".join(notes)
        lines.append(f"| {row['module']} | {row['build']} | {row['unit']} | "
                     f"{row['entry_check']} | {row['test_file_count']} | {notes_text} |")
    if aggregate:
        detail = (f"超时上限 {aggregate['timeout']}s，已终止" if aggregate.get("timeout")
                  else f"exit {aggregate.get('exit_code')}")
        lines += ["", f"聚合构建：`{' '.join(aggregate['command'])}` → {aggregate['status']}"
                      f"（{aggregate['seconds']}s，{detail}）"]
    if budget is not None and budget.exhausted:
        lines += ["", f"整轮预算 {budget.seconds}s 已用尽：剩余检查记为 NOT RUN，本轮不算通过。"]
    return "\n".join(lines)


class ChineseHelpFormatter(argparse.HelpFormatter):
    """把 argparse 自带的 ``usage:`` 前缀换成中文；库自身的报错文案保持原样。"""

    def add_usage(self, usage, actions, groups, prefix=None):
        super().add_usage(usage, actions, groups, prefix or "用法：")


def positive_seconds(text):
    """时间参数只接受正整数秒：0 或负数会让命令刚启动就被终止。"""
    value = int(text)
    if value < 1:
        raise argparse.ArgumentTypeError(f"需要正整数秒，收到 {text!r}")
    return value


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0],
                                     formatter_class=ChineseHelpFormatter, add_help=False)
    parser.add_argument("-h", "--help", action="help", help="显示本帮助并退出")
    parser.add_argument("--run", action="store_true", help="执行聚合构建和各模块的测试")
    parser.add_argument("--serve", action="store_true", help="再用本地静态探针抓取每个入口")
    parser.add_argument("--module", action="append", default=[], help="只对指定模块键执行测试与入口探测")
    parser.add_argument("--modules", type=Path, help="--serve 使用的已构建模块目录")
    parser.add_argument("--json", type=Path, help="把机器可读矩阵写到这个路径")
    parser.add_argument("--markdown", type=Path, help="把 Markdown 矩阵写到这个路径")
    parser.add_argument("--command-timeout", type=positive_seconds, default=COMMAND_TIMEOUT,
                        metavar="秒",
                        help=(f"每条命令的上限，超时终止整棵进程树并记 FAIL；"
                              f"整轮剩余预算更少时按剩余预算执行（默认 {COMMAND_TIMEOUT}）"))
    parser.add_argument("--total-timeout", type=positive_seconds, default=TOTAL_TIMEOUT,
                        metavar="秒",
                        help=(f"整轮 --run 的墙钟预算，它是硬上限；用尽后剩余检查记 NOT RUN"
                              f"（默认 {TOTAL_TIMEOUT}）"))
    parser._optionals.title = "可选参数"
    args = parser.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):  # Windows 控制台默认用旧代码页
        sys.stdout.reconfigure(encoding="utf-8")

    rows = inventory()
    aggregate = None
    budget = None
    selected = set(args.module)
    if args.run or args.serve:
        storage_root = Path(tempfile.mkdtemp(prefix="module-baseline-"))
        env = os.environ.copy()
        env["IRIDESCENTLY_STORAGE_ROOT"] = str(storage_root)
        env["IRIDESCENTLY_ENVIRONMENT"] = "test"
        try:
            if args.run:
                budget = _Budget(args.total_timeout, args.command_timeout)
                aggregate = run_build(rows, env, storage_root, budget)
                run_tests(rows, env, selected or {row["module"] for row in rows}, budget)
            if args.serve:
                modules_root = (args.modules or
                                storage_root / "test" / "releases" / "candidate" / "modules").resolve()
                if not modules_root.is_dir():
                    for row in rows:
                        row["entry_check"] = SKIP
                        row["notes"].append("没有已构建候选：先运行 --run 或指定 --modules")
                else:
                    targets = [row for row in rows
                               if not selected or row["module"] in selected]
                    serve_probe(targets, modules_root, ROOT / "packages")
        finally:
            shutil.rmtree(storage_root, ignore_errors=True)

    text = markdown(rows, aggregate, budget)
    print(text)
    payload = {
        "schema": 1,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "node": _version([NODE, "--version"]),
        "python": sys.version.split()[0],
        "modules": rows,
    }
    if aggregate:
        payload["aggregate_build"] = {key: aggregate.get(key)
                                      for key in ("status", "seconds", "exit_code", "error", "timeout")}
    if budget is not None:
        payload["budget"] = {"seconds": budget.seconds, "exhausted": budget.exhausted}
    if args.json:
        args.json.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.markdown:
        args.markdown.write_text(text + "\n", encoding="utf-8")
    # entry_check 只在 --serve 时由 serve_probe 写入；未探测时保持 NOT RUN，不会误触发非 0。
    failed = any(row[field] == FAIL for row in rows for field in ("build", "unit", "entry_check"))
    # 预算用尽时矩阵不完整，不能因为剩下的检查恰好都还没记 FAIL 就返回 0。
    return 1 if failed or (budget is not None and budget.exhausted) else 0


def _version(command):
    """读取工具版本；超时或拿不到就返回 None，不让一次版本探测卡住整张矩阵。"""
    try:
        completed = subprocess.run(command, capture_output=True, text=True,
                                   encoding="utf-8", timeout=5)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return completed.stdout.strip()


if __name__ == "__main__":
    sys.exit(main())
