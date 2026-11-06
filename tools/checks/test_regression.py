"""Focused tests for the regression runner's machine-readable results."""
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "checks"))
import regression  # noqa: E402


class RegressionResultTests(unittest.TestCase):
    def test_failed_child_has_parseable_status_and_command(self):
        results = []
        with patch.object(regression.subprocess, "run",
                          return_value=subprocess.CompletedProcess(["fake-check"], 7)):
            regression.run_check(results, "broken", ["fake-check", "--case", "x"])

        summary = json.loads(json.dumps({"checks": results}))
        self.assertEqual(summary["checks"][0]["status"], "failed")
        self.assertFalse(summary["checks"][0]["passed"])
        self.assertEqual(summary["checks"][0]["command"], ["fake-check", "--case", "x"])
        self.assertEqual(summary["checks"][0]["exit_code"], 7)

    def test_runner_exception_is_recorded_as_failed(self):
        results = []
        with patch.object(regression.subprocess, "run", side_effect=OSError("not found")):
            regression.run_check(results, "missing", ["missing-check"])

        self.assertEqual(results[0]["status"], "failed")
        self.assertEqual(results[0]["command"], ["missing-check"])
        self.assertIn("not found", results[0]["error"])
        self.assertNotIn("SECRET", json.dumps(results))


if __name__ == "__main__":
    unittest.main()
