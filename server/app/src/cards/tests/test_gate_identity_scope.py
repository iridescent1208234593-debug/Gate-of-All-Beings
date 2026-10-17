"""Gate draft owner guard, against the real handler with no real account/database access."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import Mock, patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen


PROJECT = Path(__file__).resolve().parents[5]
SOURCE = Path(__file__).resolve().parents[1] / "server.py"


class FakeConnection:
    def __init__(self):
        self.commit = Mock()
        self.close = Mock()


class GateIdentityScopeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory(prefix="gate-identity-scope-")
        cls.addClassCleanup(cls.temporary.cleanup)
        root = Path(cls.temporary.name)
        # server.py initializes only its legacy users table at import. Keep even
        # that unrelated side effect inside a disposable test project.
        (root / "server" / "app" / "src" / "cards").mkdir(parents=True)
        cls.environment = patch.dict(os.environ, {
            "IRIDESCENTLY_PROJECT_ROOT": str(root),
            "IRIDESCENTLY_ENVIRONMENT": "development",
            "HX_SSO_SECRET": "test-only-not-a-production-secret",
        })
        cls.environment.start()
        cls.addClassCleanup(cls.environment.stop)
        cls.path_before = list(sys.path)
        sys.path.insert(0, str(PROJECT / "server"))
        cls.addClassCleanup(lambda: sys.path.__setitem__(slice(None), cls.path_before))
        spec = importlib.util.spec_from_file_location("gate_identity_scope_test_server", SOURCE)
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)
        assert cls.module.PROJECT_ROOT == str(root)

    def setUp(self):
        module = self.module
        self.connection = FakeConnection()
        self.open_db = Mock(return_value=self.connection)
        self.write = Mock()
        self.upload = Mock(return_value="/assets/uploads/" + "a" * 64 + ".webp")
        self.fixtures = {
            uid: {"kind": "local", "uid": uid, "name": f"Player {uid}", "picture": "", "account_avatar_url": "", "gate_identity": {"schema_version": 1, "display_name": f"Saved {uid}", "species_name": "猫妖", "avatar_asset_id": "", "avatar_frame_id": "r02", "avatar_mode": "default", "source_oc_id": ""}}
            for uid in ("A", "B")
        }
        # A synthetic header is understood ONLY by this patched test resolver.
        # Production _shared_user and actual hx_sso verification are untouched.
        patches = [
            patch.object(module, "_shared_user", side_effect=lambda handler: copy.deepcopy(self.fixtures.get(handler.headers.get("X-Test-Account")))),
            patch.object(module, "open_profile_db", self.open_db),
            patch.object(module, "set_gate_identity", self.write),
            patch.object(module, "normalize_avatar_image", self.upload),
        ]
        for replacement in patches:
            replacement.start()
            self.addCleanup(replacement.stop)

        class QuietHandler(module.OAuthHandler):
            def log_message(self, *_args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_port}"
        self.addCleanup(self.stop_server)

    def stop_server(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def request(self, account="A", identity=None, multipart=False):
        headers = {}
        if account:
            headers["X-Test-Account"] = account
        body = None
        if identity is not None:
            if multipart:
                boundary = "gate-test-boundary"
                body = (f'--{boundary}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n'.encode()
                        + json.dumps(identity).encode()
                        + f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="avatar.webp"\r\nContent-Type: image/webp\r\n\r\n'.encode()
                        + b"test-image-payload"
                        + f"\r\n--{boundary}--\r\n".encode())
                headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
            else:
                body = json.dumps(identity).encode()
                headers["Content-Type"] = "application/json"
        request = Request(self.base + "/api/gate/identity", data=body, headers=headers)
        try:
            response = urlopen(request, timeout=3)
        except HTTPError as error:
            response = error
        with response:
            return response.status, json.load(response)

    @staticmethod
    def draft(owner="A", guard=True):
        identity = {"schema_version": 1, "display_name": "  新旅人  ", "species_name": "  银杏妖  ", "avatar_asset_id": "", "avatar_frame_id": "r03", "avatar_mode": "default", "source_oc_id": ""}
        if guard:
            identity["expected_owner"] = {"kind": "local", "user_id": owner}
        return identity

    def assert_no_persistence(self):
        self.open_db.assert_not_called()
        self.write.assert_not_called()
        self.upload.assert_not_called()

    def test_get_returns_the_current_profile_owner(self):
        for uid in ("A", "B"):
            with self.subTest(uid=uid):
                status, result = self.request(account=uid)
                self.assertEqual(status, 200)
                self.assertEqual(result["owner"], {"kind": "local", "user_id": uid})
                self.assertEqual(result["identity"]["display_name"], f"Saved {uid}")
        self.assert_no_persistence()

    def test_matching_owner_saves_only_the_current_account(self):
        status, result = self.request(account="A", identity=self.draft())
        self.assertEqual(status, 200)
        self.assertEqual(result["owner"], {"kind": "local", "user_id": "A"})
        self.write.assert_called_once()
        connection, kind, uid, saved, _timestamp = self.write.call_args.args
        self.assertIs(connection, self.connection)
        self.assertEqual((kind, uid), ("local", "A"))
        self.assertEqual((saved["display_name"], saved["species_name"]), ("新旅人", "银杏妖"))
        self.assertNotIn("expected_owner", saved)
        self.connection.commit.assert_called_once()
        self.connection.close.assert_called_once()
        self.upload.assert_not_called()

    def test_stale_a_draft_with_b_session_is_rejected_without_write(self):
        status, _result = self.request(account="B", identity=self.draft(owner="A"))
        self.assertEqual(status, 409)
        self.assert_no_persistence()

    def test_stale_multipart_upload_is_rejected_before_image_storage(self):
        status, _result = self.request(account="B", identity=self.draft(owner="A"), multipart=True)
        self.assertEqual(status, 409)
        self.assert_no_persistence()

    def test_matching_multipart_owner_keeps_upload_working(self):
        status, result = self.request(account="B", identity=self.draft(owner="B"), multipart=True)
        self.assertEqual(status, 200)
        self.upload.assert_called_once_with(b"test-image-payload", "image/webp", self.module.PROJECT_ROOT)
        self.assertEqual(result["identity"]["avatar_mode"], "upload")
        self.assertEqual(self.write.call_args.args[1:3], ("local", "B"))

    def test_anonymous_post_is_unauthorized_without_write(self):
        status, _result = self.request(account=None, identity=self.draft())
        self.assertEqual(status, 401)
        self.assert_no_persistence()
        status, result = self.request(account=None)
        self.assertEqual(status, 200)
        self.assertFalse(result["logged_in"])
        self.assertIsNone(result["owner"])

    def test_older_client_without_expected_owner_remains_compatible(self):
        status, result = self.request(account="B", identity=self.draft(guard=False))
        self.assertEqual(status, 200)
        self.assertEqual(result["owner"], {"kind": "local", "user_id": "B"})
        self.assertEqual(self.write.call_args.args[1:3], ("local", "B"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
