# Evidence Index: R59-T030

This directory contains the verification evidence for coursework task R59-T030 (Template: Scenario assessment).

## Contents
- `inputs.json`: Reference dependency plans (`PLAN_CANONICAL`, `PLAN_CYCLE_2`, `PLAN_UNKNOWN_DEP`, `PLAN_A11Y_REMEDIATION`) and applied questions specification.
- `versions.json`: Tool, language, git commit, and operating system versions.
- `expected-vs-actual.json`: Detailed assertion expectations vs actual evaluation outcomes across 16 test cases.
- `results-baseline.json` & `baseline-output.txt`: Baseline execution showing absence of applied lab on `org/main` (non-zero exit code).
- `results-changed.json` & `changed-output.txt`: Changed execution output showing 16/16 tests passing cleanly (zero exit code).
- `results-mutant.json` & `mutant-output.txt`: Mutant defect execution showing unknown dependency defect detection and non-zero exit code.

## Verification Command
```bash
python3 -m unittest discover -s 1-getting-started-lessons/3-accessibility/applied-labs/r59-t030 -p "test_*.py" -v
```
