# Evidence Index: R59-T021

This folder contains verification artifacts and automated check results for task **R59-T021**: *Verify keyboard use: 7-bank-project/1-template-route*.

## Artifacts

- `inputs.json`: Test parameters, targeted anchors, viewports, fixtures, and execution command.
- `versions.json`: Environment toolchain versions (Node.js, npm, Playwright, Chromium, OS, git commits).
- `expected-vs-actual.json`: Matrix comparing expected values against baseline and changed run outputs.
- `results-baseline.json`: Test execution output against pristine `org/main` archive.
- `baseline-output.txt`: Raw test log for baseline execution.
- `results-changed.json`: Test execution output on working branch.
- `changed-output.txt`: Raw test log for changed execution.
- `results-mutant.json`: Self-proof test execution against deliberately mutated source with positive tabindex.
- `mutant-output.txt`: Raw test log showing expected failure on mutant.
- `login-focused.png`: Screenshot showing visible focus styling on the login view.
- `dashboard-focused.png`: Screenshot showing visible focus styling on the dashboard view.

## Reproduction Instructions

1. Install dependencies:
   ```bash
   PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install --save-dev --save-exact playwright@1.65.1
   npx playwright install chromium
   ```

2. Run the automated check from the repository root:
   ```bash
   node tests/course/r59-t021.mjs
   ```

3. Run self-proof check against a temporary copy:
   ```bash
   TMP_MUT=$(mktemp -d)
   git archive org/main 7-bank-project/ | tar -x -C "$TMP_MUT"
   sed -i '' 's|id="username"|id="username" tabindex="3"|' "$TMP_MUT/7-bank-project/solution/index.html"
   R59_SERVE_ROOT="$TMP_MUT" R59_LABEL=mutant node tests/course/r59-t021.mjs
   rm -rf "$TMP_MUT"
   ```
