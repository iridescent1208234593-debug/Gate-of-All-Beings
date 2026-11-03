"""[M3] Role-sheet saves validate data: images, bound showcase HTML, and limit per-account writes."""
import base64
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[3]
TEMP = tempfile.TemporaryDirectory(prefix='oc-save-limits-')
sys.path.insert(0, str(ROOT / 'services/platform'))
sys.path.insert(0, str(ROOT / 'apps/huiguan'))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from testing_storage import configure
configure(TEMP.name)
os.environ['HX_SSO_SECRET'] = 'oc-limits-test-only-secret'
os.environ['IRIDESCENTLY_OC_BACKEND'] = 'json'
from PIL import Image
import server_huiguan as app
from test_fan_owner_edit import Client, sheet


class Quiet(app.Handler):
    def log_message(self, *_): pass


def png_uri(color='green'):
    output = io.BytesIO(); Image.new('RGB', (3, 3), color).save(output, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(output.getvalue()).decode(), output.getvalue()


def files(directory):
    return set(os.listdir(directory))


class SaveLimits(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Quiet)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True); cls.thread.start()
        cls.base = 'http://127.0.0.1:' + str(cls.server.server_port)
        cls.client = Client(cls.base)
        status, _ = cls.client.call('/api/register', {'username': 'limits_owner', 'password': 'test-only-password-123',
                                                      'nickname': 'limits_owner', 'email': 'limits@example.com'})
        assert status == 200

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.thread.join(); TEMP.cleanup()

    def setUp(self):
        with app.RATE_LOCK:
            for key in [k for k in app.RATE if k.startswith('oc-save:')]:
                app.RATE.pop(key)
            app.OC_STORAGE.clear(); app._SECURITY_LOGGED.clear()

    def save(self, code, version=0, html=None, **data):
        body = sheet(code, '角色' + code, '内容')
        body['data'].update(data); body['version'] = version
        if html is not None:
            body['html'] = html
        return self.client.call('/api/save-character', body)

    def test_normal_sheet_and_image_still_save_with_sha256_names(self):
        uri, raw = png_uri()
        status, result = self.save('normal-1', image=uri, images=[uri])
        self.assertEqual(status, 200, result)
        expected = '/assets/uploads/' + hashlib.sha256(raw).hexdigest() + '.png'
        record = app.character_store().get(self.owner(), 'normal-1', None)
        self.assertEqual(record['data']['image'], expected)
        self.assertEqual(record['data']['images'], [expected])
        html = sheet('normal-1', '角色normal-1', '内容')['html']
        self.assertEqual(record['html_ref'], hashlib.sha256(html.encode()).hexdigest() + '.html')
        with contextlib.closing(__import__('urllib.request').request.urlopen(self.base + '/api/get-character?code=normal-1')) as page:
            self.assertIn('内容', page.read().decode())

    def owner(self):
        uid = app.get_local_user_by_name('limits_owner')['uid']
        return {'kind': 'local', 'uid': uid}

    def test_forged_image_and_unknown_mime_are_rejected_before_disk(self):
        before = files(app.UPLOAD_DIR)
        forged = 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'garbage' * 50).decode()
        svg = 'data:image/svg+xml;base64,' + base64.b64encode(b'<svg onload="alert(1)"/>').decode()
        mismatch = 'data:image/gif;base64,' + png_uri('red')[0].split(',', 1)[1]
        for value in (forged, svg, mismatch, 'data:text/html;base64,PGI+', 'data:image/png;base64,***'):
            status, result = self.save('bad-image', image=value)
            self.assertEqual(status, 400, (value[:30], result))
            status, _ = self.save('bad-image', images=[value])
            self.assertEqual(status, 400)
        self.assertEqual(files(app.UPLOAD_DIR), before)
        self.assertIsNone(app.character_store().get(self.owner(), 'bad-image', None))

    def test_oversized_image_rejected(self):
        oversized = b'\x89PNG\r\n\x1a\n' + b'\0' * app.IMAGE_LIMIT
        with self.assertRaisesRegex(ValueError, '8MB'):
            app.store_data_uri('data:image/png;base64,' + base64.b64encode(oversized).decode())

    def test_oversized_html_returns_413_and_writes_nothing(self):
        before_store, before_uploads = files(app.STORE_DIR), files(app.UPLOAD_DIR)
        page = '<html><body>' + 'x' * app.SHOWCASE_HTML_LIMIT + '</body></html>'
        status, result = self.save('big-html', html=page, image=png_uri('blue')[0])
        self.assertEqual(status, 413, result)
        self.assertEqual(files(app.STORE_DIR), before_store)
        self.assertEqual(files(app.UPLOAD_DIR), before_uploads)
        exact = '<p>' + 'y' * (app.SHOWCASE_HTML_LIMIT - 7) + '</p>'
        self.assertEqual(len(exact.encode()), app.SHOWCASE_HTML_LIMIT)
        self.assertEqual(self.save('limit-html', html=exact)[0], 200)

    def test_frequent_saves_hit_429_and_log_a_security_event(self):
        stderr = io.StringIO()
        with contextlib.redirect_stderr(stderr):
            statuses = [self.save('burst-' + str(i))[0] for i in range(app.OC_SAVE_LIMITS[0][0] + 2)]
            self.assertEqual(self.client.call('/api/save-all-characters', {'characters': [], 'versions': {}})[0], 429)
        self.assertEqual(statuses[:app.OC_SAVE_LIMITS[0][0]], [200] * app.OC_SAVE_LIMITS[0][0])
        self.assertEqual(statuses[-2:], [429, 429])
        events = [json.loads(line) for line in stderr.getvalue().splitlines() if line.startswith('{')]
        self.assertEqual([e['security_event'] for e in events], ['oc_save_rate_limited'])  # once per minute, not per hit
        self.assertNotIn('limits_owner', stderr.getvalue())
        self.assertEqual(len(events[0]['account']), 16)

    def test_storage_budget_returns_429_for_saves_and_uploads(self):
        original = app.OC_STORAGE_BUDGET
        app.OC_STORAGE_BUDGET = 4096
        try:
            with contextlib.redirect_stderr(io.StringIO()) as stderr:
                self.assertEqual(self.save('quota-1', html='<p>' + 'q' * 3000 + '</p>')[0], 200)
                before = files(app.STORE_DIR)
                status, result = self.save('quota-2', html='<p>' + 'r' * 3000 + '</p>')
                self.assertEqual(status, 429, result)
                self.assertEqual(files(app.STORE_DIR), before)
            self.assertIn('oc_storage_quota_exceeded', stderr.getvalue())
            self.assertFalse(app.oc_storage_charge(self.owner(), 2048, 'images-upload'))
        finally:
            app.OC_STORAGE_BUDGET = original

    def test_store_helpers(self):
        self.assertEqual(app.store_data_uri('/assets/uploads/' + 'a' * 64 + '.png'), '/assets/uploads/' + 'a' * 64 + '.png')
        self.assertEqual(app.store_data_uri(''), '')
        legacy = hashlib.md5(b'legacy').hexdigest() + '.html'
        Path(app.STORE_DIR, legacy).write_text('<p>legacy</p>', encoding='utf-8')
        self.assertEqual(app.get_record_html({'html_ref': legacy}), '<p>legacy</p>')
        for ref in ('../users.db', '/etc/passwd', legacy + '/..', 'A' * 32 + '.html'):
            self.assertEqual(app.get_record_html({'html_ref': ref}), '')
        with self.assertRaises(app.ShowcaseTooLarge):
            app.store_showcase_html('z' * (app.SHOWCASE_HTML_LIMIT + 1))
        with self.assertRaises(ValueError):
            app.store_showcase_html(['not', 'html'])


if __name__ == '__main__':
    unittest.main()
