"""模块基线盘点与入口探测 URL 映射的单元测试。"""
import argparse
import contextlib
import ctypes
import io
import json
import os
import subprocess
import sys
import tempfile
import time
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

    def test_collect_refs_accepts_single_quoted_attributes(self):
        """HTML 允许单引号属性；漏读会把真实资源当成不存在，也会漏掉缺失资源。"""
        html = ("<link rel='stylesheet' href='single.css'>"
                "<script src='single.js'></script>"
                "<link rel='icon' href='single.ico'>")
        refs = module_baseline.collect_refs(html)
        self.assertIn(("single.css", False), refs)
        self.assertIn(("single.js", False), refs)
        self.assertIn(("single.ico", True), refs)

    def test_collect_refs_handles_quotes_inside_values(self):
        html = ('<script src="a\'b.js"></script>'
                "<script src='a\"b.js'></script>")
        refs = [ref for ref, _ in module_baseline.collect_refs(html)]
        self.assertIn("a'b.js", refs)
        self.assertIn('a"b.js', refs)

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
            module_baseline.run_tests(rows, {}, {row["module"] for row in rows},
                                      module_baseline._Budget(module_baseline.TOTAL_TIMEOUT))
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


class TestGlobCoverageTests(unittest.TestCase):
    """``npm test`` 的匹配范围必须覆盖模块里所有的 test 文件。

    cards 曾经因为 glob 只列了部分目录，``src/gate`` 与 ``src/onboarding`` 下的测试没有进
    ``npm test``，盘点计数也跟着少算：矩阵显示通过，实际这些文件根本没跑。
    """

    def _cards_spec(self):
        return next(spec for spec in module_baseline.MODULES if spec["key"] == "cards")

    def test_cards_test_globs_cover_every_ts_test_file_under_src(self):
        module_dir = module_baseline.ROOT / "apps" / "cards"
        on_disk = {path.relative_to(module_dir).as_posix()
                   for path in (module_dir / "src").rglob("*.test.ts")}
        matched = set(module_baseline.count_test_files(module_dir, self._cards_spec()["test_globs"]))
        self.assertEqual(sorted(on_disk - matched), [])

    def test_cards_npm_test_script_runs_the_inventoried_globs(self):
        """盘点用的 glob 与 ``npm test`` 实际匹配范围必须一致，否则矩阵计数不是跑过的范围。"""
        package = json.loads((module_baseline.ROOT / "apps" / "cards" / "package.json")
                             .read_text("utf-8"))
        for pattern in self._cards_spec()["test_globs"]:
            # server/ 由 test:backend 单独跑：同一张矩阵里是「后端单测」这一行。
            script = "test:backend" if pattern.startswith("server/") else "test"
            self.assertIn(pattern, package["scripts"][script])


class CommandTimeoutTests(unittest.TestCase):
    def test_timeout_kills_the_whole_process_tree(self):
        """npm 会派生 node：超时后孙进程也要一起终止，不能留下还在跑的测试。"""
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            tmp = Path(tmp)
            heartbeat = tmp / "heartbeat"
            beat = tmp / "beat.py"
            beat.write_text("import sys, time\n"
                            "for _ in range(600):\n"
                            "    open(sys.argv[1], 'a').write('x')\n"
                            "    time.sleep(0.1)\n", encoding="utf-8")
            outer = tmp / "outer.py"
            outer.write_text("import subprocess, sys, time\n"
                             f"subprocess.Popen([sys.executable, {str(beat)!r}, {str(heartbeat)!r}])\n"
                             "time.sleep(60)\n", encoding="utf-8")
            started = time.monotonic()
            result = module_baseline.run([sys.executable, str(outer)], dict(os.environ), timeout=2)
            self.assertEqual(result["status"], module_baseline.FAIL)
            self.assertEqual(result["timeout"], 2)
            self.assertIn("未结束", result["error"])
            self.assertLess(time.monotonic() - started, 30)
            size = heartbeat.stat().st_size
            time.sleep(1.2)
            self.assertEqual(heartbeat.stat().st_size, size, "孙进程仍在运行")

    def test_detached_job_falls_back_to_killing_the_child(self):
        """job 没接管进程（创建/分配失败）时不能空等 KILL_TIMEOUT，要直接杀子进程。"""

        class DetachedJob:
            def terminate(self):
                raise AssertionError("未接管的 job 不应被使用")

            def attached(self):
                return False

        with tempfile.TemporaryFile() as output:
            process = module_baseline._start(
                [sys.executable, "-c", "import time; time.sleep(30)"], dict(os.environ), output)
            started = time.monotonic()
            module_baseline._terminate(process, DetachedJob())
        self.assertLess(time.monotonic() - started, module_baseline.KILL_TIMEOUT)

    def test_exit_code_and_output_tail_are_still_reported(self):
        result = module_baseline.run([sys.executable, "-c", "print('ok')"], dict(os.environ))
        self.assertEqual(result["status"], module_baseline.PASS)
        self.assertEqual(result["exit_code"], 0)
        self.assertEqual(result["tail"], ["ok"])
        self.assertNotIn("timeout", result)

    def test_markdown_says_a_test_timed_out_instead_of_failed(self):
        rows = module_baseline.inventory()
        rows[0].update({"unit": module_baseline.FAIL, "unit_timeout": module_baseline.COMMAND_TIMEOUT,
                        "unit_detail": f"超过 {module_baseline.COMMAND_TIMEOUT}s 未结束，已终止整棵进程树"})
        text = module_baseline.markdown(rows, None)
        self.assertIn("单测超时", text)


class BudgetTests(unittest.TestCase):
    def test_a_command_never_gets_more_time_than_the_budget_has_left(self):
        budget = module_baseline._Budget(5)
        self.assertLessEqual(budget.take(), 5)
        self.assertLess(budget.take(), module_baseline.COMMAND_TIMEOUT)
        self.assertFalse(budget.exhausted)

    def test_exhausted_budget_starts_no_command_and_marks_the_run_incomplete(self):
        rows = module_baseline.inventory()
        for row in rows:
            row["dependencies_installed"] = True
        budget = module_baseline._Budget(0)
        with patch.object(module_baseline, "run") as fake:
            module_baseline.run_tests(rows, {}, {row["module"] for row in rows}, budget)
        fake.assert_not_called()
        self.assertTrue(budget.exhausted)
        # 预算耗尽时既不伪造 PASS/FAIL，也不把 unit 改成别的状态：保持 NOT RUN。
        self.assertTrue(all(row["unit"] == module_baseline.NOT_RUN for row in rows))
        self.assertIn("预算", module_baseline.markdown(rows, None, budget))

    def test_command_timeout_can_be_set_from_the_command_line(self):
        budget = module_baseline._Budget(60, 30)
        self.assertLessEqual(budget.take(), 30)

    def test_time_options_reject_non_positive_values(self):
        self.assertEqual(module_baseline.positive_seconds("45"), 45)
        for text in ("0", "-5"):
            with self.assertRaises(argparse.ArgumentTypeError):
                module_baseline.positive_seconds(text)

    def test_main_hands_the_time_options_to_the_budget(self):
        seen = {}

        def fake_build(rows, env, root, budget):
            seen["budget"] = budget
            return None

        with patch.object(module_baseline, "inventory", return_value=[]), \
                patch.object(module_baseline, "_version", return_value="v22"), \
                patch.object(module_baseline, "run_build", side_effect=fake_build), \
                patch.object(module_baseline, "run_tests"), \
                contextlib.redirect_stdout(io.StringIO()):
            module_baseline.main(["--run", "--command-timeout", "7", "--total-timeout", "70"])
        self.assertEqual(seen["budget"].command_timeout, 7)
        self.assertEqual(seen["budget"].seconds, 70)

    def test_a_command_cap_larger_than_the_budget_is_clamped_not_rejected(self):
        """--command-timeout 600 + --total-timeout 300 合法：总预算是硬上限，命令只拿 300 秒。"""
        self.assertEqual(module_baseline._Budget(300, 600).take(), 300)

    def test_total_timeout_alone_is_not_rejected(self):
        """只给 --total-timeout 时默认命令上限更大，main 不能因此报错。"""
        with patch.object(module_baseline, "inventory", return_value=[]), \
                patch.object(module_baseline, "_version", return_value="v22"), \
                contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(module_baseline.main(["--total-timeout", "300"]), 0)

    def test_build_is_not_started_when_the_budget_is_gone(self):
        # 0 秒是测试夹具，表示「截止时间已过」这种运行中真实会到达的状态；
        # positive_seconds 只校验命令行输入，不约束内部构造。
        rows = module_baseline.inventory()
        budget = module_baseline._Budget(0)
        with patch.object(module_baseline, "run") as fake:
            self.assertIsNone(module_baseline.run_build(rows, {}, Path("unused"), budget))
        fake.assert_not_called()


class WindowsJobTests(unittest.TestCase):
    def test_job_creation_failure_warns_once_and_falls_back(self):
        """job 建不起来时要明确警告，而不是无声地只杀直接子进程。"""

        class FakeKernel32:
            def CreateJobObjectW(self, attributes, name):
                return 0

            def AssignProcessToJobObject(self, handle, process):
                raise AssertionError("句柄为 0 时不应分配进程")

        stderr = io.StringIO()
        with patch.object(ctypes, "WinDLL", create=True, return_value=FakeKernel32()), \
                patch.object(ctypes, "get_last_error", create=True, return_value=5), \
                patch.object(module_baseline._WindowsJob, "_warned", False), \
                contextlib.redirect_stderr(stderr):
            job = module_baseline._WindowsJob(object())
            module_baseline._WindowsJob(object())  # 第二轮不应重复刷警告
        self.assertFalse(job.attached())
        self.assertEqual(stderr.getvalue().count("job 对象"), 1)


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
