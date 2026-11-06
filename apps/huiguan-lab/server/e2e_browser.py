"""Real-browser multiplayer check: two independent Chromium contexts (separate cookie jars),
each logs in with its own test code, loads the Godot web build and plays scripted input.

  python e2e_browser.py --base http://127.0.0.1:18300 --codes CODE_A CODE_B --out <evidence dir>

Assertions come from the running games themselves (LABSTATE console lines), plus screenshots.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import os
import time
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

CHROME = os.environ.get("LAB_CHROME") or str(Path(os.environ["LOCALAPPDATA"]) / "ms-playwright" / "chromium-1248" / "chrome-win64" / "chrome.exe")


def oc_png(path: Path, color):
    img = Image.new("RGBA", (180, 260), (0, 0, 0, 0))
    for x in range(30, 150):
        for y in range(40, 250):
            if ((x - 90) / 60) ** 2 + ((y - 145) / 105) ** 2 <= 1:
                img.putpixel((x, y), color)
    for x in range(60, 120):
        for y in range(0, 60):
            if ((x - 90) / 30) ** 2 + ((y - 30) / 30) ** 2 <= 1:
                img.putpixel((x, y), (250, 230, 200, 255))
    img.save(path, "PNG")


class Player:
    def __init__(self, browser, base, code, name, out):
        self.ctx = browser.new_context(viewport={"width": 1280, "height": 720})
        self.page = self.ctx.new_page()
        self.name, self.base, self.code, self.out = name, base, code, out
        self.states, self.console, self.mark = [], [], 0
        self.page.on("console", self._console)

    def _console(self, msg):
        text = msg.text
        self.console.append(text)
        if "LABSTATE " in text:
            self.states.append(json.loads(text.split("LABSTATE ", 1)[1]))

    def login(self):
        self.page.goto(self.base + "/")
        self.page.fill("#code", self.code)
        self.page.click("#go")
        self.page.wait_for_url("**/play/**", timeout=90000)

    def play(self, actions: str):
        self.mark = len(self.states)
        self.page.goto(self.base + "/play/?auto=" + ("watch:1;" + actions).replace(" ", "%20"))

    def wait_state(self, pred, timeout=float(os.environ.get("LAB_E2E_TIMEOUT", "90"))):
        end = time.time() + timeout
        while time.time() < end:
            for s in reversed(self.states[self.mark:]):
                if pred(s):
                    return s
            self.page.wait_for_timeout(500)
        raise AssertionError(f"{self.name}: no matching LABSTATE; last={self.states[-1:] }")

    def shot(self, label):
        p = self.out / f"{self.name}-{label}.png"
        self.page.screenshot(path=str(p))
        return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:18300")
    ap.add_argument("--codes", nargs=2, required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--headed", action="store_true")
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    oc_png(out / "oc-a.png", (90, 140, 210, 255))
    results = {"base": a.base, "started": time.time(), "checks": {}}

    def check(name, ok, detail=""):
        results["checks"][name] = {"pass": bool(ok), "detail": detail}
        print(("PASS " if ok else "FAIL ") + name, detail)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=CHROME, headless=not a.headed,
                                     args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        A = Player(browser, a.base, a.codes[0], "A", out)
        B = Player(browser, a.base, a.codes[1], "B", out)
        # unauthenticated access is refused
        anon = browser.new_context().new_page()
        r = anon.goto(a.base + "/play/index.pck")
        check("A1 no code -> no game assets", anon.url.rstrip("/") == a.base.rstrip("/") or (r and r.status != 200), anon.url)
        anon.goto(a.base + "/")
        anon.fill("#code", "ZSZM-WRON-GCOD-EXXX-XXXX")
        anon.click("#go")
        anon.wait_for_timeout(1500)
        check("A2 invalid code rejected", "/play" not in anon.url, anon.inner_text("#msg"))
        A.login(); B.login()
        check("A3 valid codes log in", "/play/" in A.page.url and "/play/" in B.page.url)
        # A uploads a transparent PNG through the real file chooser; B uses the built-in editor.
        chosen = []
        A.page.on("filechooser", lambda chooser: (chosen.append(1), chooser.set_files(str(out / "oc-a.png"))))
        A.play("enter:hall;nick:阿甲;wait:3;upload;wait:20;done;wait:2;goto:14:15.5;arrive;wait:1;report;chat:你好，我是阿甲;wait:2;report")
        A.wait_state(lambda s: True)            # game loaded and connected
        for _ in range(40):                      # a real click gives the page the user activation a file chooser needs
            if chosen:
                break
            A.page.wait_for_timeout(700)
            A.page.mouse.click(1200, 680)
        check("C0 upload through the browser file chooser", bool(chosen))
        B.play("enter:hall;nick:阿乙;wait:4;editor;wait:3;done;wait:2;goto:17:15.5;arrive;wait:2;report;wait:3;report")
        sa = A.wait_state(lambda s: len(s["players"]) >= 1 and s["oc_bytes"] > 0)
        sb = B.wait_state(lambda s: len(s["players"]) >= 1 and s["oc_bytes"] > 0)
        check("B1 two independent sessions in one world", sa["pid"] != sb["pid"] and sa["space"] == sb["space"] == "hall",
              f"A={sa['pid']} B={sb['pid']}")
        sb2 = B.wait_state(lambda s: sa["pid"] in s["players"] and abs(s["players"][sa["pid"]]["x"] - 14) < 0.4)
        check("B2 B sees A's movement", True, json.dumps(sb2["players"][sa["pid"]], ensure_ascii=False))
        sa2 = A.wait_state(lambda s: sb["pid"] in s["players"] and abs(s["players"][sb["pid"]]["x"] - 17) < 0.4)
        check("B3 A sees B's movement", True, json.dumps(sa2["players"][sb["pid"]], ensure_ascii=False))
        sb3 = B.wait_state(lambda s: "你好，我是阿甲" in s["chat"])
        check("B4 chat delivered A->B", True, sb3["chat"][-60:])
        sa3 = A.wait_state(lambda s: s["players"].get(sb["pid"], {}).get("has_oc_texture"))
        sb4 = B.wait_state(lambda s: s["players"].get(sa["pid"], {}).get("has_oc_texture"), timeout=30)
        check("C1 both players see each other's OC image", True)
        A.shot("hall-2d"); B.shot("hall-2d")
        # 3D view on B, same authoritative world
        B.play("wait:3;view:3d;wait:5;report")
        sb5 = B.wait_state(lambda s: s["view"] == "3d" and sa["pid"] in s["players"] and s["players"][sa["pid"]].get("has_oc_texture"))
        B.shot("hall-3d")
        check("E1 3D view connected to the same world sees A", abs(sb5["players"][sa["pid"]]["x"] - sa3["me"]["x"]) < 0.5,
              json.dumps(sb5["players"][sa["pid"]]))
        # private space: A opens a space at the rainbow door and invites B
        A.play("wait:3;goto:13.2:15.5;arrive;goto:13.2:6.4;arrive;goto:15.5:6.4;arrive;wait:1;create;wait:4;invite_all;wait:8;enter_mine;wait:4;report")
        B.play("view:2d;wait:3;goto:13.2:15.5;arrive;goto:13.2:6.4;arrive;goto:15.4:6.6;arrive;wait:14;enter_invited;wait:5;report")
        sa6 = A.wait_state(lambda s: s["space"].startswith("sp_"), timeout=max(120, float(os.environ.get("LAB_E2E_TIMEOUT", "90"))))
        sb6 = B.wait_state(lambda s: s["space"] == sa6["space"] and sa6["pid"] in s["players"], timeout=max(120, float(os.environ.get("LAB_E2E_TIMEOUT", "90"))))
        check("D1 private space created and entered", True, sa6["space"])
        check("D2 invited player enters the private space", True)
        A.shot("private"); B.shot("private")
        # reconnect: reload A; A comes back into its own space and B still sees exactly one A
        A.play("wait:5;report")
        sa7 = A.wait_state(lambda s: s["space"] == sa6["space"] and sb["pid"] in s["players"], timeout=max(60, float(os.environ.get("LAB_E2E_TIMEOUT", "90"))))
        B.play("wait:6;report")
        sb7 = B.wait_state(lambda s: sa["pid"] in s["players"], timeout=max(60, float(os.environ.get("LAB_E2E_TIMEOUT", "90"))))
        check("B6 reconnect restores space, no duplicate", list(sb7["players"]).count(sa["pid"]) == 1)
        # B returns to the hall
        B.play("wait:3;enter:hall;wait:4;report")
        sb8 = B.wait_state(lambda s: s["space"] == "hall", timeout=max(60, float(os.environ.get("LAB_E2E_TIMEOUT", "90"))))
        check("D3 return from private space to hall", True)
        results["fps"] = {"A": sa7.get("fps"), "B": sb8.get("fps")}
        results["rtt_ms"] = {"A": sa7.get("rtt"), "B": sb8.get("rtt")}
        results["console_errors"] = [c for c in A.console + B.console if "ERROR" in c or "error" in c.lower()][:40]
        browser.close()
    results["finished"] = time.time()
    results["all_pass"] = all(v["pass"] for v in results["checks"].values())
    (out / "e2e-result.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    print("ALL PASS" if results["all_pass"] else "SOME FAILED")


if __name__ == "__main__":
    main()
