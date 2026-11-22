# Evidence Index: R59-T023

This folder contains verification artifacts and automated check results for task **R59-T023**: *Check repeat initialization: 5-browser-extension/1-about-browsers*.

## Artifacts

- `inputs.json`: Test parameters, targeted anchors, viewports, and execution command.
- `versions.json`: Environment toolchain versions (Node.js, npm, Playwright, Chromium, OS, git commits).
- `expected-vs-actual.json`: Matrix comparing expected values against baseline and changed run outputs.
- `results-baseline.json`: Test execution output against pristine `org/main` archive showing initial missing harness state.
- `baseline-output.txt`: Raw test log for baseline execution.
- `results-changed.json`: Test execution output on working branch showing 10/10 passing assertions.
- `changed-output.txt`: Raw test log for changed execution.
- `results-mutant.json`: Self-proof test execution against deliberately mutated source with leaked timer.
- `mutant-output.txt`: Raw test log showing expected non-zero failure on mutant (`harness_cleanup_leaves_zero_leaks`).
- `popup-initial.png`: Screenshot of extension popup rendered in Chromium.
- `harness-toggled.png`: Screenshot of lifecycle harness after repeated toggles.

## Reproduction Instructions

1. Install dependencies:
   ```bash
   PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install --save-dev --save-exact playwright@1.65.1
   npx playwright install chromium
   ```

2. Run the automated check from the repository root:
   ```bash
   node tests/course/r59-t023.mjs
   ```

3. Run self-proof check against a temporary copy:
   ```bash
   TMP_MUT=$(mktemp -d)
   cp -r 5-browser-extension "$TMP_MUT/"
   sed -i '' 's|clearInterval(activeTimer);|// leak timer|' "$TMP_MUT/5-browser-extension/1-about-browsers/harness.html"
   R59_SERVE_ROOT="$TMP_MUT" R59_LABEL=mutant node tests/course/r59-t023.mjs
   rm -rf "$TMP_MUT"
   ```
