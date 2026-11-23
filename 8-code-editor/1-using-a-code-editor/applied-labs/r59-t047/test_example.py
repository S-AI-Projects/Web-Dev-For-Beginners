import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from example import demo, validate_launch_config


class LaunchConfigTests(unittest.TestCase):
    def test_missing_command_fails_with_explanation(self):
        result = validate_launch_config({"args": [], "env": {}})
        self.assertFalse(result["valid"])
        self.assertIn("command must be a non-empty string", result["errors"])
        self.assertFalse(result["launched"])

    def test_string_is_not_accepted_as_argument_array(self):
        result = validate_launch_config(
            {"command": "python3", "args": "-m http.server", "env": {}}
        )
        self.assertFalse(result["valid"])
        self.assertIn("args must be an array of strings", result["errors"])

    def test_valid_config_summarizes_names_and_redacts_values(self):
        secret = "local-demo-secret"
        result = validate_launch_config(
            {
                "command": "python3",
                "args": ["-m", "http.server", "8000"],
                "env": {"API_TOKEN": secret},
            }
        )
        rendered = json.dumps(result)
        self.assertTrue(result["valid"])
        self.assertEqual(result["summary"]["environment"], {"API_TOKEN": "[REDACTED]"})
        self.assertNotIn(secret, rendered)
        self.assertFalse(result["launched"])

    def test_invalid_input_recovers_on_next_valid_input(self):
        result = demo()
        self.assertFalse(result["invalid_result"]["valid"])
        self.assertTrue(result["recovery_result"]["valid"])
        self.assertFalse(result["recovery_result"]["launched"])
        self.assertNotIn("local-demo-secret", json.dumps(result))

    def test_deliberately_wrong_expectation_exits_nonzero(self):
        # Exercise unittest's failure status in an isolated throwaway file;
        # the real suite stays green while this guards the required failure path.
        with tempfile.TemporaryDirectory() as temp_dir:
            probe = Path(temp_dir) / "test_wrong_expectation.py"
            probe.write_text(
                "import unittest\n"
                "class WrongExpectation(unittest.TestCase):\n"
                "    def test_probe(self):\n"
                "        self.assertEqual('actual', 'deliberately-wrong')\n",
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
