## Summary of Changes

Closes #37.

### Purpose
Addresses task **R59-T037** (`training-only imputation — worked example with checks: 1-getting-started-lessons/2-github-basics`):
- Created an applied Python lab under `1-getting-started-lessons/2-github-basics/applied-labs/r59-t037/` demonstrating strict fit/transform separation to eliminate data leakage.
- Implemented `MeanImputer`:
  - `fit()` computes the arithmetic mean on training observations only (`[2, None, 4]` yields `3.0`).
  - `transform()` applies the stored training mean to validation sets (`[100, None]` becomes `[100.0, 3.0]`, explicitly avoiding leakage of `100.0`).
  - Rejects all-missing training input (`[None, None]`) and un-fitted transformations.
- Created unit test suite in `test_example.py` validating the exact contract, boundary conditions, and documentation agreement.
- Documented the worked example in `applied-labs/r59-t037/README.md` and linked it from `1-getting-started-lessons/2-github-basics/README.md`.

### Verification
- `python3 -m unittest discover -s 1-getting-started-lessons/2-github-basics/applied-labs/r59-t037 -p "test_*.py"` runs 7 tests and passes (exit code 0).
- Evidence captured in `work/R59-T037/` (`results.json`, `baseline.json`, `versions.json`).
