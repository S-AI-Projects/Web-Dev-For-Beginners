# Applied Lab: Typed Tool Dispatch (R59-T038)

## Purpose and Problem Statement
Modern developer tools, AI agents, and microservices often invoke tools using JSON dispatch. To ensure safety, reliability, and security, tool calls must:
1. Restrict execution through an **explicit allowlist**.
2. Validate arguments against a **strict numeric schema**.
3. Return **structured error envelopes** rather than crashing.
4. **Halt execution** upon failure to prevent cascading defects ("a failed call cannot execute another tool").
5. Enable **recovery** on subsequent valid input.

## Exact Input-to-Output Contract
- `add(2, 3)` → `{"status": "success", "tool": "add", "result": 5}`
- `multiply(2, 3)` → `{"status": "success", "tool": "multiply", "result": 6}`
- Unknown tool (e.g. `divide`) → `{"status": "error", "error": {"code": "UNKNOWN_TOOL", ...}}`
- String argument (e.g. `a="2"`) → `{"status": "error", "error": {"code": "INVALID_ARGUMENT_TYPE", "argument": "a", ...}}`
- Pipeline execution: stops immediately on first failed call; subsequent tools in the batch are not executed.
- Recovery: After receiving an error, submitting valid input succeeds cleanly.

## Running the Example and Automated Checks

Run the interactive demonstration:
```bash
python3 1-getting-started-lessons/1-intro-to-programming-languages/applied-labs/r59-t038/example.py
```

Run the unit test suite:
```bash
python3 -m unittest discover -s 1-getting-started-lessons/1-intro-to-programming-languages/applied-labs/r59-t038 -p "test_*.py"
```

## Scope and Boundaries
- Uses Python standard library only.
- Represents a local dispatch contract simulation; does not implement a full network/MCP transport.
