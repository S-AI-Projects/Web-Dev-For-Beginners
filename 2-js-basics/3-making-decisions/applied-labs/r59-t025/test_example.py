"""Unit tests for R59-T025 decision-making rubric checker."""

from __future__ import annotations

import json
from pathlib import Path
import unittest

from example import (
    SCENARIO_1_COMPLETE,
    SCENARIO_2_MISSING_ASSET,
    SCENARIO_3_UNRELATED_CONTROL,
    evaluate_scenario,
    run_demo,
)


class TestDecisionRubricChecker(unittest.TestCase):
    """Test suite verifying structural rubric evaluation and boundary conditions."""

    def test_reference_scenario_1_complete_passes(self) -> None:
        """Reference case 1: A complete, consistent scenario must pass."""
        result = evaluate_scenario(SCENARIO_1_COMPLETE)
        self.assertEqual(result["status"], "pass")
        self.assertEqual(result["errors"], [])
        self.assertEqual(result["flags"], [])
        self.assertFalse(result["requires_human_review"])
        self.assertEqual(result["scenario_id"], "SCN-001")

    def test_reference_scenario_2_missing_asset_fails(self) -> None:
        """Reference case 2: A scenario lacking an asset must fail."""
        result = evaluate_scenario(SCENARIO_2_MISSING_ASSET)
        self.assertEqual(result["status"], "fail")
        self.assertIn("Missing required asset field", result["errors"])
        self.assertEqual(result["flags"], [])
        self.assertFalse(result["requires_human_review"])
        self.assertEqual(result["scenario_id"], "SCN-002")

    def test_reference_scenario_3_unrelated_control_flagged(self) -> None:
        """Reference case 3: Control unrelated to named threat must be flagged for review."""
        result = evaluate_scenario(SCENARIO_3_UNRELATED_CONTROL)
        self.assertEqual(result["status"], "flagged_for_review")
        self.assertEqual(result["errors"], [])
        self.assertTrue(any("unrelated" in f.lower() for f in result["flags"]))
        self.assertTrue(result["requires_human_review"])
        self.assertEqual(result["scenario_id"], "SCN-003")

    def test_smallest_valid_case(self) -> None:
        """Smallest valid case: single-character strings for all fields."""
        smallest_scenario = {
            "scenario_id": "MIN-1",
            "asset": "A",
            "threat": "Token spoofing attack",
            "control": "Token signature validation",
            "residual_risk": "R",
            "explanation": "E"
        }
        result = evaluate_scenario(smallest_scenario)
        self.assertEqual(result["status"], "pass")
        self.assertEqual(result["errors"], [])
        self.assertEqual(result["flags"], [])
        self.assertFalse(result["requires_human_review"])

    def test_boundary_whitespace_only_asset_fails(self) -> None:
        """Boundary case: Whitespace-only string for asset.

        Boundary decision: Whitespace-only strings (spaces, tabs, newlines)
        do not identify a legitimate asset entity and must be treated as empty.
        """
        boundary_scenario = {
            "scenario_id": "BND-01",
            "asset": "   \t\n  ",
            "threat": "Token tampering",
            "control": "Token signature validation",
            "residual_risk": "Replay",
            "explanation": "Valid explanation"
        }
        result = evaluate_scenario(boundary_scenario)
        self.assertEqual(result["status"], "fail")
        self.assertIn("Missing required asset field", result["errors"])

    def test_invalid_input_type_raises_type_error(self) -> None:
        """Invalid case: Passing a non-dict must raise a TypeError."""
        with self.assertRaises(TypeError):
            evaluate_scenario(["not", "a", "dict"])

        with self.assertRaises(TypeError):
            evaluate_scenario(None)

    def test_invalid_missing_threat_field_fails(self) -> None:
        """Invalid case: Scenario missing required 'threat' field."""
        incomplete_scenario = {
            "scenario_id": "INC-01",
            "asset": "User database",
            "control": "Encryption at rest",
            "residual_risk": "Key theft",
            "explanation": "Explanation"
        }
        result = evaluate_scenario(incomplete_scenario)
        self.assertEqual(result["status"], "fail")
        self.assertIn("Missing required threat field", result["errors"])

    def test_mutant_implementation_fails_assertions(self) -> None:
        """Deliberate wrong result check: A broken evaluator that always passes fails test assertions."""
        def broken_evaluator(scenario: dict) -> dict:
            return {
                "scenario_id": scenario.get("scenario_id", "BROKEN"),
                "status": "pass",  # Deliberate bug: always passes even with missing fields
                "errors": [],
                "flags": [],
                "requires_human_review": False
            }

        # Verifying that our assertion for scenario 2 would fail on the broken evaluator
        broken_result = broken_evaluator(SCENARIO_2_MISSING_ASSET)
        with self.assertRaises(AssertionError):
            self.assertEqual(broken_result["status"], "fail")

    def test_readme_expected_output_alignment(self) -> None:
        """Verify lab README.md contains exact matching JSON output of the demo."""
        readme_path = Path(__file__).parent / "README.md"
        self.assertTrue(readme_path.exists(), "README.md must exist in applied lab folder")

        readme_content = readme_path.read_text(encoding="utf-8")
        demo_output = run_demo()

        self.assertIn("```json", readme_content)
        self.assertIn(demo_output, readme_content)

    def test_lesson_readme_link_agreement(self) -> None:
        """Verify lesson README links to applied lab and documents exact test invocation."""
        lesson_readme_path = Path(__file__).parents[2] / "README.md"
        self.assertTrue(lesson_readme_path.exists(), "Lesson README.md must exist")

        content = lesson_readme_path.read_text(encoding="utf-8")
        self.assertIn("applied-labs/r59-t025/", content)
        self.assertIn("python3 -m unittest discover -s 2-js-basics/3-making-decisions/applied-labs/r59-t025 -p \"test_*.py\"", content)


if __name__ == "__main__":
    unittest.main()
