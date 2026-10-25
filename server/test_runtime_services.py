"""Sealed Node backends run without source node_modules and keep all writes external."""
import hashlib
import http.client
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from contextlib import contextmanager

sys.path.insert(0, str(Path(__file__).resolve().parent))
from testing_storage import configure
from storage_paths import release_root

SOURCE = Path(__file__).resolve().parents[1]


def file_hashes(root):
    return {str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in root.rglob('*') if path.is_file()}


class SealedRuntimeServices(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory(prefix='sealed-runtime-')
        cls.addClassCleanup(cls.temporary.cleanup)
        cls.data = configure(Path(cls.temporary.name) / 'storage')
        cls.site = release_root() / 'store' / 'fixture' / 'site'
        cls.site.joinpath('server').mkdir(parents=True)
        shutil.copy2(SOURCE / 'server' / 'runtime-paths.cjs', cls.site / 'server' / 'runtime-paths.cjs')
        build = 'import {buildRuntime} from "./scripts/build-runtime.mjs"; await buildRuntime(process.argv[1]);'
        subprocess.run(['node', '--input-type=module', '-e', build, str(cls.site)], cwd=SOURCE,
                       env=os.environ.copy(), check=True, capture_output=True, text=True)
        cls.initial = file_hashes(cls.site)

    @contextmanager
    def service(self, relative):
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            port = probe.getsockname()[1]
        environment = dict(os.environ, IRIDESCENTLY_PROJECT_ROOT=str(self.site), PORT=str(port), NODE_PATH='')
        log_path = Path(self.temporary.name) / ('backend-' + str(port) + '.log')
        with log_path.open('wb') as log:
            process = subprocess.Popen(['node', str(self.site / relative)], cwd=self.temporary.name,
                                       env=environment, stdout=log, stderr=subprocess.STDOUT)
            try:
                for _ in range(100):
                    if process.poll() is not None:
                        self.fail(log_path.read_text(encoding='utf-8', errors='replace'))
                    try:
                        if self.request(port, '/healthz')[0] == 200:
                            break
                    except OSError:
                        time.sleep(0.05)
                else:
                    self.fail('backend did not become ready')
                yield port
            finally:
                process.terminate()
                process.wait(timeout=10)
        self.assertEqual(file_hashes(self.site), self.initial, 'runtime modified sealed files')

    @staticmethod
    def request(port, path, method='GET', body=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
        try:
            connection.request(method, path, body=json.dumps(body) if body is not None else None, headers=headers or {})
            response = connection.getresponse()
            return response.status, json.loads(response.read() or '{}')
        finally:
            connection.close()

    def test_balance_api_persists_outside_sealed_release(self):
        with self.service('server/app/src/cards/server/balance-service.mjs') as port:
            status, state = self.request(port, '/api/card-balance')
            self.assertEqual(status, 200)
            value = {'cost': 2, 'effect': {'damage': 17}, 'exhaust': False, 'target': 'single', 'condition': 'none'}
            headers = {'Content-Type': 'application/json', 'Origin': f'http://127.0.0.1:{port}',
                       'X-Card-Admin-Token': state['token']}
            status, saved = self.request(port, '/api/card-balance/cards/claw', 'PUT',
                                         {'revision': state['revision'], 'value': value}, headers)
            self.assertEqual(status, 200, saved)
            self.assertEqual(saved['overrides']['claw'], value)
        stored = json.loads((self.data / 'cards/card-balance/config.json').read_text(encoding='utf-8'))
        self.assertEqual(stored['overrides']['claw']['effect']['damage'], 17)

    def test_spirit_settings_and_multidomain_websocket_boundary(self):
        with self.service('server/app/src/softie-webgpu/server/spirit-service.mjs') as port:
            status, defaults = self.request(port, '/api/spirit-settings')
            self.assertEqual(status, 200)
            defaults['name'] = 'Fixture'
            headers = {'Content-Type': 'application/json', 'Origin': f'http://127.0.0.1:{port}'}
            self.assertEqual(self.request(port, '/api/spirit-settings', 'PUT', defaults, headers)[0], 200)
            for host in ('spirit.iridescently.xyz', 'spirit.iridescently.cn', 'spirit.iridescently.dpdns.org'):
                for origin, expected in (('https://' + host, b'101'), ('https://evil.example', b'403')):
                    with self.subTest(host=host, origin=origin), socket.create_connection(('127.0.0.1', port), timeout=5) as client:
                        client.sendall((f'GET /api/spirit-room/ws HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n'
                                        'Connection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\n'
                                        'Sec-WebSocket-Key: MDEyMzQ1Njc4OWFiY2RlZg==\r\n'
                                        f'X-Forwarded-Host: {host}\r\nX-Forwarded-Proto: https\r\nOrigin: {origin}\r\n\r\n').encode())
                        self.assertEqual(client.recv(4096).split(b' ', 2)[1], expected)
        self.assertEqual(json.loads((self.data / 'spirit/spirit-settings.json').read_text(encoding='utf-8'))['name'], 'Fixture')


if __name__ == '__main__':
    unittest.main()
