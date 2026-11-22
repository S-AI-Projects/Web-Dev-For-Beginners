# Evidence Index: R59-T028

This directory contains the verification evidence for coursework task R59-T028 (Template: Worked example with checks).

## Contents
- `inputs.json`: Controlled configuration fixtures (`CFG-SMALL`, `CFG-MEDIUM`, `CFG-LARGE`), validation criteria, and metric definitions.
- `versions.json`: Tool, language, git commit, and operating system versions.
- `expected-vs-actual.json`: Detailed assertion expectations vs actual evaluation outcomes across 13 test cases.
- `results-baseline.json` & `baseline-output.txt`: Baseline execution showing absence of applied lab on `org/main` (non-zero exit code).
- `results-changed.json` & `changed-output.txt`: Changed execution output showing 13/13 tests passing cleanly (zero exit code).
- `results-mutant.json` & `mutant-output.txt`: Mutant defect execution showing redaction defect detection and non-zero exit code.

## Verification Command
```bash
python3 -m unittest discover -s 8-code-editor/1-using-a-code-editor/applied-labs/r59-t028 -p "test_*.py" -v
```
