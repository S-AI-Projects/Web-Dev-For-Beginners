import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from example import demo, validate


class LaunchConfigExampleTests(unittest.TestCase):
    def test_missing_command_is_invalid(self):
        result = validate({"args": [], "env": {}})
        self.assertFalse(result["valid"])
        self.assertIn("command must be a non-empty string", result["errors"])

    def test_argument_boundary_rejects_a_single_string(self):
        result = validate({"command": "python3", "args": "-m http.server", "env": {}})
        self.assertFalse(result["valid"])
        self.assertIn("args must be an array of strings", result["errors"])

    def test_valid_inputs_map_to_redacted_non_launching_output(self):
        result = validate(
            {
                "command": "python3",
                "args": ["-m", "http.server", "8000"],
                "env": {"API_TOKEN": "local-demo-secret"},
            }
        )
        self.assertTrue(result["valid"])
        self.assertEqual(result["summary"]["environment"], {"API_TOKEN": "[REDACTED]"})
        self.assertNotIn("local-demo-secret", json.dumps(result))
        self.assertFalse(result["launched"])

    def test_demo_covers_all_contract_cases_without_echoing_secret(self):
        cases = demo()
        self.assertEqual(len(cases), 3)
        self.assertFalse(cases[0]["output"]["valid"])
        self.assertFalse(cases[1]["output"]["valid"])
        self.assertTrue(cases[2]["output"]["valid"])
        self.assertNotIn("local-demo-secret", json.dumps(cases))

    def test_deliberately_wrong_unittest_result_is_nonzero(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            probe = Path(temp_dir) / "test_wrong_result.py"
            probe.write_text(
                "import unittest\nclass WrongResult(unittest.TestCase):\n"
                " def test_wrong(self): self.assertEqual('actual', 'wrong')\n",
                encoding="utf-8",
            )
            run = subprocess.run(
                [sys.executable, "-m", "unittest", "discover", "-s", temp_dir],
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertNotEqual(run.returncode, 0, run.stdout + run.stderr)


if __name__ == "__main__":
    unittest.main()
