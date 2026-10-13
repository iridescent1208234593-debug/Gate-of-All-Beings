"""Run with python server/test_static_security.py; uses only temporary files."""
import http.client
import http.server
from pathlib import Path
import tempfile
import threading
from base_static import BaseStaticHandler, static_allowed


def main():
    for path in ("/users.db", "/USERS.DB", "/users.db-wal", "/%2eenv.local", "/%2egit/config", "/characters%2ejson", "/GAME_SAVES.JSON", "/node_modules/package/index.js", "/private.PEM"):
        assert not static_allowed(path), path
    for path in ("/assets/homepage/homepage.js", "/assets/gallery/image.png", "/shared/shared-session/session.js"):
        assert static_allowed(path), path
    with tempfile.TemporaryDirectory() as directory:
        Path(directory, "users.db").write_bytes(b"private test fixture")
        class Handler(BaseStaticHandler):
            _static_dir = directory
            def log_message(self, *args):
                pass
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            for method in ("GET", "HEAD"):
                for path in ("/users.db", "/USERS.DB", "/users%2edb"):
                    connection = http.client.HTTPConnection("127.0.0.1", server.server_port)
                    connection.request(method, path)
                    response = connection.getresponse()
                    assert response.status == 404, (method, path, response.status)
                    response.read()
                    connection.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()
    print("PASS: static sensitive files blocked for decoded/case variants, GET and HEAD")


if __name__ == "__main__":
    main()
