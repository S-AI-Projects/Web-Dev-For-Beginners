# Task R59-T016 - Verification Notes

**Task:** security-scenario rubric — refactor the teaching example: 2-js-basics/3-making-decisions
**Module:** `2-js-basics/3-making-decisions/applied-labs/r59-t016/`
**Student:** Alok Gupta (URN: E26B07F0573)

## Overview & Lesson Alignment
- In "JavaScript Basics: Making Decisions", students learn comparison operators and multi-branch condition evaluations.
- This applied lab implements a structural rubric checker in `example.py` that evaluates security decisions across four standard fields: `asset`, `threat`, `control`, and `residual_risk`.

## Scenarios & Results
1. `complete_valid`:
   - Asset: "User Authentication Session Token"
   - Threat: "Token theft via session hijacking / replay attack"
   - Control: "Conditional check validating token expiration and IP binding before granting access"
   - Residual Risk: "Token theft if the user device's storage is compromised directly"
   - Result: `PASS`
2. `missing_asset`:
   - Asset missing/empty.
   - Result: `FAIL` (flags missing required field: asset)
3. `unrelated_control`:
   - Asset: "Customer Database Records"
   - Threat: "SQL Injection in search query condition"
   - Control: "Adding client-side image compression before uploading profile avatars"
   - Result: `REVIEW` (flags control unrelated to threat)

## Refactoring Responsibility
- **Initial Baseline**: `evaluate_scenario_baseline()` handled both required-field checking and keyword matching in a single function.
- **Refactoring**: Extracted `validate_control_relevance(threat, control)` into a dedicated validator function, cleanly separating structural field presence checks from semantic relevance evaluation.
- **Equivalence**: Verified through `test_refactor_equivalence_with_baseline` that both implementations produce identical statuses across all scenarios.
- **Negative Testing**: Verified through `test_deliberate_wrong_result_fails` that an erroneous expectation raises an `AssertionError`.

## Automated Check
- Command: `python3 -m unittest discover -s 2-js-basics/3-making-decisions/applied-labs/r59-t016 -p "test_*.py" -v`
- Ran: 5 tests
- Result: OK (exit code 0)

## Tool Versions
- Python: 3.13.15
- Framework: unittest (standard library)
