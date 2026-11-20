"""
Unit tests for Security Scenario Rubric Checker with Offline Service Adapter
Applied Lab: R59-T005
Curriculum: 2-js-basics/2-functions-methods
"""

import unittest
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from example import (
    evaluate_scenario,
    DeterministicLocalAdapter,
    SecurityRelevanceService,
    FICTIONAL_SCENARIOS,
)


class TestSecurityScenarioRubric(unittest.TestCase):
    def test_complete_scenario_passes(self):
        """Verifies that a complete and consistent scenario returns status: PASS."""
        scenario = FICTIONAL_SCENARIOS["complete_valid"]
        result = evaluate_scenario(scenario)
        self.assertEqual(result["status"], "PASS")
        self.assertIn("complete", result["reason"].lower())

    def test_missing_asset_fails(self):
        """Verifies that a scenario lacking an asset returns status: FAIL."""
        scenario = FICTIONAL_SCENARIOS["missing_asset"]
        result = evaluate_scenario(scenario)
        self.assertEqual(result["status"], "FAIL")
        self.assertIn("asset", result["reason"].lower())

    def test_unrelated_control_flagged_for_review(self):
        """Verifies that a control unrelated to the named threat is flagged for review."""
        scenario = FICTIONAL_SCENARIOS["unrelated_control"]
        result = evaluate_scenario(scenario)
        self.assertEqual(result["status"], "REVIEW")
        self.assertIn("unrelated", result["reason"].lower())

    def test_custom_callable_adapter_interface(self):
        """Demonstrates that external dependency is behind a swappable callable interface."""
        class MockAlwaysRelevantAdapter(SecurityRelevanceService):
            def evaluate_relevance(self, threat, control):
                return {"relevant": True, "source": "mock_custom"}

        scenario = FICTIONAL_SCENARIOS["unrelated_control"]
        result = evaluate_scenario(scenario, adapter=MockAlwaysRelevantAdapter())
        self.assertEqual(result["status"], "PASS")

    def test_deliberate_wrong_result_fails(self):
        """Ensures that asserting an invalid status triggers an assertion failure."""
        scenario = FICTIONAL_SCENARIOS["missing_asset"]
        result = evaluate_scenario(scenario)
        with self.assertRaises(AssertionError):
            self.assertEqual(result["status"], "PASS")


if __name__ == "__main__":
    unittest.main()
