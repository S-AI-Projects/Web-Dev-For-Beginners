## Summary of Changes

Closes #40.

### Purpose
Addresses task **R59-T040** (`security-scenario rubric — scenario assessment: 2-js-basics/4-arrays-loops`):
- Created an applied Python lab under `2-js-basics/4-arrays-loops/applied-labs/r59-t040/` implementing a structural security-scenario rubric checker.
- Formulated 3 reference security scenarios representing arrays and iteration in browser environments:
  - `SCENARIO_1_COMPLETE`: token array protection via element validation (`pass`).
  - `SCENARIO_2_MISSING_ASSET`: missing asset field fails validation (`fail`).
  - `SCENARIO_3_UNRELATED_CONTROL`: unrelated compression control for SQL injection threat flagged for review (`flagged_for_review`).
- Added 3 applied factual questions with rationales and executable checks:
  - Predicting output for complete scenarios.
  - Diagnosing failure causes for missing assets.
  - Defining boundary policy for unclassified domains.
- Created unit test suite in `test_example.py` validating the rubric checker, error cases, and applied questions.
- Documented testing instructions in `applied-labs/r59-t040/README.md` and linked it from `2-js-basics/4-arrays-loops/README.md`.

### Verification
- `python3 -m unittest discover -s 2-js-basics/4-arrays-loops/applied-labs/r59-t040 -p "test_*.py"` runs and passes all 8 test cases (exit code 0).
- Evidence captured in `work/R59-T040/` (`results.json`, `baseline.json`, `versions.json`).
