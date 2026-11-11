import unittest
import json
import os
from example import (
    FICTIONAL_SCENARIOS,
    evaluate_scenario,
    evaluate_scenario_baseline,
    validate_control_relevance,
)


class TestSecurityScenarioRubric(unittest.TestCase):
    def test_complete_scenario_passes(self):
        scenario = FICTIONAL_SCENARIOS["complete_valid"]
        result = evaluate_scenario(scenario)
        self.assertEqual(result["status"], "PASS")
        self.assertIn("complete and structurally consistent", result["reason"].lower())

    def test_missing_asset_scenario_fails(self):
        scenario = FICTIONAL_SCENARIOS["missing_asset"]
        result = evaluate_scenario(scenario)
        self.assertEqual(result["status"], "FAIL")
        self.assertIn("asset", result["reason"])

    def test_unrelated_control_scenario_flagged_for_review(self):
        scenario = FICTIONAL_SCENARIOS["unrelated_control"]
        result = evaluate_scenario(scenario)
        self.assertEqual(result["status"], "REVIEW")
        self.assertIn("unrelated", result["reason"])

    def test_refactor_equivalence_with_baseline(self):
        """Verifies that extracted responsibility maintains exact contract equivalence."""
        for key, scenario in FICTIONAL_SCENARIOS.items():
            baseline_result = evaluate_scenario_baseline(scenario)
            refactored_result = evaluate_scenario(scenario)
            self.assertEqual(
                baseline_result["status"],
                refactored_result["status"],
                f"Mismatch on scenario {key}: baseline {baseline_result} vs refactored {refactored_result}",
            )

    def test_deliberate_wrong_result_fails(self):
        """Verifies that an invalid expectation properly triggers an assertion failure."""
        scenario = FICTIONAL_SCENARIOS["missing_asset"]
        result = evaluate_scenario(scenario)
        # Verify that asserting PASS on an incomplete scenario fails
        with self.assertRaises(AssertionError):
            self.assertEqual(result["status"], "PASS")


if __name__ == "__main__":
    unittest.main()
