"""Check the OAuth callback boundary with synthetic provider results; no network or DB."""
import contextlib
import os
from pathlib import Path
import sys
import tempfile
import time
import unittest
from unittest.mock import MagicMock, patch

HALL = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(HALL), str(HALL.parents[1] / "services" / "platform")]


class UserInfoSubjectTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = contextlib.ExitStack()
        cls.addClassCleanup(cls.fixture.close)
        root = cls.fixture.enter_context(tempfile.TemporaryDirectory())
        env = {k: v for k, v in os.environ.items() if not k.startswith(("IRIDESCENTLY_", "USSO_", "HX_"))}
        env.update(IRIDESCENTLY_STORAGE_ROOT=root, IRIDESCENTLY_ENVIRONMENT="test")
        cls.fixture.enter_context(patch.dict(os.environ, env, clear=True))
        from storage_paths import initialize_storage
        initialize_storage()
        import server_huiguan
        cls.server = server_huiguan

    def callback(self, result):
        server = self.server
        handler = MagicMock()
        handler._oauth_callback.return_value = "https://hall.example.test/api/callback"
        pending = {"fixture": {"created": time.time(), "callback": handler._oauth_callback.return_value}}
        with patch.multiple(server, USSO_LOGIN_ENABLED=True, OAUTH_STATES=pending,
                            sso_post=MagicMock(return_value={"code": 200, "access_token": "fixture-token"}),
                            sso_get_userinfo=MagicMock(return_value={"code": 200, "data": result}),
                            get_flag=MagicMock(return_value=None), upsert_user=MagicMock(),
                            request_root=MagicMock(return_value="example.test"),
                            create_session=MagicMock(return_value="fixture-session")):
            server.Handler._api_callback(handler, {"code": ["fixture-code"], "state": ["fixture"]})
            return handler, server.get_flag, server.upsert_user, server.create_session

    def test_invalid_subject_stops_before_account_or_session_access(self):
        for subject in (None, True, 1.25, {}, [], "", "two words", "O’Connor", "acct:west", "user\n", "x" * 256):
            with self.subTest(subject=subject):
                handler, look_up, write, session = self.callback({"id": subject})
                self.assertEqual(handler._json.call_args.args[0], 502)
                look_up.assert_not_called()
                write.assert_not_called()
                session.assert_not_called()

    def test_numeric_and_opaque_subjects_keep_their_identity(self):
        for result, expected in [({"id": 7}, "7"), ({"id": "007"}, "007"), ({"sub": "person_abc-123"}, "person_abc-123")]:
            with self.subTest(result=result):
                handler, look_up, write, session = self.callback(result)
                handler.send_response.assert_called_once_with(302)
                look_up.assert_called_once_with("usso", expected)
                self.assertEqual(write.call_args.args[0], expected)
                session.assert_called_once_with("usso", expected, "example.test")


if __name__ == "__main__":
    unittest.main()
