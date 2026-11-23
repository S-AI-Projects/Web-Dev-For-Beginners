## Summary of Changes

Closes #38.

### Purpose
Addresses task **R59-T038** (`typed tool dispatch — failure and recovery example: 1-getting-started-lessons/1-intro-to-programming-languages`):
- Created an applied Python lab under `1-getting-started-lessons/1-intro-to-programming-languages/applied-labs/r59-t038/` demonstrating typed tool dispatch, schema validation, structured error handling, and recovery.
- Implemented dispatch for allowed tools (`add(2, 3) -> 5`, `multiply(2, 3) -> 6`) with numeric validation for arguments `a` and `b`.
- Structured error envelopes for unknown tools (`UNKNOWN_TOOL`) and invalid/string arguments (`INVALID_ARGUMENT_TYPE`).
- Implemented fail-safe pipeline dispatch where a failed call halts execution and prevents subsequent tools from executing.
- Demonstrated error explanation and clean recovery on subsequent valid inputs.
- Created unit tests covering all success, failure, pipeline halting, and recovery paths.
- Documented testing instructions in `applied-labs/r59-t038/README.md` and linked it from `1-getting-started-lessons/1-intro-to-programming-languages/README.md`.

### Verification
- `python3 -m unittest discover -s 1-getting-started-lessons/1-intro-to-programming-languages/applied-labs/r59-t038 -p "test_*.py"` runs and passes all 8 test cases (exit code 0).
- Evidence captured in `work/R59-T038/` (`results.json`, `baseline.json`, `versions.json`).
