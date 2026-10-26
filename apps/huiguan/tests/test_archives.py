"""Archive structure: 官方角色档案 has 主册 + 副册; 同人角色档案 stays its own single archive."""

import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from server_huiguan import ARCHIVES


class ArchivesTest(unittest.TestCase):
    def test_official_archive_has_main_and_side_volume(self):
        official, fan = ARCHIVES
        self.assertEqual(official["title"], "官方角色档案")
        self.assertEqual([(v["label"], v["title"], v["page"]) for v in official["volumes"]],
                         [("主册", "官方角色档案", "/gallery.html"), ("副册", "官方角色同人画廊", "/works.html")])
        self.assertEqual(fan["title"], "同人角色档案")
        self.assertEqual([v["page"] for v in fan["volumes"]], ["/fan.html"])

    def test_official_volume_pages_render_the_volume_switcher(self):
        for v in ARCHIVES[0]["volumes"]:
            page = (HERE / v["page"].lstrip("/")).read_text(encoding="utf-8")
            self.assertIn(f'data-archive-volume="{v["key"]}"', page, v["page"])
            self.assertIn("archive-volumes.js", page, v["page"])

    def test_fan_archive_keeps_its_own_names(self):
        fan = (HERE / "fan.html").read_text(encoding="utf-8")
        self.assertIn("<h1>同人画廊</h1>", fan)
        self.assertNotIn("data-archive-volume", fan)
        for name in ("fan.html", "index.html", "relation.html", "member.html", "homepage-content.js"):
            self.assertNotIn("世界观 OC", (HERE / name).read_text(encoding="utf-8"), name)


if __name__ == "__main__":
    unittest.main()
