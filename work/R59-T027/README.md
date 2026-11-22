# Evidence Index: R59-T027

This directory contains the verification evidence for task R59-T027 (Template: Safe text rendering).

## Contents
- `inputs.json`: Configuration, source anchors (`#app`, `#login`, `#loginTitle`, `#loginHeading`), XSS test payloads, and test commands.
- `versions.json`: Node, npm, Playwright, Chromium, OS, Git versions.
- `expected-vs-actual.json`: Detailed assertion expectations vs actual observed results.
- `results-baseline.json` & `baseline-output.txt`: Baseline run against unmodified `org/main`.
- `results-changed.json` & `changed-output.txt`: Changed test execution showing 11/11 assertions passing.
- `results-mutant.json` & `mutant-output.txt`: Deliberate mutation using unsafe `innerHTML` in routing not-found view, showing injection failure and exit code 1.
- `bank-solution.png`: Screenshot of `7-bank-project/solution/index.html` displaying account and transaction payloads safely as text.
- `companion-not-found.png`: Screenshot of `7-bank-project/1-template-route/companion.html` displaying safe text rendering in 404 view.

## Verification Command
```bash
node tests/course/r59-t027.mjs
```
