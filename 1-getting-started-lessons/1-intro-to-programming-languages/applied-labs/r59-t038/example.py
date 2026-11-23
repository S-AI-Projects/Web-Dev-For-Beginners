"""
Typed Tool Dispatch with Failure and Recovery.
R59-T038: Applied Lab for 1-getting-started-lessons/1-intro-to-programming-languages.
"""

from typing import Any, Dict, List, Optional, Tuple, Union

ALLOWED_TOOLS = ["add", "multiply"]


def validate_call(call: Dict[str, Any]) -> Tuple[bool, Optional[Dict[str, Any]], Optional[Tuple[float, float]]]:
    """
    Validates tool name against explicit allowlist and ensures arguments 'a' and 'b' are numeric.

    Returns:
        (is_valid, error_envelope, (a, b))
    """
    if not isinstance(call, dict):
        return False, {
            "status": "error",
            "error": {
                "code": "INVALID_CALL_FORMAT",
                "message": "Tool call must be a dictionary object"
            }
        }, None

    tool = call.get("tool")
    if tool not in ALLOWED_TOOLS:
        return False, {
            "status": "error",
            "error": {
                "code": "UNKNOWN_TOOL",
                "message": f"Tool '{tool}' is not in the allowed tools list: {ALLOWED_TOOLS}"
            }
        }, None

    args = call.get("arguments")
    if not isinstance(args, dict):
        return False, {
            "status": "error",
            "error": {
                "code": "INVALID_ARGUMENTS_OBJECT",
                "message": "Arguments must be a key-value dictionary"
            }
        }, None

    if "a" not in args or "b" not in args:
        return False, {
            "status": "error",
            "error": {
                "code": "MISSING_ARGUMENT",
                "message": "Both arguments 'a' and 'b' are required"
            }
        }, None

    a = args["a"]
    b = args["b"]

    # Reject boolean types (bool is subclass of int in Python)
    if isinstance(a, bool) or not isinstance(a, (int, float)):
        return False, {
            "status": "error",
            "error": {
                "code": "INVALID_ARGUMENT_TYPE",
                "argument": "a",
                "message": f"Argument 'a' must be numeric (int or float), got {type(a).__name__}"
            }
        }, None

    if isinstance(b, bool) or not isinstance(b, (int, float)):
        return False, {
            "status": "error",
            "error": {
                "code": "INVALID_ARGUMENT_TYPE",
                "argument": "b",
                "message": f"Argument 'b' must be numeric (int or float), got {type(b).__name__}"
            }
        }, None

    return True, None, (float(a), float(b))


def dispatch_tool(call: Dict[str, Any]) -> Dict[str, Any]:
    """
    Dispatches a single local JSON tool call through schema validation and allowlist.
    Contract:
      - add(2, 3) -> 5
      - multiply(2, 3) -> 6
      - Unknown tool or string argument -> structured error envelope
    """
    is_valid, error_envelope, validated_args = validate_call(call)
    if not is_valid:
        return error_envelope

    tool = call["tool"]
    a, b = validated_args

    if tool == "add":
        result = a + b
    elif tool == "multiply":
        result = a * b
    else:
        # Fallback safeguard
        return {
            "status": "error",
            "error": {"code": "UNKNOWN_TOOL", "message": f"Tool '{tool}' cannot be handled"}
        }

    # Format integers cleanly when applicable
    if result.is_integer():
        result = int(result)

    return {
        "status": "success",
        "tool": tool,
        "result": result
    }


def dispatch_pipeline(calls: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Executes a sequence of tool calls.
    Contract rule: A failed call cannot execute another tool (halts pipeline execution).
    """
    results = []
    for call in calls:
        res = dispatch_tool(call)
        results.append(res)
        if res.get("status") == "error":
            # Halt immediately: failed call blocks subsequent tool execution
            break
    return results


def run_worked_example():
    """Runs the worked example demonstrating success, failure, halting, and recovery."""
    print("=== 1. Valid Dispatches ===")
    r1 = dispatch_tool({"tool": "add", "arguments": {"a": 2, "b": 3}})
    print(f"add(2, 3)        -> {r1}")

    r2 = dispatch_tool({"tool": "multiply", "arguments": {"a": 2, "b": 3}})
    print(f"multiply(2, 3)   -> {r2}")

    print("\n=== 2. Structured Errors ===")
    r3 = dispatch_tool({"tool": "divide", "arguments": {"a": 2, "b": 3}})
    print(f"Unknown tool     -> {r3}")

    r4 = dispatch_tool({"tool": "add", "arguments": {"a": "2", "b": 3}})
    print(f"String argument  -> {r4}")

    print("\n=== 3. Pipeline Halting on Failure ===")
    pipeline = [
        {"tool": "add", "arguments": {"a": 2, "b": 3}},
        {"tool": "add", "arguments": {"a": "invalid", "b": 3}},
        {"tool": "multiply", "arguments": {"a": 2, "b": 3}}
    ]
    pipe_results = dispatch_pipeline(pipeline)
    print(f"Pipeline executed {len(pipe_results)} calls before halting on error.")

    print("\n=== 4. Recovery on Next Valid Input ===")
    recovery_call = {"tool": "add", "arguments": {"a": 2, "b": 3}}
    r_recovered = dispatch_tool(recovery_call)
    print(f"Next valid call -> {r_recovered}")


if __name__ == '__main__':
    run_worked_example()
