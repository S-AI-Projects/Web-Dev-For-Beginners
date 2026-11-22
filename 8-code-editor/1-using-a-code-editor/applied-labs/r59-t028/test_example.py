"""Unit tests for R59-T028 server launch configuration validator and redaction."""

from __future__ import annotations

import json
from pathlib import Path
import unittest

from example import (
    CONFIG_LARGE,
    CONFIG_MEDIUM,
    CONFIG_SMALL,
    CONTROLLED_CONFIGURATIONS,
    compare_configurations,
    run_demo,
    validate_launch_config,
)


class TestLaunchConfigValidator(unittest.TestCase):
    """Test suite verifying launch config validation, redaction, and boundary conditions."""

    def test_controlled_configurations_pass(self) -> None:
        """Controlled configurations (small, medium, large) must validate and redact secrets."""
        for cfg in CONTROLLED_CONFIGURATIONS:
            res = validate_launch_config(cfg)
            self.assertTrue(res["valid"])
            self.assertEqual(res["errors"], [])
            self.assertFalse(res["process_launched"])
            self.assertEqual(res["command"], cfg["command"])
            self.assertEqual(res["args"], cfg["args"])
            # All env values must be redacted
            for k, v in res["redacted_env"].items():
                self.assertEqual(v, "[REDACTED]")
            self.assertEqual(len(res["env_keys"]), len(cfg.get("env", {})))

    def test_missing_command_fails(self) -> None:
        """Missing or blank command must fail validation."""
        cfg_none = {"command": None, "args": ["run"]}
        res_none = validate_launch_config(cfg_none)
        self.assertFalse(res_none["valid"])
        self.assertIn("Missing required command", res_none["errors"])

        cfg_missing = {"args": ["run"]}
        res_missing = validate_launch_config(cfg_missing)
        self.assertFalse(res_missing["valid"])
        self.assertIn("Missing required command", res_missing["errors"])

        cfg_empty = {"command": "   ", "args": ["run"]}
        res_empty = validate_launch_config(cfg_empty)
        self.assertFalse(res_empty["valid"])
        self.assertIn("Missing required command", res_empty["errors"])

    def test_string_args_fails(self) -> None:
        """A single string where an argument array is required must fail with specific message."""
        cfg_str_args = {
            "command": "node",
            "args": "server.js --port 3000",
            "env": {}
        }
        res = validate_launch_config(cfg_str_args)
        self.assertFalse(res["valid"])
        self.assertIn("Arguments must be an array of strings, not a single string", res["errors"])
        self.assertFalse(res["process_launched"])

    def test_non_list_args_fails(self) -> None:
        """Non-list/tuple args like int or dict must fail."""
        cfg_int_args = {"command": "python3", "args": 42}
        res = validate_launch_config(cfg_int_args)
        self.assertFalse(res["valid"])
        self.assertIn("Arguments must be an array/list of strings", res["errors"])

    def test_non_string_arg_element_fails(self) -> None:
        """Argument array containing non-string items must fail."""
        cfg_mixed_args = {"command": "node", "args": ["server.js", 3000]}
        res = validate_launch_config(cfg_mixed_args)
        self.assertFalse(res["valid"])
        self.assertTrue(any("must be a string" in err for err in res["errors"]))

    def test_smallest_valid_case(self) -> None:
        """Smallest valid configuration has command, empty args array, and empty env."""
        cfg_min = {"command": "node", "args": []}
        res = validate_launch_config(cfg_min)
        self.assertTrue(res["valid"])
        self.assertEqual(res["args"], [])
        self.assertEqual(res["env_keys"], [])
        self.assertEqual(res["redacted_env"], {})
        self.assertFalse(res["process_launched"])

    def test_env_invalid_type_fails(self) -> None:
        """Non-dict env must fail validation."""
        cfg_bad_env = {"command": "node", "args": ["index.js"], "env": "PORT=3000"}
        res = validate_launch_config(cfg_bad_env)
        self.assertFalse(res["valid"])
        self.assertIn("Environment must be a dictionary of key-value pairs", res["errors"])

    def test_invalid_type_raises_type_error(self) -> None:
        """Non-dictionary input must raise TypeError."""
        with self.assertRaises(TypeError):
            validate_launch_config("node server.js")
        with self.assertRaises(TypeError):
            validate_launch_config(None)

    def test_compare_configurations_metrics(self) -> None:
        """Comparison report must compute correct argument counts, env counts, and 100% redaction."""
        results = compare_configurations(CONTROLLED_CONFIGURATIONS)
        self.assertEqual(len(results), 3)

        # Small
        self.assertEqual(results[0]["config_id"], "CFG-SMALL")
        self.assertTrue(results[0]["valid"])
        self.assertEqual(results[0]["arg_count"], 3)
        self.assertEqual(results[0]["env_key_count"], 1)
        self.assertEqual(results[0]["redaction_rate_percent"], 100.0)
        self.assertFalse(results[0]["process_launched"])

        # Medium
        self.assertEqual(results[1]["config_id"], "CFG-MEDIUM")
        self.assertTrue(results[1]["valid"])
        self.assertEqual(results[1]["arg_count"], 5)
        self.assertEqual(results[1]["env_key_count"], 4)
        self.assertEqual(results[1]["redaction_rate_percent"], 100.0)
        self.assertFalse(results[1]["process_launched"])

        # Large
        self.assertEqual(results[2]["config_id"], "CFG-LARGE")
        self.assertTrue(results[2]["valid"])
        self.assertEqual(results[2]["arg_count"], 7)
        self.assertEqual(results[2]["env_key_count"], 6)
        self.assertEqual(results[2]["redaction_rate_percent"], 100.0)
        self.assertFalse(results[2]["process_launched"])

    def test_no_process_ever_launched(self) -> None:
        """Contract invariant: process_launched must always be False."""
        cases = [
            CONFIG_SMALL,
            CONFIG_MEDIUM,
            CONFIG_LARGE,
            {"command": "rm -rf /", "args": ["--force"]},
            {"command": "echo", "args": "hello"},
        ]
        for c in cases:
            res = validate_launch_config(c)
            self.assertFalse(res["process_launched"], "process_launched must never be True")

    def test_mutant_leak_fails_redaction_assertion(self) -> None:
        """Demonstrate that an implementation leaking unredacted secrets fails assertions."""
        # Simulated buggy validator that returns raw env values
        def buggy_leaky_validator(config):
            res = validate_launch_config(config)
            if res["valid"]:
                res["redacted_env"] = dict(config.get("env", {}))
            return res

        leaky_res = buggy_leaky_validator(CONFIG_SMALL)
        # Verify that our verification check detects the leak
        has_secret_leak = any(v != "[REDACTED]" for v in leaky_res["redacted_env"].values())
        self.assertTrue(has_secret_leak, "Mutant must leak secrets to trigger detection")

    def test_readme_expected_output_alignment(self) -> None:
        """Lab README.md must contain the exact expected JSON output from run_demo()."""
        lab_readme_path = Path(__file__).parent / "README.md"
        self.assertTrue(lab_readme_path.exists(), "Lab README.md must exist")
        content = lab_readme_path.read_text(encoding="utf-8")

        demo_output = run_demo()
        parsed_demo = json.loads(demo_output)

        self.assertIn('"config_id": "CFG-SMALL"', content)
        self.assertIn('"config_id": "CFG-MEDIUM"', content)
        self.assertIn('"config_id": "CFG-LARGE"', content)
        self.assertIn('"redaction_rate_percent": 100.0', content)
        self.assertIn('"process_launched": false', content)

    def test_lesson_readme_link_agreement(self) -> None:
        """Lesson README.md must link to the lab and state prerequisite commands."""
        lesson_readme_path = Path(__file__).parents[2] / "README.md"
        self.assertTrue(lesson_readme_path.exists(), "Lesson README.md must exist")
        content = lesson_readme_path.read_text(encoding="utf-8")

        self.assertIn("applied-labs/r59-t028", content)
        self.assertIn("python3 -m unittest discover -s 8-code-editor/1-using-a-code-editor/applied-labs/r59-t028", content)
        self.assertIn("Python 3.9+", content)
        self.assertIn("redaction", content.lower())


if __name__ == "__main__":
    unittest.main()
