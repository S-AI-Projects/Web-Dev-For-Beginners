# Evidence Index: R59-T025

This directory contains the verification evidence for coursework task R59-T025 (Template: Worked example with checks).

## Contents
- `inputs.json`: Reference scenario fixtures, schema specifications, and evaluation rules.
- `versions.json`: Python, Node, Git, OS environment versions.
- `expected-vs-actual.json`: Detailed assertion expectations vs actual evaluation outcomes.
- `results-baseline.json` & `baseline-output.txt`: Baseline execution showing non-existence of lab on `org/main`.
- `results-changed.json` & `changed-output.txt`: Changed execution output showing 10/10 tests passing cleanly.
- `results-mutant.json` & `mutant-output.txt`: Mutant defect run showing 3 failures, 1 error, and exit code 1.

## Verification Command
```bash
python3 -m unittest discover -s 2-js-basics/3-making-decisions/applied-labs/r59-t025 -p "test_*.py" -v
```
