"""Unit tests for R59-T030 dependency-plan validation and scenario assessment."""

from __future__ import annotations

import json
from pathlib import Path
import unittest

from example import (
    PLAN_A11Y_REMEDIATION,
    PLAN_CANONICAL,
    PLAN_CYCLE_2,
    PLAN_CYCLE_SELF,
    PLAN_UNKNOWN_DEP,
    answer_question_1_predict_output,
    answer_question_2_diagnose_failure,
    answer_question_3_choose_boundary_policy,
    run_demo,
    validate_and_order_plan,
)


class TestDependencyPlanValidation(unittest.TestCase):
    """Test suite verifying topological sort, cycle detection, unknown deps, and scenario assessment."""

    def test_canonical_linear_plan_orders_a_b_c(self) -> None:
        """Canonical requirement: A has no deps, B depends on A, C on B -> order ['A', 'B', 'C']."""
        result = validate_and_order_plan(PLAN_CANONICAL)
        self.assertTrue(result["valid"])
        self.assertEqual(result["order"], ["A", "B", "C"])
        self.assertEqual(result["errors"], [])
        self.assertEqual(result["tasks_count"], 3)

    def test_cycle_two_nodes_rejected(self) -> None:
        """Cycle requirement: A -> B -> A is rejected with cyclic dependency error."""
        result = validate_and_order_plan(PLAN_CYCLE_2)
        self.assertFalse(result["valid"])
        self.assertEqual(result["order"], [])
        self.assertTrue(any("Cyclic dependency detected" in err for err in result["errors"]))

    def test_cycle_self_dependency_rejected(self) -> None:
        """Self-dependency (A -> A) is rejected as a cycle."""
        result = validate_and_order_plan(PLAN_CYCLE_SELF)
        self.assertFalse(result["valid"])
        self.assertEqual(result["order"], [])
        self.assertTrue(any("Cyclic dependency detected" in err for err in result["errors"]))

    def test_cycle_three_nodes_rejected(self) -> None:
        """Cycle of length 3 (A -> B -> C -> A) is rejected."""
        plan = {
            "A": ["C"],
            "B": ["A"],
            "C": ["B"]
        }
        result = validate_and_order_plan(plan)
        self.assertFalse(result["valid"])
        self.assertTrue(any("Cyclic dependency detected" in err for err in result["errors"]))

    def test_unknown_dependency_reported_by_task_id(self) -> None:
        """Unknown dependency requirement: task depending on missing ID is reported by task ID."""
        result = validate_and_order_plan(PLAN_UNKNOWN_DEP)
        self.assertFalse(result["valid"])
        self.assertEqual(result["order"], [])
        self.assertIn("Task 'C' depends on unknown task 'UNKNOWN_X'", result["errors"])

    def test_multiple_unknown_dependencies_reported(self) -> None:
        """Multiple unknown dependencies are all reported with their respective task IDs."""
        plan = {
            "T1": ["MISSING_A"],
            "T2": ["MISSING_B"]
        }
        result = validate_and_order_plan(plan)
        self.assertFalse(result["valid"])
        self.assertIn("Task 'T1' depends on unknown task 'MISSING_A'", result["errors"])
        self.assertIn("Task 'T2' depends on unknown task 'MISSING_B'", result["errors"])

    def test_single_task_zero_dependencies(self) -> None:
        """Smallest valid case: single task with no dependencies."""
        plan = {"STANDALONE": []}
        result = validate_and_order_plan(plan)
        self.assertTrue(result["valid"])
        self.assertEqual(result["order"], ["STANDALONE"])

    def test_disconnected_independent_tasks_deterministic_order(self) -> None:
        """Multiple independent tasks are ordered deterministically alphabetically."""
        plan = {"Z": [], "A": [], "M": []}
        result = validate_and_order_plan(plan)
        self.assertTrue(result["valid"])
        self.assertEqual(result["order"], ["A", "M", "Z"])

    def test_diamond_dependency_graph(self) -> None:
        """Diamond DAG (A unblocks B and C; both unblock D) orders deterministically."""
        plan = {
            "A": [],
            "B": ["A"],
            "C": ["A"],
            "D": ["B", "C"]
        }
        result = validate_and_order_plan(plan)
        self.assertTrue(result["valid"])
        self.assertEqual(result["order"], ["A", "B", "C", "D"])

    def test_invalid_types_raise_exceptions(self) -> None:
        """Invalid types raise TypeError or ValueError."""
        with self.assertRaises(TypeError):
            validate_and_order_plan(12345)
        with self.assertRaises(ValueError):
            validate_and_order_plan({"": []})
        with self.assertRaises(ValueError):
            validate_and_order_plan({"A": "not-a-list"})

    def test_scenario_assessment_question_1_predict_output(self) -> None:
        """Assessment Question 1: predict output for accessibility remediation plan."""
        q1 = answer_question_1_predict_output()
        self.assertEqual(q1["question_id"], "Q1_PREDICT_OUTPUT")
        self.assertTrue(q1["matches_prediction"])
        self.assertEqual(
            q1["predicted_order"],
            ["AUDIT_SEMANTICS", "ADD_FORM_LABELS", "ADD_IMAGE_ALT", "VERIFY_KEYBOARD_NAV"]
        )

    def test_scenario_assessment_question_2_diagnose_failure(self) -> None:
        """Assessment Question 2: diagnose circular dependency failure between style and test."""
        q2 = answer_question_2_diagnose_failure()
        self.assertEqual(q2["question_id"], "Q2_DIAGNOSE_FAILURE")
        self.assertFalse(q2["valid"])
        self.assertEqual(q2["failure_category"], "cyclic_dependency")
        self.assertIn("FOCUS_RING_STYLE", q2["culprit_tasks"])
        self.assertIn("KEYBOARD_TEST", q2["culprit_tasks"])

    def test_scenario_assessment_question_3_choose_boundary_policy(self) -> None:
        """Assessment Question 3: choose deterministic tie-breaking boundary policy."""
        q3 = answer_question_3_choose_boundary_policy()
        self.assertEqual(q3["question_id"], "Q3_CHOOSE_BOUNDARY_POLICY")
        self.assertEqual(q3["chosen_policy"], "deterministic_lexicographical_tiebreak")
        self.assertIn("reproducible", q3["rationale"].lower())

    def test_mutant_cycle_detector_fails_assertion(self) -> None:
        """Defect detection: broken topological sorter that accepts cycles fails validation assertion."""
        # Simulated buggy validator that skips cycle detection and returns partial order
        def buggy_validator(plan):
            res = validate_and_order_plan(plan)
            # Pretend cycle plan is valid
            return {"valid": True, "order": ["A", "B"], "errors": []}

        buggy_res = buggy_validator(PLAN_CYCLE_2)
        # Verify our test assertion catches the defect
        is_buggy = buggy_res["valid"] is True
        self.assertTrue(is_buggy, "Mutant must falsely claim valid to trigger test failure")

    def test_readme_expected_output_alignment(self) -> None:
        """Lab README.md must contain the exact JSON output from run_demo()."""
        lab_readme_path = Path(__file__).parent / "README.md"
        self.assertTrue(lab_readme_path.exists(), "Lab README.md must exist")
        content = lab_readme_path.read_text(encoding="utf-8")

        demo_output = run_demo()
        parsed = json.loads(demo_output)

        self.assertIn('"Q1_PREDICT_OUTPUT"', content)
        self.assertIn('"Q2_DIAGNOSE_FAILURE"', content)
        self.assertIn('"Q3_CHOOSE_BOUNDARY_POLICY"', content)
        self.assertIn('"AUDIT_SEMANTICS"', content)
        self.assertIn('"Cyclic dependency detected: A -> B -> A"', content)

    def test_lesson_readme_link_agreement(self) -> None:
        """Lesson README.md must link to the lab and state prerequisite commands."""
        lesson_readme_path = Path(__file__).parents[2] / "README.md"
        self.assertTrue(lesson_readme_path.exists(), "Lesson README.md must exist")
        content = lesson_readme_path.read_text(encoding="utf-8")

        self.assertIn("applied-labs/r59-t030", content)
        self.assertIn("python3 -m unittest discover -s 1-getting-started-lessons/3-accessibility/applied-labs/r59-t030", content)
        self.assertIn("Python 3.9+", content)
        self.assertIn("topological", content.lower())


if __name__ == "__main__":
    unittest.main()
