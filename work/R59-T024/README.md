# Evidence Index: R59-T024

This directory records the verification results for coursework task R59-T024 (Template: Deterministic browser fixtures).

## Contents
- `inputs.json`: Configuration, source anchors (`#page`, `#plant-selection`, `#left-container`, `#plant1`), viewport lock, and interaction coordinates.
- `versions.json`: Node, npm, Playwright, Chromium, Git, OS versions.
- `expected-vs-actual.json`: Detailed assertion expectations and verified values.
- `results-baseline.json`: Full results when run against unmodified `org/main` source.
- `baseline-output.txt`: Console output for baseline execution.
- `results-changed.json`: Full results for the changed branch.
- `changed-output.txt`: Console output for changed branch execution.
- `results-mutant.json`: Full results when run against mutant source demonstrating defect detection.
- `mutant-output.txt`: Console output for mutant run showing exit code 1.
- `terrarium-context-a.png`: Screenshot of Context A post-drag.
- `terrarium-context-b.png`: Screenshot of Context B post-drag.

## Verification
```bash
node tests/course/r59-t024.mjs
```
