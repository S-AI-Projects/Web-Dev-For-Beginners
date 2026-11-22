# Evidence Index: R59-T026

This directory contains verification evidence for task R59-T026 (Template: Feature-support fallback).

## Contents
- `inputs.json`: Configuration, source anchor (`img`), viewports, feature definition, and command.
- `versions.json`: Node, npm, Playwright, Chromium, OS, Git versions.
- `expected-vs-actual.json`: Detailed assertion expectations vs observed values.
- `results-baseline.json` & `baseline-output.txt`: Baseline run against `org/main` showing missing form harness.
- `results-changed.json` & `changed-output.txt`: Full suite pass (9/9 assertions passing, 0 errors).
- `results-mutant.json` & `mutant-output.txt`: Deliberate mutation omitting fallback text, failing with exit code 1.
- `starter-popup.png`: Screenshot of `5-browser-extension/start/dist/index.html`.
- `feature-present-saved.png`: Screenshot showing successful form submission and persistent storage.
- `feature-absent-fallback.png`: Screenshot showing fallback notification and session-only execution.

## Verification
```bash
node tests/course/r59-t026.mjs
```
