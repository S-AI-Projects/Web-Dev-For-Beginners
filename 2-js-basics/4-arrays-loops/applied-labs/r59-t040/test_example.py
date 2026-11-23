"""
Unit tests for R59-T040: Security scenario assessment, structural rubric, and applied questions.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
from example import (
    evaluate_scenario,
    is_control_related_to_threat,
    SCENARIO_1_COMPLETE,
    SCENARIO_2_MISSING_ASSET,
    SCENARIO_3_UNRELATED_CONTROL,
    APPLIED_QUESTIONS
)


class TestSecurityScenarioRubric(unittest.TestCase):
    """Verifies scenario rubric grading, error cases, and applied questions."""

    def test_scenario_1_complete_passes(self):
        """Contract: One complete scenario passes."""
        result = evaluate_scenario(SCENARIO_1_COMPLETE)
        self.assertEqual(result["status"], "pass")
        self.assertIn("satisfies", result["message"])

    def test_scenario_2_missing_asset_fails(self):
        """Contract: Scenario without an asset fails."""
        result = evaluate_scenario(SCENARIO_2_MISSING_ASSET)
        self.assertEqual(result["status"], "fail")
        self.assertIn("asset", result["error"].lower())

    def test_scenario_3_unrelated_control_flagged(self):
        """Contract: Control unrelated to named threat is flagged for review."""
        result = evaluate_scenario(SCENARIO_3_UNRELATED_CONTROL)
        self.assertEqual(result["status"], "flagged_for_review")
        self.assertIn("reason", result)

    def test_applied_question_1_predict_output(self):
        """Applied Question 1: Predict output of Scenario 1 evaluation."""
        q1 = APPLIED_QUESTIONS["q1_predict_output"]
        actual_status = evaluate_scenario(SCENARIO_1_COMPLETE)["status"]
        self.assertEqual(actual_status, q1["predicted_answer"])
        self.assertTrue(len(q1["rationale"]) > 10)

    def test_applied_question_2_diagnose_failure(self):
        """Applied Question 2: Diagnose why Scenario 2 fails."""
        q2 = APPLIED_QUESTIONS["q2_diagnose_failure"]
        actual_result = evaluate_scenario(SCENARIO_2_MISSING_ASSET)
        self.assertEqual(actual_result["status"], "fail")
        self.assertIn("asset", actual_result["error"].lower())
        self.assertEqual(q2["diagnosed_reason"], "missing_asset")

    def test_applied_question_3_boundary_policy(self):
        """Applied Question 3: Boundary policy for unclassified domains."""
        q3 = APPLIED_QUESTIONS["q3_boundary_policy"]
        self.assertEqual(q3["policy"], "flag_for_human_review")
        self.assertIn("human review", q3["rationale"].lower())

    def test_invalid_input_type(self):
        """Invalid scenario type raises TypeError."""
        with self.assertRaises(TypeError):
            evaluate_scenario(["not", "a", "dict"])

    def test_documentation_alignment(self):
        """Verify lab README and lesson README exist and link to this assessment."""
        current_dir = os.path.dirname(__file__)
        lab_readme = os.path.join(current_dir, 'README.md')
        lesson_readme = os.path.join(current_dir, '../../README.md')

        self.assertTrue(os.path.exists(lab_readme), "Lab README must exist")
        self.assertTrue(os.path.exists(lesson_readme), "Lesson README must exist")

        with open(lab_readme, 'r', encoding='utf-8') as f:
            lab_text = f.read()
            self.assertIn('SCENARIO_1_COMPLETE', lab_text)
            self.assertIn('r59-t040', lab_text)

        with open(lesson_readme, 'r', encoding='utf-8') as f:
            lesson_text = f.read()
            self.assertIn('r59-t040', lesson_text)


if __name__ == '__main__':
    unittest.main()
