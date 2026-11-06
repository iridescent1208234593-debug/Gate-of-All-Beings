"""Debug helper: log in with one code, open /play/ with optional auto actions, dump console + screenshot."""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
from e2e_browser import CHROME

base, code, actions, shot = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, headless=True,
                           args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    p = b.new_context(viewport={"width": 1280, "height": 720}).new_page()
    p.on("console", lambda m: print("CONSOLE", m.type, m.text[:400]))
    p.on("pageerror", lambda e: print("PAGEERROR", e))
    p.on("requestfailed", lambda r: print("REQFAIL", r.url, r.failure))
    p.goto(base + "/")
    p.fill("#code", code)
    p.click("#go")
    p.wait_for_url("**/play/**")
    p.goto(base + "/play/?auto=" + actions)
    p.wait_for_timeout(int(float(sys.argv[5]) * 1000) if len(sys.argv) > 5 else 20000)
    p.screenshot(path=shot)
    b.close()
