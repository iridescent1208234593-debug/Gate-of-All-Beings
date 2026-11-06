"""[M7] Public showcase pages are rebuilt from an allowlist; only the server's nonce scripts run."""
import os
from pathlib import Path
import re
import sys
import tempfile
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[3]
TEMP = tempfile.TemporaryDirectory(prefix='showcase-output-')
sys.path.insert(0, str(ROOT / 'services/platform'))
sys.path.insert(0, str(ROOT / 'apps/huiguan'))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from testing_storage import configure
configure(TEMP.name)
os.environ['HX_SSO_SECRET'] = 'showcase-test-only-secret'
os.environ['IRIDESCENTLY_OC_BACKEND'] = 'json'
import server_huiguan as app
from showcase_sanitizer import sanitize_showcase, controlled_showcase, RUNTIME_SCRIPTS
from test_fan_owner_edit import Client

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "services" / "platform"))
from legal_consent import CURRENT_VERSION as LEGAL_VERSION  # noqa: E402

TEMPLATE_LIKE = '''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>A-1 | 人设表</title>
<style>:root{--character-primary:#123456;--bg:#0a0b0c}
body::before{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E")}
.reveal{opacity:0}</style></head><body><canvas id="ink-canvas"></canvas>
<div class="page"><div class="header"><span class="right">会馆<button id="saveImgBtn" type="button" title="把本页保存为图片">⬇ 保存为图片</button>
<button id="themeToggle" type="button">☾ 会馆乳白</button></span></div>
<img loading="lazy" decoding="async" data-original-image src="/assets/uploads/UPLOAD.png" alt="" class="lhx-img" onclick="lhxZoom(this)" style="max-width:180px">
<table><tbody><tr><td class="f">年龄</td><td>12岁</td></tr></tbody></table>
<details class="egg reveal" open><summary>展开</summary><p>故事 &lt;b&gt; 文本</p></details>
<nav class="site-nav"><a href="/" data-site-service="huiguan" data-site-path="/">会馆首页</a><a href="#" class="current">A-1</a></nav>
</div><script>(function(){ window.inline = 1; })();</script>
<script src="/showcase-download.js?v=20261027z"></script></body></html>'''.replace('UPLOAD', 'a' * 64)

ATTACKS = [
    '<script>alert(1)</script>', '<SCRIPT SRC=//evil.example/x.js></SCRIPT>', '<img src=x onerror=alert(1)>',
    '<a href="javascript:alert(1)">x</a>', '<a href="jav&#x61;script:alert(1)">x</a>', '<a href=" javascript:alert(1)">x</a>',
    '<a href="//evil.example/">x</a>', '<a href="/\\evil.example/">x</a>', '<a href="https://evil.example/">x</a>',
    '<iframe src="https://evil.example"></iframe>', '<object data="x.swf"></object>', '<embed src="x">',
    '<form action="https://evil.example"><input name=p><button formaction="https://evil.example">go</button></form>',
    '<meta http-equiv="refresh" content="0;url=https://evil.example">', '<base href="https://evil.example/">',
    '<svg onload=alert(1)><script>alert(1)</script></svg>', '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
    '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
    '<title><script>alert(1)</script></title>', '<!--<script>alert(1)</script>-->', '<div style="background:url(https://evil.example/t)">x</div>',
    '<style>@import url(https://evil.example/x.css); body{background:url("https://evil.example/b")}</style>',
    '<div style="width:expression(alert(1))">x</div>', '<script nonce="guess">alert(1)</script>', '<img src="data:text/html;base64,PHNjcmlwdD4=">',
    '<button onclick="alert(1)" type="submit">x</button>', '<details open ontoggle=alert(1)>x</details>',
    '<template><script>alert(1)</script></template>', '<a href="/ok" target="_top" ping="https://evil.example">ok</a>',
]


def scripts(html):
    return re.findall(r'<script\b[^>]*>', html, re.I)


class Sanitizer(unittest.TestCase):
    def test_execution_surface_is_removed(self):
        for attack in ATTACKS:
            output = sanitize_showcase('<html><head></head><body>' + attack + '</body></html>', app.REMOTE_IMAGE_HOSTS)
            lowered = output.lower()
            with self.subTest(attack=attack):
                self.assertEqual(scripts(output), [])
                for needle in ('javascript:', 'evil.example', ' on', '<iframe', '<object', '<embed', '<form', '<input',
                               '<meta http-equiv', '<base', '<svg', '<math', 'expression(', '@import', 'data:text', 'nonce=',
                               'type="submit"', 'target=', 'ping=', '<!--'):
                    self.assertNotIn(needle, lowered)

    def test_template_markup_survives(self):
        output = sanitize_showcase(TEMPLATE_LIKE)
        for kept in ('id="ink-canvas"', 'id="saveImgBtn"', 'id="themeToggle"', 'class="lhx-img"', 'data-original-image=""',
                     'src="/assets/uploads/' + 'a' * 64 + '.png"', '<details class="egg reveal" open="">', 'data-site-path="/"',
                     '<meta charset="utf-8">', 'name="viewport"', '<title>A-1 | 人设表</title>', '--character-primary:#123456',
                     "url(\"data:image/svg+xml", '故事 &lt;b&gt; 文本', 'href="#"', 'max-width:180px', '<td>12岁</td>'):
            self.assertIn(kept, output)
        self.assertNotIn('onclick', output)
        self.assertNotIn('window.inline', output)
        self.assertEqual(scripts(output), [])

    def test_controlled_output_only_carries_nonced_server_scripts(self):
        output = controlled_showcase(TEMPLATE_LIKE + ''.join(ATTACKS), '{"colorPrimary": "#123456", "colorAccent": "#abcdef", "colorIndex": null}')
        nonce = re.search(r"script-src 'nonce-([A-Za-z0-9_-]+)'", output).group(1)
        tags = scripts(output)
        self.assertEqual(len(tags), 2 + len(RUNTIME_SCRIPTS))
        self.assertTrue(all('nonce="' + nonce + '"' in tag for tag in tags))
        srcs = re.findall(r'<script nonce="[^"]+" src="([^"]+)"', output)
        self.assertEqual(srcs, ['/character-colors.js?v=20261013', *RUNTIME_SCRIPTS])
        self.assertIn("HuiguanColors.installShowcase({\"colorPrimary\": \"#123456\"", output)
        # The CSP meta comes before any saved markup; the theme runs after the page's own styles.
        self.assertLess(output.index('Content-Security-Policy'), output.index('<style>'))
        self.assertLess(output.index('</style>'), output.index('character-colors.js'))
        self.assertIn("object-src 'none'", output)
        self.assertIn("form-action 'none'", output)
        self.assertNotEqual(nonce, re.search(r"'nonce-([^']+)'", controlled_showcase('<p>x</p>')).group(1))

    def test_age_and_text_fields_are_escaped(self):
        output = sanitize_showcase('<td>"><img src=x onerror=alert(1)>岁</td>')
        self.assertNotIn('onerror', output)
        self.assertNotIn('<img', sanitize_showcase('<td>&lt;img src=x onerror=alert(1)&gt;岁</td>'))


class PublicShowcase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), type('Quiet', (app.Handler,), {'log_message': lambda *_: None}))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True); cls.thread.start()
        cls.base = 'http://127.0.0.1:' + str(cls.server.server_port)
        cls.client = Client(cls.base)
        assert cls.client.call('/api/register', {"legal_version": LEGAL_VERSION, 'username': 'showcase_owner', 'password': 'test-only-password-123',
                                                 'nickname': 'showcase_owner', 'email': 'showcase@example.com'})[0] == 200

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.thread.join(); TEMP.cleanup()

    def test_saved_scripts_do_not_reach_public_page(self):
        html = TEMPLATE_LIKE.replace('</body>', ''.join(ATTACKS) + '</body>')
        body = {'code': 'm7-public', 'version': 0, 'html': html,
                'data': {'code': 'm7-public', 'name': '展示', 'colorPrimary': '#123456', 'colorAccent': '#abcdef'}}
        self.assertEqual(self.client.call('/api/save-character', body)[0], 200)
        with urllib.request.urlopen(self.base + '/api/get-character?code=m7-public') as response:
            page = response.read().decode()
            self.assertEqual(response.headers['Content-Security-Policy'], 'sandbox allow-popups')
        self.assertNotIn('alert(1)', page)
        self.assertNotIn('evil.example', page)
        self.assertNotIn('onclick', page)
        nonce = re.search(r"'nonce-([^']+)'", page).group(1)
        self.assertTrue(all('nonce="' + nonce + '"' in tag for tag in scripts(page)))
        self.assertIn('/showcase-runtime.js', page)
        self.assertIn('id="themeToggle"', page)


if __name__ == '__main__':
    unittest.main()
