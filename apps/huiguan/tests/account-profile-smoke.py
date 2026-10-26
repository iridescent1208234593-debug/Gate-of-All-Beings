import io
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services" / "platform"))
from account_profile import (  # noqa: E402
    get_profile,
    open_db,
    resolve_sso_identity,
    set_account_avatar,
    set_gate_identity,
    store_avatar_image,
    valid_asset_url,
)


class AccountProfileSmoke(unittest.TestCase):
    def test_profile_layers_are_isolated_and_schema_is_idempotent(self):
        with tempfile.TemporaryDirectory() as temporary:
            conn = open_db(temporary)
            conn.execute("CREATE TABLE local_users (uid INTEGER PRIMARY KEY, username TEXT, nickname TEXT, picture TEXT, status TEXT)")
            conn.execute("INSERT INTO local_users VALUES (1,'linlin','Lin','provider.png','active')")
            conn.commit()
            account_avatar = "/assets/uploads/" + "a" * 64 + ".jpg"
            identity = {"schema_version": 1, "display_name": "Gate Lin", "species_name": "猫妖", "avatar_asset_id": "", "avatar_frame_id": "frame-a", "avatar_mode": "default", "source_oc_id": "oc-a"}
            set_account_avatar(conn, "local", 1, account_avatar, "now")
            set_gate_identity(conn, "local", 1, identity, "now")
            conn.commit()
            conn.close()

            # The shared-session resolver applies the same (kind, uid) key.
            conn = open_db(temporary)
            conn.execute("CREATE TABLE IF NOT EXISTS local_users (uid INTEGER PRIMARY KEY, username TEXT, nickname TEXT, picture TEXT, status TEXT)")
            conn.commit()
            conn.close()
            resolved = resolve_sso_identity({"kind": "local", "uid": "1", "name": "stale"}, temporary)
            self.assertEqual(resolved["account_avatar_url"], account_avatar)
            self.assertEqual(resolved["gate_identity"]["display_name"], "Gate Lin")
            self.assertEqual(resolved["picture"], "provider.png")
            self.assertIsNone(resolve_sso_identity({"kind": "local", "uid": "2"}, temporary))
            self.assertTrue(valid_asset_url(account_avatar))

    def test_avatar_is_square_normalized_and_invalid_file_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = Image.new("RGB", (800, 400), (112, 64, 32))
            buffer = io.BytesIO()
            source.save(buffer, format="JPEG", exif=b"Exif\x00\x00test")
            ref = store_avatar_image(buffer.getvalue(), "image/jpeg", temporary)
            self.assertTrue(valid_asset_url(ref))
            stored = Path(temporary) / "apps" / "huiguan" / ref.lstrip("/").replace("/", "\\")
            with Image.open(stored) as image:
                self.assertEqual(image.width, image.height)
                self.assertLessEqual(image.width, 512)
                self.assertFalse(image.getexif())
            with self.assertRaises(ValueError):
                store_avatar_image(b"<svg/>", "image/svg+xml", temporary)


if __name__ == "__main__":
    unittest.main(verbosity=2)
