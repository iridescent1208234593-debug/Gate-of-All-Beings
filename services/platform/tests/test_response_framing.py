"""Run with python services/platform/tests/test_response_framing.py; uses only a loopback server.

An HTTP/1.1 reply with neither Content-Length nor chunked encoding has no end, so a client
waits for the idle timeout (a POST to an unknown Huiguan route hung for 30 s). Every such reply
from BaseStaticHandler must close the connection; framed replies keep the connection open.
"""
import http.server
from pathlib import Path
import socket
import sys
import threading
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from base_static import BaseStaticHandler


class Handler(BaseStaticHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    def do_POST(self):
        if self.path == "/framed":
            self.send_response(404)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        # The shape of the Huiguan fallthrough before the fix: no length, no body.
        self.send_response(404)
        self.end_headers()


def exchange(port, path, timeout=5):
    started = time.monotonic()
    with socket.create_connection(("127.0.0.1", port), timeout=timeout) as connection:
        connection.sendall(f"POST {path} HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 0\r\n\r\n".encode())
        wire = b""
        try:
            while chunk := connection.recv(65536):
                wire += chunk
        except socket.timeout:
            return wire, None
    return wire, time.monotonic() - started


def main():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        wire, elapsed = exchange(server.server_port, "/unknown-route")
        assert wire.startswith(b"HTTP/1.1 404"), wire[:40]
        assert elapsed is not None and elapsed < 2, "unframed reply left the connection open"
        assert b"\r\nConnection: close\r\n" in wire, wire
        wire, elapsed = exchange(server.server_port, "/framed", timeout=1)
        assert wire.startswith(b"HTTP/1.1 404") and elapsed is None, "framed reply should keep the connection alive"
        assert b"Connection: close" not in wire
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
    print("PASS: unframed replies close the connection; framed replies keep it alive")


if __name__ == "__main__":
    main()
