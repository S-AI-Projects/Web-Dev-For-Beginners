"""
Unit tests for R59-T038: Typed tool dispatch, structured error envelopes, and recovery.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
from example import ALLOWED_TOOLS, dispatch_tool, dispatch_pipeline


class TestTypedToolDispatch(unittest.TestCase):
    """Verifies typed tool dispatch, error envelopes, pipeline halting, and recovery."""

    def test_add_success(self):
        """Contract: add(2, 3) -> 5"""
        call = {"tool": "add", "arguments": {"a": 2, "b": 3}}
        result = dispatch_tool(call)
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["result"], 5)
        self.assertEqual(result["tool"], "add")

    def test_multiply_success(self):
        """Contract: multiply(2, 3) -> 6"""
        call = {"tool": "multiply", "arguments": {"a": 2, "b": 3}}
        result = dispatch_tool(call)
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["result"], 6)
        self.assertEqual(result["tool"], "multiply")

    def test_unknown_tool_structured_error(self):
        """Contract: Unknown tool yields structured error envelope."""
        call = {"tool": "power", "arguments": {"a": 2, "b": 3}}
        result = dispatch_tool(call)
        self.assertEqual(result["status"], "error")
        self.assertIn("error", result)
        self.assertEqual(result["error"]["code"], "UNKNOWN_TOOL")
        self.assertIn("power", result["error"]["message"])

    def test_string_argument_a_structured_error(self):
        """Contract: String argument 'a' yields structured error envelope."""
        call = {"tool": "add", "arguments": {"a": "2", "b": 3}}
        result = dispatch_tool(call)
        self.assertEqual(result["status"], "error")
        self.assertIn("error", result)
        self.assertEqual(result["error"]["code"], "INVALID_ARGUMENT_TYPE")
        self.assertEqual(result["error"]["argument"], "a")

    def test_missing_argument_structured_error(self):
        """Missing required argument yields structured error envelope."""
        call = {"tool": "multiply", "arguments": {"a": 2}}
        result = dispatch_tool(call)
        self.assertEqual(result["status"], "error")
        self.assertEqual(result["error"]["code"], "MISSING_ARGUMENT")

    def test_pipeline_halts_on_failure(self):
        """Contract: A failed call cannot execute another tool (halts pipeline)."""
        calls = [
            {"tool": "add", "arguments": {"a": 2, "b": 3}},           # passes -> 5
            {"tool": "add", "arguments": {"a": "bad", "b": 3}},         # fails -> error
            {"tool": "multiply", "arguments": {"a": 2, "b": 3}}        # MUST NOT execute
        ]
        results = dispatch_pipeline(calls)
        self.assertEqual(len(results), 2, "Pipeline must stop immediately after the failing call")
        self.assertEqual(results[0]["status"], "success")
        self.assertEqual(results[0]["result"], 5)
        self.assertEqual(results[1]["status"], "error")

    def test_recovery_on_next_valid_input(self):
        """Contract: Exercise invalid case, explain error, demonstrate recovery on next input."""
        # 1. Invalid call
        invalid_call = {"tool": "add", "arguments": {"a": "two", "b": 3}}
        failed_res = dispatch_tool(invalid_call)
        self.assertEqual(failed_res["status"], "error")
        self.assertEqual(failed_res["error"]["code"], "INVALID_ARGUMENT_TYPE")

        # 2. Recovery call with corrected input
        recovery_call = {"tool": "add", "arguments": {"a": 2, "b": 3}}
        recovery_res = dispatch_tool(recovery_call)
        self.assertEqual(recovery_res["status"], "success")
        self.assertEqual(recovery_res["result"], 5)

    def test_documentation_alignment(self):
        """Verify lab and lesson READMEs exist and document the exact contracts."""
        current_dir = os.path.dirname(__file__)
        lab_readme = os.path.join(current_dir, 'README.md')
        lesson_readme = os.path.join(current_dir, '../../README.md')

        self.assertTrue(os.path.exists(lab_readme), "Lab README must exist")
        self.assertTrue(os.path.exists(lesson_readme), "Lesson README must exist")

        with open(lab_readme, 'r', encoding='utf-8') as f:
            lab_text = f.read()
            self.assertIn('add(2,3)', lab_text.replace(' ', ''))
            self.assertIn('multiply(2,3)', lab_text.replace(' ', ''))

        with open(lesson_readme, 'r', encoding='utf-8') as f:
            lesson_text = f.read()
            self.assertIn('r59-t038', lesson_text)


if __name__ == '__main__':
    unittest.main()
