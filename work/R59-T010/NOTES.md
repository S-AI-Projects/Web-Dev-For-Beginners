# Work Notes: R59-T010

## Overview
- **Task ID**: R59-T010
- **Issue**: #10
- **Topic**: Catch a plausible UI regression: 5-browser-extension/1-about-browsers
- **Branch**: `student/e26b07f0785/R59-T010`
- **Target Page**: `5-browser-extension/start/dist/index.html` (anchor `img`)

## Objectives & Scope
- Scope: Extension popup initialization and its browser-context assumptions.
- Record the main visible baseline behavior of the extension popup.
- Deliberately break a style rule in a temporary test fixture and add a strict behavioral UI assertion that distinguishes between the broken regression and the correct state.
- Ensure the production application contains no mutation.

## Environment & Tool Versions
- **Node.js**: v24.22.1
- **Playwright**: ^1.65.1 (Headless Chromium 159.0.8154.6)

## Implementation Details
1. **Baseline Assessment (`5-browser-extension/start/dist/index.html`)**:
   - The production extension popup loads with `body.container`, rendering `img` (`plants-people.png`) with responsive `max-width: 100%`, border radius `var(--rc)`, and centered heading text.
   - Verified that the production application files remain completely unmutated.
2. **Documentation (`5-browser-extension/1-about-browsers/README.md`)**:
   - Added an **Automated UI Regression Testing** section specifying test command `node tests/course/r59-t010.mjs` and explaining verification checks.
3. **Automated Test Suite (`tests/course/r59-t010.mjs`)**:
   - Spins up a local HTTP server serving the production popup at `/index.html` and the temporary mutated fixture at `/fixture/index.html`.
   - Tests baseline popup: asserts source anchor `img` exists, is visible, has non-zero rendered bounding box, has natural width/height > 0, and captures `baseline-correct.png`.
   - Tests deliberate regression: in a temporary fixture where `img` styling is broken (`display: none !important`), executes the exact same assertion and verifies that it throws `AssertionError: UI regression detected`.
   - Captures `mutated-regression.png`.
   - Validates that production application files on disk contain no mutations.
   - Saves metrics and checks to `work/R59-T010/results.json`.

## Captured Evidence
- Baseline correct view: `work/R59-T010/baseline-correct.png`
- Mutated regression view: `work/R59-T010/mutated-regression.png`
- Detailed metrics: `work/R59-T010/results.json`
