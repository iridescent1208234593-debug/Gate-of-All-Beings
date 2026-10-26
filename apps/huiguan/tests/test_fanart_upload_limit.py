"""Fan-art uploads (incl. GIF) may be up to 8MB; other uploads keep the 5MB GIF cap."""

import io
import sys
import unittest
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server_huiguan import IMAGE_LIMIT, validate_image


def gif_of_size(size):
    buf = io.BytesIO()
    Image.new("P", (8, 8)).save(buf, "GIF")
    raw = buf.getvalue()
    return raw + b"\0" * (size - len(raw))  # trailing bytes after the GIF trailer are ignored by decoders


class FanartUploadLimitTest(unittest.TestCase):
    def test_six_mb_gif_needs_the_fanart_limit(self):
        raw = gif_of_size(6 * 1024 * 1024)
        with self.assertRaisesRegex(ValueError, "5MB"):
            validate_image(raw, "image/gif")
        validate_image(raw, "image/gif", gif_limit=IMAGE_LIMIT)

    def test_nothing_above_eight_mb(self):
        with self.assertRaisesRegex(ValueError, "8MB"):
            validate_image(gif_of_size(IMAGE_LIMIT + 1), "image/gif", gif_limit=IMAGE_LIMIT)


if __name__ == "__main__":
    unittest.main()
