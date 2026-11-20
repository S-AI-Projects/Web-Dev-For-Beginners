"""
Typed Tool Dispatch with Refactored Schema Validation
Applied Lab: R59-T006
Curriculum: 1-getting-started-lessons/1-intro-to-programming-languages
Student: Vedika Yadav (URN: e26b07f0785)

This module demonstrates typed tool dispatch for local JSON calls:
- Tools: add(a, b), multiply(a, b)
- Explicit allowlist
- Numeric argument validation
- Structured errors for unknown tools or invalid argument types
- Halting execution on failure
- Extracted validation responsibility with proven before/after equivalence.
"""

from typing import Dict, Any, List, Tuple, Optional


ALLOWED_TOOLS = ["add", "multiply"]


# ---------------------------------------------------------------------------
# Baseline Monolithic Implementation
# ---------------------------------------------------------------------------

def dispatch_tool_baseline(call: Dict[str, Any]) -> Dict[str, Any]:
    """
    Baseline monolithic implementation that performs allowlist checking,
    inline argument type validation, and calculation in a single function.
    """
    tool_name = call.get("tool")
    if tool_name not in ALLOWED_TOOLS:
        return {
            "status": "error",
            "error": {
                "code": "UNKNOWN_TOOL",
                "message": f"Tool '{tool_name}' is not in the allowlist"
            }
        }

    args = call.get("arguments", {})
    if not isinstance(args, dict):
        return {
            "status": "error",
            "error": {
                "code": "INVALID_ARGUMENTS_OBJECT",
                "message": "Arguments must be provided as a key-value dictionary"
            }
        }

    if "a" not in args or "b" not in args:
        return {
            "status": "error",
            "error": {
                "code": "MISSING_ARGUMENT",
                "message": "Both arguments 'a' and 'b' are required"
            }
        }

    a = args["a"]
    b = args["b"]

    # Reject booleans (which are instances of int in Python) and non-numeric types
    if isinstance(a, bool) or not isinstance(a, (int, float)):
        return {
            "status": "error",
            "error": {
                "code": "INVALID_ARGUMENT_TYPE",
                "argument": "a",
                "message": f"Argument 'a' must be numeric (int or float), got {type(a).__name__}"
            }
        }

    if isinstance(b, bool) or not isinstance(b, (int, float)):
        return {
            "status": "error",
            "error": {
                "code": "INVALID_ARGUMENT_TYPE",
                "argument": "b",
                "message": f"Argument 'b' must be numeric (int or float), got {type(b).__name__}"
            }
        }

    if tool_name == "add":
        result = a + b
    elif tool_name == "multiply":
        result = a * b
    else:
        return {
            "status": "error",
            "error": {
                "code": "UNKNOWN_TOOL",
                "message": f"Unhandled tool '{tool_name}'"
            }
        }

    return {
        "status": "success",
        "tool": tool_name,
        "result": result
    }


# ---------------------------------------------------------------------------
# Refactored Implementation (Extracted Responsibility: Argument Validation)
# ---------------------------------------------------------------------------

def validate_numeric_arguments(args: Any) -> Tuple[bool, Optional[Dict[str, Any]], Optional[Tuple[float, float]]]:
    """
    Extracted named responsibility: Validates that arguments conform to numeric schema.
    Returns: (is_valid, error_envelope, (a, b))
    """
    if not isinstance(args, dict):
        return False, {
            "code": "INVALID_ARGUMENTS_OBJECT",
            "message": "Arguments must be provided as a key-value dictionary"
        }, None

    if "a" not in args or "b" not in args:
        return False, {
            "code": "MISSING_ARGUMENT",
            "message": "Both arguments 'a' and 'b' are required"
        }, None

    a = args["a"]
    b = args["b"]

    if isinstance(a, bool) or not isinstance(a, (int, float)):
        return False, {
            "code": "INVALID_ARGUMENT_TYPE",
            "argument": "a",
            "message": f"Argument 'a' must be numeric (int or float), got {type(a).__name__}"
        }, None

    if isinstance(b, bool) or not isinstance(b, (int, float)):
        return False, {
            "code": "INVALID_ARGUMENT_TYPE",
            "argument": "b",
            "message": f"Argument 'b' must be numeric (int or float), got {type(b).__name__}"
        }, None

    return True, None, (a, b)


TOOL_REGISTRY = {
    "add": lambda a, b: a + b,
    "multiply": lambda a, b: a * b,
}


def dispatch_tool(call: Dict[str, Any]) -> Dict[str, Any]:
    """
    Refactored dispatcher delegating schema validation to validate_numeric_arguments
    and execution to TOOL_REGISTRY.
    """
    tool_name = call.get("tool")
    if tool_name not in TOOL_REGISTRY:
        return {
            "status": "error",
            "error": {
                "code": "UNKNOWN_TOOL",
                "message": f"Tool '{tool_name}' is not in the allowlist"
            }
        }

    is_valid, error_dict, values = validate_numeric_arguments(call.get("arguments"))
    if not is_valid:
        return {
            "status": "error",
            "error": error_dict
        }

    a, b = values
    result = TOOL_REGISTRY[tool_name](a, b)

    return {
        "status": "success",
        "tool": tool_name,
        "result": result
    }


def execute_tool_pipeline(calls: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Executes a sequence of tool calls.
    Contract: A failed call immediately halts execution; subsequent tools are NOT executed.
    """
    results = []
    executed_tools = []

    for call in calls:
        res = dispatch_tool(call)
        results.append(res)
        if res.get("status") == "error":
            return {
                "status": "halted_on_error",
                "executed_count": len(executed_tools),
                "executed_tools": executed_tools,
                "error": res["error"],
                "results": results
            }
        executed_tools.append(res["tool"])

    return {
        "status": "completed",
        "executed_count": len(executed_tools),
        "executed_tools": executed_tools,
        "results": results
    }


# Standard fixtures
STANDARD_FIXTURES = [
    {"tool": "add", "arguments": {"a": 2, "b": 3}},
    {"tool": "multiply", "arguments": {"a": 2, "b": 3}},
    {"tool": "unknown_calc", "arguments": {"a": 2, "b": 3}},
    {"tool": "add", "arguments": {"a": "invalid_string", "b": 3}},
    {"tool": "multiply", "arguments": {"a": 4, "b": "invalid_b"}},
    {"tool": "add", "arguments": {"a": True, "b": 3}},
    {"tool": "multiply", "arguments": {}},
]
