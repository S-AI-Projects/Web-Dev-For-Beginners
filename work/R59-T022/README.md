# Evidence Index: R59-T022

This folder contains verification artifacts and automated check results for task **R59-T022**: *Protect the layout at two widths: 3-terrarium/2-intro-to-css*.

## Artifacts

- `inputs.json`: Test parameters, target anchors, viewports (360x800 and 1280x800), and execution command.
- `versions.json`: Environment toolchain versions (Node.js, npm, Playwright, Chromium, OS, git commits).
- `expected-vs-actual.json`: Matrix comparing expected values against baseline and changed run outputs.
- `results-baseline.json`: Test execution output against pristine `org/main` archive demonstrating baseline horizontal overflow at 360px.
- `baseline-output.txt`: Raw test log for baseline execution.
- `results-changed.json`: Test execution output on working branch with CSS fix applied.
- `changed-output.txt`: Raw test log for changed execution showing 10/10 passing assertions.
- `results-mutant.json`: Self-proof test execution against deliberately mutated source with oversized width.
- `mutant-output.txt`: Raw test log showing expected non-zero failure on mutant.
- `terrarium-360.png`: Screenshot of terrarium layout rendered at 360x800 viewport.
- `terrarium-1280.png`: Screenshot of terrarium layout rendered at 1280x800 viewport.

## Reproduction Instructions

1. Install dependencies:
   ```bash
   PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install --save-dev --save-exact playwright@1.65.1
   npx playwright install chromium
   ```

2. Run the automated check from the repository root:
   ```bash
   node tests/course/r59-t022.mjs
   ```

3. Run self-proof check against a temporary copy:
   ```bash
   TMP_MUT=$(mktemp -d)
   cp -r 3-terrarium "$TMP_MUT/"
   echo "#page { width: 3000px; }" >> "$TMP_MUT/3-terrarium/solution/style.css"
   R59_SERVE_ROOT="$TMP_MUT" R59_LABEL=mutant node tests/course/r59-t022.mjs
   rm -rf "$TMP_MUT"
   ```
