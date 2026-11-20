"""
Unit tests for Dependency-Plan Validation and Topological Ordering
Applied Lab: R59-T002
Curriculum: 1-getting-started-lessons/3-accessibility
"""

import unittest
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from example import (
    validate_and_order_plan,
    MissingDependencyError,
    CircularDependencyError,
    FIXTURES,
)


class TestDependencyPlanValidation(unittest.TestCase):
    def test_linear_dependency_order_a_b_c(self):
        """Verifies standard prerequisite plan: A has no deps, B depends on A, C on B -> [A, B, C]."""
        fixture = FIXTURES["standard_linear"]
        order = validate_and_order_plan(fixture)
        self.assertEqual(order, ["A", "B", "C"])

    def test_cycle_a_b_a_rejected(self):
        """Verifies that circular dependency cycle A <-> B is rejected with CircularDependencyError."""
        fixture = FIXTURES["cyclic_two_node"]
        with self.assertRaises(CircularDependencyError) as context:
            validate_and_order_plan(fixture)
        self.assertIn("A", str(context.exception))
        self.assertIn("B", str(context.exception))

    def test_unknown_dependency_reported_by_id(self):
        """Verifies that missing/unknown dependencies are reported by exact task ID."""
        fixture = FIXTURES["unknown_dependency"]
        with self.assertRaises(MissingDependencyError) as context:
            validate_and_order_plan(fixture)
        self.assertEqual(context.exception.missing_dep_id, "NON_EXISTENT_TASK")
        self.assertEqual(context.exception.task_id, "C")
        self.assertIn("NON_EXISTENT_TASK", str(context.exception))

    def test_boundary_empty_plan(self):
        """Smallest boundary case: an empty plan is valid and returns an empty list."""
        fixture = FIXTURES["boundary_empty"]
        self.assertEqual(validate_and_order_plan(fixture), [])

    def test_boundary_single_independent_task(self):
        """Smallest valid plan: a single task with no dependencies returns [A]."""
        fixture = FIXTURES["boundary_single"]
        self.assertEqual(validate_and_order_plan(fixture), ["A"])

    def test_boundary_self_dependency_rejected(self):
        """Boundary case: task depending on itself is rejected as a cycle."""
        fixture = FIXTURES["boundary_self_cycle"]
        with self.assertRaises(CircularDependencyError):
            validate_and_order_plan(fixture)

    def test_deterministic_independent_tasks_order(self):
        """Independent tasks are resolved deterministically in alphabetical order."""
        fixture = FIXTURES["multiple_independent"]
        order = validate_and_order_plan(fixture)
        self.assertEqual(order, ["TaskA", "TaskM", "TaskZ"])

    def test_deliberate_wrong_result_fails(self):
        """Ensures that asserting an invalid order properly causes test failure."""
        fixture = FIXTURES["standard_linear"]
        order = validate_and_order_plan(fixture)
        with self.assertRaises(AssertionError):
            self.assertEqual(order, ["C", "B", "A"])


if __name__ == "__main__":
    unittest.main()
