"""Touch check: on an emulated phone, walk next to the lantern flower and tap the on-screen interact button.

  python mobile_interact_check.py --base http://127.0.0.1:18300 --code CODE --out DIR
Passes when the lantern's server-side stage advances after a real touch tap (no keyboard).
"""
import argparse, json, time
from pathlib import Path
from playwright.sync_api import sync_playwright
from e2e_browser import CHROME

ap = argparse.ArgumentParser()
ap.add_argument("--base", required=True); ap.add_argument("--code", required=True); ap.add_argument("--out", required=True)
a = ap.parse_args()
out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
states, buttons = [], []
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, headless=True, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    ctx = b.new_context(**pw.devices["Pixel 7"])
    p = ctx.new_page()
    def on_console(m):
        t = m.text
        if "LABSTATE " in t: states.append(json.loads(t.split("LABSTATE ", 1)[1]))
        if "LABBUTTON " in t: buttons.append(json.loads(t.split("LABBUTTON ", 1)[1]))
    p.on("console", on_console)
    p.goto(a.base + "/"); p.fill("#code", a.code); p.click("#go"); p.wait_for_url("**/play/**", timeout=60000)
    p.goto(a.base + "/play/?auto=enter:hall;nick:手机;editor;wait:3;done;wait:2;goto:13.2:15.5;arrive;goto:12.6:13.4;arrive;wait:2;button_rect;report")
    end = time.time() + 180
    while time.time() < end and not buttons:
        p.wait_for_timeout(500)
    before = states[-1]["objects"].get("lantern-flower", {}).get("count", 0) if states else None
    btn = buttons[-1] if buttons else None
    result = {"button": btn, "before_count": before}
    if btn and btn["visible"]:
        vw = p.viewport_size
        sx, sy = vw["width"] / btn["viewport"][0], vw["height"] / btn["viewport"][1]
        x, y = (btn["x"] + btn["w"] / 2) * sx, (btn["y"] + btn["h"] / 2) * sy
        p.screenshot(path=str(out / "before-tap.png"))
        p.touchscreen.tap(x, y)
        p.wait_for_timeout(3000)
        p.goto(a.base + "/play/?auto=wait:3;report")
        end = time.time() + 120
        n = len(states)
        while time.time() < end and len(states) == n:
            p.wait_for_timeout(500)
        after = states[-1]["objects"].get("lantern-flower", {}).get("count", 0)
        result.update(tap=[round(x), round(y)], after_count=after, passed=after == (before or 0) + 1)
        p.screenshot(path=str(out / "after-tap.png"))
    else:
        result["passed"] = False
    b.close()
(out / "mobile-interact.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
print(json.dumps(result, ensure_ascii=False))
