"""Regression: a peer reset must end the keep-alive loop instead of spinning it.

Root cause of the portal's intermittent CPU spin: BaseStaticHandler.handle_one_request swallowed
ConnectionResetError but left close_connection False, so BaseHTTPRequestHandler.handle() called
handle_one_request again; on Windows every further recv() on a reset socket raises again at once,
giving a tight loop (~20 microseconds per turn, 50k+ socket calls/s, one thread per reset peer).

Run:  python services/platform/tests/test_connection_reset_loop.py
Check a different copy of base_static.py:  BASE_STATIC_PATH=<file> python services/platform/tests/test_connection_reset_loop.py
"""
import http.server
import importlib.util
import os
import socket
import struct
import sys
import threading
import time
import unittest
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))
_path = Path(os.environ.get("BASE_STATIC_PATH", SERVER_DIR / "base_static.py"))
_spec = importlib.util.spec_from_file_location("base_static_under_test", _path)
base_static = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(base_static)


class CountingHandler(base_static.BaseStaticHandler):
    protocol_version = "HTTP/1.1"
    loops = 0
    lock = threading.Lock()
    done = threading.Event()

    def handle_one_request(self):
        with CountingHandler.lock:
            CountingHandler.loops += 1
        super().handle_one_request()

    def handle(self):
        try:
            super().handle()
        finally:
            CountingHandler.done.set()

    def do_GET(self):
        body = b"ok"
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


class ConnectionLifecycleTests(unittest.TestCase):
    def setUp(self):
        CountingHandler.loops = 0
        CountingHandler.done.clear()
        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), CountingHandler)
        self.server.daemon_threads = True
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.port = self.server.server_address[1]

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()

    def connect(self):
        return socket.create_connection(("127.0.0.1", self.port), timeout=5)

    @staticmethod
    def request(sock, path="/", extra=""):
        sock.sendall(("GET %s HTTP/1.1\r\nHost: t\r\n%s\r\n" % (path, extra)).encode())
        data = b""
        while b"\r\n\r\nok" not in data:
            chunk = sock.recv(4096)
            if not chunk:
                break
            data += chunk
        return data

    def assert_handler_exits(self, label, requests=0):
        # One loop turn per real request, plus a few for the final read that observes the close.
        limit = requests + 5
        self.assertTrue(CountingHandler.done.wait(3), "%s: handler thread did not exit (loops=%d)" % (label, CountingHandler.loops))
        self.assertLessEqual(CountingHandler.loops, limit, "%s: request loop spun (%d iterations for %d requests)" % (label, CountingHandler.loops, requests))

    def test_peer_reset_after_keepalive_request_ends_loop(self):
        # The production failure: keep-alive connection, then the peer aborts (RST).
        sock = self.connect()
        self.assertIn(b"200 OK", self.request(sock))
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER, struct.pack("ii", 1, 0))
        sock.close()
        self.assert_handler_exits("RST after keep-alive request")
        time.sleep(0.3)
        self.assertLess(CountingHandler.loops, 10)

    def test_peer_reset_before_any_request(self):
        sock = self.connect()
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER, struct.pack("ii", 1, 0))
        sock.close()
        self.assert_handler_exits("RST before first request")

    def test_graceful_close_after_keepalive(self):
        sock = self.connect()
        self.request(sock)
        sock.close()
        self.assert_handler_exits("FIN after keep-alive request")

    def test_half_close_after_request(self):
        sock = self.connect()
        self.request(sock)
        sock.shutdown(socket.SHUT_WR)
        self.assert_handler_exits("half-close (client FIN, still reading)")
        sock.close()

    def test_malformed_request_line_closes(self):
        sock = self.connect()
        sock.sendall(b"NOT A VALID REQUEST\r\n\r\n")
        sock.settimeout(3)
        try:
            sock.recv(4096)
        except OSError:
            pass
        self.assert_handler_exits("malformed request")
        sock.close()

    def test_keepalive_serves_many_requests_on_one_connection(self):
        sock = self.connect()
        for index in range(25):
            self.assertIn(b"200 OK", self.request(sock, "/?n=%d" % index))
        self.assertGreaterEqual(CountingHandler.loops, 25)
        self.assertFalse(CountingHandler.done.is_set(), "connection must stay open between requests")
        sock.close()
        self.assert_handler_exits("normal close after 25 requests", requests=25)

    def test_rapid_repeated_requests_are_all_answered(self):
        sock = self.connect()
        burst = b"".join(b"GET /?r=%d HTTP/1.1\r\nHost: t\r\n\r\n" % i for i in range(50))
        sock.sendall(burst)
        data = b""
        deadline = time.time() + 5
        while data.count(b"200 OK") < 50 and time.time() < deadline:
            chunk = sock.recv(65536)
            if not chunk:
                break
            data += chunk
        self.assertEqual(data.count(b"200 OK"), 50)
        sock.close()
        self.assert_handler_exits("pipelined burst", requests=50)

    def test_idle_timeout_ends_connection(self):
        class Short(CountingHandler):
            timeout = 0.5
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Short)
        server.daemon_threads = True
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            CountingHandler.loops = 0
            CountingHandler.done.clear()
            sock = socket.create_connection(("127.0.0.1", server.server_address[1]), timeout=5)
            self.assertIn(b"200 OK", self.request(sock))
            self.assertTrue(CountingHandler.done.wait(3), "idle keep-alive connection was not closed by timeout")
            self.assertLess(CountingHandler.loops, 10)
            sock.close()
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    print("base_static under test:", _path)
    unittest.main(verbosity=2)
