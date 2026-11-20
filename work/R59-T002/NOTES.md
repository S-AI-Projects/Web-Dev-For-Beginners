# Task R59-T002 - Verification Notes

**Task:** dependency-plan validation — boundary-case lesson extension: 1-getting-started-lessons/3-accessibility
**Module:** `1-getting-started-lessons/3-accessibility/applied-labs/r59-t002/`
**Student:** Vedika Yadav (URN: `e26b07f0785`)

## 1. Lesson Alignment & Context
- In "Creating Accessible Webpages", developers learn that accessibility requirements have prerequisites (e.g. valid semantic structure must exist before keyboard navigation and ARIA landmarks can be audited reliably).
- This applied lab implements a deterministic topological orderer and cycle/unknown dependency validator for task plans in `example.py`.

## 2. Fixtures & Test Results
- **Standard Linear (`standard_linear`)**: Plan `{A: [], B: [A], C: [B]}` produces `['A', 'B', 'C']`. Status: PASS.
- **Cycle Rejection (`cyclic_two_node`)**: Plan `{A: [B], B: [A]}` raises `CircularDependencyError` with cycle node details. Status: PASS.
- **Unknown Dependency (`unknown_dependency`)**: Plan `{A: [], B: [A], C: ['NON_EXISTENT_TASK']}` raises `MissingDependencyError` with `missing_dep_id="NON_EXISTENT_TASK"`. Status: PASS.
- **Boundary Case - Empty (`boundary_empty`)**: Empty plan `{}` produces `[]`. Status: PASS.
- **Boundary Case - Single Task (`boundary_single`)**: Single task `{A: []}` produces `['A']`. Status: PASS.
- **Boundary Case - Self-referential Cycle (`boundary_self_cycle`)**: `{A: [A]}` raises `CircularDependencyError`. Status: PASS.
- **Deterministic Disconnected Ordering (`multiple_independent`)**: Multiple zero-in-degree nodes sorted alphabetically `['TaskA', 'TaskM', 'TaskZ']`. Status: PASS.
- **Negative Assertion Check (`test_deliberate_wrong_result_fails`)**: Deliberate incorrect assertion raises `AssertionError`. Status: PASS.

## 3. Automated Check
- Command: `python3 -m unittest discover -s 1-getting-started-lessons/3-accessibility/applied-labs/r59-t002 -p "test_*.py" -v`
- Result: 8 tests passed, 0 failures, 0 errors. Exit code: 0.

## 4. Tool Versions
- Python: 3.15.0
- Test Runner: unittest (Python Standard Library)
