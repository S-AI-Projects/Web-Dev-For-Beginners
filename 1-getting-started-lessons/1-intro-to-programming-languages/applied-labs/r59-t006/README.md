# Applied Lab R59-T006: Typed Tool Dispatch and Schema Validation Refactoring

**Curriculum Topic:** 1-getting-started-lessons/1-intro-to-programming-languages  
**Student:** Vedika Yadav (URN: `e26b07f0785`)

---

## 1. Overview and Lesson Alignment

In modern programming, developer tooling, RPC systems, and AI agent frameworks rely on typed tool dispatch:
- Commands are structured as JSON envelopes containing a tool name and argument payloads.
- Calls are constrained by an explicit security allowlist.
- Arguments are validated strictly before dispatch.
- When an error occurs, execution stops immediately to prevent cascading side-effects.

---

## 2. Refactoring Responsibility

- **Baseline (`dispatch_tool_baseline`)**: Handles allowlist check, type validation, and calculation within a single monolithic branch.
- **Refactoring (`validate_numeric_arguments`)**: Extracted argument schema validation into a dedicated, reusable function responsibility.
- **Equivalence**: Verified across all edge cases (missing arguments, non-numeric types, booleans, unregistered tools) in `test_before_after_refactor_equivalence`.

---

## 3. Tool Dispatch Contract & Behaviors

| Input Call | Expected Status | Result / Error Code | Behavior |
| :--- | :--- | :--- | :--- |
| `{"tool": "add", "arguments": {"a": 2, "b": 3}}` | `success` | `5` | Sum calculated |
| `{"tool": "multiply", "arguments": {"a": 2, "b": 3}}` | `success` | `6` | Product calculated |
| `{"tool": "unknown", "arguments": {"a": 2, "b": 3}}` | `error` | `UNKNOWN_TOOL` | Denied by allowlist |
| `{"tool": "add", "arguments": {"a": "string", "b": 3}}` | `error` | `INVALID_ARGUMENT_TYPE` | Type check rejection |
| Pipeline with step 2 failing | `halted_on_error` | Step 3 not executed | Execution stops on first error |

---

## 4. Running the Automated Checks

```bash
python3 -m unittest discover -s 1-getting-started-lessons/1-intro-to-programming-languages/applied-labs/r59-t006 -p "test_*.py" -v
```

---

## 5. Scope & Limitations
This fixture is a local contract demonstration running in pure Python; it does not implement a full JSON-RPC network or MCP transport.
