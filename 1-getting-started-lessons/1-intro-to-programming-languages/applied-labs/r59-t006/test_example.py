"""
Unit tests for Typed Tool Dispatch with Refactored Schema Validation
Applied Lab: R59-T006
Curriculum: 1-getting-started-lessons/1-intro-to-programming-languages
"""

import unittest
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from example import (
    dispatch_tool,
    dispatch_tool_baseline,
    execute_tool_pipeline,
    STANDARD_FIXTURES,
)


class TestTypedToolDispatch(unittest.TestCase):
    def test_add_operation(self):
        """Verifies add(2, 3) -> 5."""
        call = {"tool": "add", "arguments": {"a": 2, "b": 3}}
        res = dispatch_tool(call)
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["result"], 5)

    def test_multiply_operation(self):
        """Verifies multiply(2, 3) -> 6."""
        call = {"tool": "multiply", "arguments": {"a": 2, "b": 3}}
        res = dispatch_tool(call)
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["result"], 6)

    def test_unknown_tool_returns_structured_error(self):
        """Verifies unknown tool returns structured error code UNKNOWN_TOOL."""
        call = {"tool": "unregistered_tool", "arguments": {"a": 2, "b": 3}}
        res = dispatch_tool(call)
        self.assertEqual(res["status"], "error")
        self.assertEqual(res["error"]["code"], "UNKNOWN_TOOL")

    def test_string_argument_a_returns_structured_error(self):
        """Verifies string argument a returns structured error code INVALID_ARGUMENT_TYPE."""
        call = {"tool": "add", "arguments": {"a": "invalid_string", "b": 3}}
        res = dispatch_tool(call)
        self.assertEqual(res["status"], "error")
        self.assertEqual(res["error"]["code"], "INVALID_ARGUMENT_TYPE")
        self.assertEqual(res["error"]["argument"], "a")

    def test_failed_call_halts_pipeline_without_executing_subsequent_tools(self):
        """Verifies that a failed tool call cannot execute subsequent tools."""
        pipeline = [
            {"tool": "add", "arguments": {"a": 1, "b": 2}},               # Valid -> 3
            {"tool": "add", "arguments": {"a": "bad_param", "b": 5}},      # Error -> halts!
            {"tool": "multiply", "arguments": {"a": 10, "b": 10}}          # Must NOT run
        ]
        result = execute_tool_pipeline(pipeline)
        self.assertEqual(result["status"], "halted_on_error")
        self.assertEqual(result["executed_count"], 1)
        self.assertEqual(result["executed_tools"], ["add"])
        self.assertEqual(result["error"]["code"], "INVALID_ARGUMENT_TYPE")
        # Only 2 results attempted; 3rd tool never touched
        self.assertEqual(len(result["results"]), 2)

    def test_before_after_refactor_equivalence(self):
        """Verifies 100% contract equivalence between baseline and refactored implementations."""
        for fixture in STANDARD_FIXTURES:
            baseline_res = dispatch_tool_baseline(fixture)
            refactored_res = dispatch_tool(fixture)
            self.assertEqual(
                baseline_res,
                refactored_res,
                f"Equivalence mismatch on fixture {fixture}:\nBaseline: {baseline_res}\nRefactored: {refactored_res}"
            )

    def test_deliberate_wrong_result_fails(self):
        """Ensures that asserting an invalid calculation result raises an AssertionError."""
        call = {"tool": "add", "arguments": {"a": 2, "b": 3}}
        res = dispatch_tool(call)
        with self.assertRaises(AssertionError):
            self.assertEqual(res["result"], 999)


if __name__ == "__main__":
    unittest.main()
