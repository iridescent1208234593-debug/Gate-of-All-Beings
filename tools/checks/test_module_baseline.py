"""模块基线盘点与入口探测 URL 映射的单元测试。"""
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "checks"))
import module_baseline  # noqa: E402


class ReferenceTests(unittest.TestCase):
    def test_collect_refs_ignores_navigation_and_flags_favicons(self):
        html = ('<a href="games/spirit-playground">x</a>'
                '<script src="main.js"></script>'
                '<link rel="stylesheet" href="app.css">'
                '<link rel="icon" href="favicon.png">')
        refs = module_baseline.collect_refs(html)
        self.assertIn(("main.js", False), refs)
        self.assertIn(("app.css", False), refs)
        self.assertIn(("favicon.png", True), refs)
        self.assertNotIn("games/spirit-playground", [ref for ref, _ in refs])

    def test_classify_reference_routes(self):
        self.assertEqual(module_baseline.classify_ref("/app/modules/cards/assets/a.js"), "module")
        self.assertEqual(module_baseline.classify_ref("assets/a.js"), "module")
        self.assertEqual(module_baseline.classify_ref("/shared/shared-session/kv.js"), "shared")
        self.assertEqual(module_baseline.classify_ref("/design-system/design-system.css"), "portal")
        self.assertEqual(module_baseline.classify_ref("/api/progress/x"), "portal")
        self.assertEqual(module_baseline.classify_ref("https://example.invalid/a.png"), "external")
        self.assertEqual(module_baseline.classify_ref("//cdn.invalid/a.js"), "external")

    def test_portal_prefix_requires_path_boundary(self):
        # "/assets-mine/x.js" 属于模块路径，不是门户的 "/assets/" 挂载点。
        self.assertEqual(module_baseline.classify_ref("/assets-mine/x.js"), "module")

    def test_relative_parent_ref_stays_a_same_origin_check(self):
        """``../assets/a.js`` 仍是同源引用：要去取，取不到就报缺失；边界由 resolve_url 兜住。"""
        self.assertEqual(module_baseline.classify_ref("../assets/a.js"), "module")
        self.assertEqual(module_baseline.classify_ref("./assets/a.js"), "module")

    def test_query_and_fragment_do_not_change_classification(self):
        """urlsplit 保留相对路径，只把 query/fragment 拆走；分类必须按 path 判断。"""
        self.assertEqual(module_baseline.classify_ref("main.js?v=1"), "module")
        self.assertEqual(module_baseline.classify_ref("main.js?v=1#top"), "module")
        self.assertEqual(module_baseline.classify_ref("/shared/shared-session/kv.js?v=1"), "shared")
        self.assertEqual(module_baseline.classify_ref("/assets/site-language.js?v=20261027z"), "portal")
        self.assertEqual(module_baseline.classify_ref("/app/modules/cards/a.js?v=1"), "module")

    def test_portal_paths_are_exact_and_prefixes_bounded(self):
        """门户只提供几个精确路径；相邻路径不能被误判成门户资源而跳过检查。"""
        self.assertEqual(module_baseline.classify_ref("/avatar-cropper.js"), "portal")
        self.assertEqual(module_baseline.classify_ref("/avatar-cropper.css?v=1"), "portal")
        self.assertEqual(module_baseline.classify_ref("/avatar-cropper.jsx"), "module")
        self.assertEqual(module_baseline.classify_ref("/map"), "portal")
        self.assertEqual(module_baseline.classify_ref("/map/"), "portal")
        self.assertEqual(module_baseline.classify_ref("/map-editor/x.js"), "module")
        self.assertEqual(module_baseline.classify_ref("/assets/site-language.js"), "portal")
        self.assertEqual(module_baseline.classify_ref("/assets/iridescently-mark.png"), "portal")
        self.assertEqual(module_baseline.classify_ref("/assets/module-own.png"), "module")
        self.assertEqual(module_baseline.classify_ref("/assets/uploads/a.png"), "portal")
        self.assertEqual(module_baseline.classify_ref("/design-system/x.css"), "portal")


class ResolveTests(unittest.TestCase):
    """resolve_url 只做词法映射：不访问磁盘就把 URL 换成目标路径。"""

    def setUp(self):
        self.root = Path("C:/baseline")
        self.modules = self.root / "modules"
        self.packages = self.root / "packages"

    def test_entry_and_asset(self):
        self.assertEqual(module_baseline.resolve_url("/app/modules/cards/", self.modules, self.packages),
                         (self.modules / "cards" / "index.html").resolve())
        self.assertEqual(module_baseline.resolve_url("/app/modules/cards/assets/main.js",
                                                     self.modules, self.packages),
                         (self.modules / "cards" / "assets" / "main.js").resolve())

    def test_shared_package(self):
        self.assertEqual(module_baseline.resolve_url("/shared/shared-session/kv.js",
                                                     self.modules, self.packages),
                         (self.packages / "shared-session" / "kv.js").resolve())

    def test_unknown_and_other_roots_are_refused(self):
        self.assertIsNone(module_baseline.resolve_url("/elsewhere/x.js", self.modules, self.packages))
        self.assertIsNone(module_baseline.resolve_url("/app/modules/../../../etc/passwd",
                                                     self.modules, self.packages))
        self.assertIsNone(module_baseline.resolve_url("/shared/../modules/cards/index.html",
                                                     self.modules, self.packages))

    def test_parent_segment_cannot_escape_the_modules_root(self):
        """"/app/modules/../modules.json" 借 .. 读走 modules 之外的文件，必须拒绝。"""
        self.assertIsNone(module_baseline.resolve_url("/app/modules/../modules.json",
                                                     self.modules, self.packages))
        self.assertIsNone(module_baseline.resolve_url("/app/modules/%2e%2e/modules.json",
                                                     self.modules, self.packages))

    def test_parent_segment_inside_the_root_is_normalized(self):
        self.assertEqual(
            module_baseline.resolve_url("/app/modules/cards/../cards/index.html",
                                        self.modules, self.packages),
            (self.modules / "cards" / "index.html").resolve())


class RunTestsIsolationTests(unittest.TestCase):
    def test_extras_run_without_rereading_and_without_a_test_script(self):
        """附加检查复用盘点结果，且在模块没有 test 脚本时仍然执行。"""
        rows = module_baseline.inventory()
        with patch.object(module_baseline, "read_package",
                          side_effect=AssertionError("run_tests 不应重新读取 package.json")), \
                patch.object(module_baseline, "run",
                             return_value={"status": module_baseline.PASS,
                                           "command": ["npm", "run", "x"], "seconds": 0.0}):
            module_baseline.run_tests(rows, {}, {row["module"] for row in rows})
        by_key = {row["module"]: row for row in rows}
        self.assertEqual(sorted(by_key["cards"]["extra_results"]), ["后端单测", "类型检查"])
        self.assertEqual(by_key["world-map"]["unit"], module_baseline.SKIP)
        self.assertEqual(by_key["world-map"]["extra_results"]["类型检查"]["status"], module_baseline.PASS)


class StatusTests(unittest.TestCase):
    def test_exit_codes_become_pass_or_fail(self):
        self.assertEqual(module_baseline.classify_exit(0), module_baseline.PASS)
        self.assertEqual(module_baseline.classify_exit(1), module_baseline.FAIL)
        self.assertNotEqual(module_baseline.SKIP, module_baseline.PASS)

    def test_zero_dependency_module_needs_no_install(self):
        self.assertTrue(module_baseline.dependencies_installed("juling", {"dependencies": {}}))
        self.assertTrue(module_baseline.dependencies_installed("aeon", {}))

    def test_every_module_is_inventoried_with_four_fields(self):
        rows = module_baseline.inventory()
        self.assertEqual([row["module"] for row in rows],
                         ["cards", "management", "ecology", "juling", "aeon", "world-map", "slay", "softie"])
        for row in rows:
            self.assertEqual(row["build"], module_baseline.NOT_RUN)
            self.assertEqual(row["unit"], module_baseline.NOT_RUN)
            self.assertEqual(row["entry_check"], module_baseline.NOT_RUN)
            self.assertIn("entry_present", row)
        # 每行的 notes 都是独立列表，追加提示不会串到别的模块
        self.assertIsNot(rows[0]["notes"], rows[1]["notes"])

    def test_markdown_matrix_has_one_row_per_module(self):
        rows = module_baseline.inventory()
        text = module_baseline.markdown(rows, None)
        # 表头 + 分隔行 + 每个模块一行
        self.assertEqual(len([line for line in text.splitlines() if line.startswith("| ")]), len(rows) + 2)


class VersionTests(unittest.TestCase):
    def test_version_probe_has_a_timeout(self):
        with patch.object(module_baseline.subprocess, "run") as fake:
            fake.return_value.stdout = "v22.17.0\n"
            self.assertEqual(module_baseline._version(["node", "--version"]), "v22.17.0")
            self.assertEqual(fake.call_args.kwargs.get("timeout"), 5)

    def test_hang_or_missing_tool_returns_none(self):
        """版本探测卡住或没有该程序时返回 None，而不是让整张矩阵阻塞。"""
        with patch.object(module_baseline.subprocess, "run",
                          side_effect=subprocess.TimeoutExpired(["node", "--version"], 5)):
            self.assertIsNone(module_baseline._version(["node", "--version"]))
        with patch.object(module_baseline.subprocess, "run", side_effect=OSError("no node")):
            self.assertIsNone(module_baseline._version(["node", "--version"]))


if __name__ == "__main__":
    unittest.main()
