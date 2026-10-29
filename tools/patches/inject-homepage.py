#!/usr/bin/env python3
"""把首页交互补丁注入到已部署的 apps/www/homepage.html。

背景
----
节气画廊首页的很多交互（点赞、留言、弹幕、按钮样式）是在**构建产物**上补的，
因为源码 `apps/www/index.html` 并不直接成为线上的 `homepage.html`：
Vite 构建会从 stage 目录重新生成一个约 10 KB 的 `index.html`，
部署时覆盖为 `homepage.html`。构建产物里不含这些补丁脚本。

因此每次 `npm run build:homepage` 并部署之后，**必须再跑一次本脚本**，
把补丁脚本追加到线上 `homepage.html` 的 </body> 之前。

用法
----
    python3 tools/patches/inject-homepage.py <部署后的 homepage.html>

幂等：脚本按 `<script id="__qc_xxx">` 的 id 去重，重复执行不会叠加。

补丁清单
--------
__qc_gallery_stub    藏掉「收藏/星标」按钮，只保留大拇指
__qc_comment_unlock  解除「写一句」按钮的 disabled（旧的 66 次互动门槛已废弃）
__qc_danmaku         左下角圆形留言球 + 自建留言弹窗 + 弹幕轮播
"""
import re
import sys
from pathlib import Path

# 补丁源码放在仓库里，与线上注入内容保持一致
BLOCK_RE = re.compile(r'<script id="(__qc_[a-z_]+)">.*?</script>', re.S)


def extract_blocks(source_html: str) -> dict:
    """从源码首页里提取所有 __qc_ 脚本块，按 id 归类。"""
    return {m.group(1): m.group(0) for m in BLOCK_RE.finditer(source_html)}


def inject(target_path: Path, blocks: dict) -> int:
    html = target_path.read_text(encoding="utf-8")
    existing = {m.group(1) for m in BLOCK_RE.finditer(html)}
    missing = [bid for bid in blocks if bid not in existing]
    if not missing:
        return 0
    addition = "\n".join(blocks[bid] for bid in missing) + "\n"
    if "</body>" not in html:
        raise SystemExit("目标文件缺少 </body>，无法注入")
    html = html.replace("</body>", addition + "</body>", 1)
    target_path.write_text(html, encoding="utf-8")
    return len(missing)


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("用法: inject-homepage.py <homepage.html 路径> [源码 index.html 路径]")
    target = Path(sys.argv[1])
    source = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parents[2] / "apps" / "www" / "index.html"
    if not target.is_file():
        raise SystemExit(f"目标不存在: {target}")
    if not source.is_file():
        raise SystemExit(f"补丁源不存在: {source}")
    blocks = extract_blocks(source.read_text(encoding="utf-8"))
    if not blocks:
        raise SystemExit(f"在 {source} 里没找到 __qc_ 脚本块")
    count = inject(target, blocks)
    print(f"已注入 {count} 个脚本块 -> {target}" if count else f"无需改动，{target} 已是最新")


if __name__ == "__main__":
    main()
