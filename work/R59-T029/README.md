# Evidence Index: R59-T029

This directory contains the verification evidence for coursework task R59-T029 (Template: Empty and error states).

## Contents
- `inputs.json`: Source anchors, viewports, network routing rules, and test scenarios.
- `versions.json`: Node, npm, Playwright, Chromium, Git, and operating system versions.
- `expected-vs-actual.json`: Detailed assertion expectations vs baseline and changed outcomes across 12 assertions.
- `results-baseline.json` & `baseline-output.txt`: Baseline evaluation against `org/main` showing 4 assertion failures (exit code 1).
- `results-changed.json` & `changed-output.txt`: Changed evaluation showing all 12 assertions passing cleanly (exit code 0).
- `results-mutant.json` & `mutant-output.txt`: Mutant defect run demonstrating assertion rejection and non-zero exit code.
- `terrarium-normal.png`: Screenshot of normal terrarium rendering with intact assets and stacking.
- `terrarium-fallback.png`: Screenshot of missing plant asset rendering readable fallback badge within shelf boundaries.

## Verification Command
```bash
node tests/course/r59-t029.mjs
```
