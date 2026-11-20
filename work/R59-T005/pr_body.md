## Description
Extends "JavaScript Basics: Methods and Functions" with a security scenario rubric checker implementing an offline service adapter. Evaluates fictional security scenarios covering function parameter validation, recursion bounds, and output encoding across asset, threat, control, and residual-risk dimensions while abstracting external evaluation behind a callable interface.

## Related Issue
Fixes: #5

## Type of Change
- [ ] Bug Fix
- [x] New Feature
- [ ] UI/UX Improvement
- [ ] Performance Improvement
- [x] Tests
- [x] Documentation
- [ ] Refactoring / Maintenance
- [ ] CI/CD

## Changes Made
- Created `2-js-basics/2-functions-methods/applied-labs/r59-t005/example.py` implementing `SecurityRelevanceService`, `DeterministicLocalAdapter`, and `evaluate_scenario()`.
- Created `2-js-basics/2-functions-methods/applied-labs/r59-t005/test_example.py` testing complete scenarios, missing asset failure, unrelated control review, pluggable adapter interfaces, and deliberate negative failures.
- Created `2-js-basics/2-functions-methods/applied-labs/r59-t005/README.md` documenting architecture, adapter limitations, and execution commands.
- Updated `2-js-basics/2-functions-methods/README.md` with a linked section explaining the applied lab and prerequisite behavior.
- Added verification artifacts in `work/R59-T005/NOTES.md` and `work/R59-T005/results.json`.

## Screenshots / Recordings
N/A – no UI changes

## Testing
Ran standard unittest suite in a fresh environment:
`python3 -m unittest discover -s 2-js-basics/2-functions-methods/applied-labs/r59-t005 -p "test_*.py" -v`
All 5 test cases passed with exit code 0.

## Checklist
- [x] I have tested my changes locally.
- [x] I have added or updated tests, if needed.
- [x] I have updated documentation, if needed.
- [x] I have followed the project's coding guidelines.
- [x] I have run the relevant tests and checks.
- [x] I have addressed previous review feedback, if applicable.

## Additional Notes
- The offline service adapter replaces external model/cloud APIs with deterministic token correlation, ensuring reproducible test execution without network credentials or fees.
