# Task R59-T020 - Verification Notes

**Task:** Catch a plausible UI regression: 5-browser-extension/2-forms-browsers-local-storage
**Page:** `5-browser-extension/start/dist/index.html`
**Student:** Alok Gupta (URN: E26B07F0573)

## Baseline Behavior
- The starter page `5-browser-extension/start/dist/index.html` had placeholder comments for form and result regions.
- As taught in Lesson 2, the user submits region credentials and an API key to display carbon usage metrics stored in `localStorage`.
- Without a regression check, broken submit event bindings or form handlers could fail silently without visual updates.

## Changes Made
1. In `5-browser-extension/start/dist/index.html`:
   - Implemented `.form-data` with region and API key inputs and submit button.
   - Implemented `.result-container` and `.clear-btn` for displaying carbon data.
2. In `5-browser-extension/start/dist/main.js`:
   - Wired `submit` event listener on `.form-data` to persist data in `localStorage` and transition view to results.
   - Wired `click` event on `.clear-btn` to reset state.
3. Created Playwright automated check `tests/course/r59-t020.mjs`:
   - Part 1: Tests production page. Verifies `img` anchor with `alt="plants and people"`. Submits valid region and asserts form hiding, result container display, and `localStorage` update.
   - Part 2: Tests temporary mutated fixture (breaks submit event listener in mock route). Asserts that the test flags the failure (form remains visible, results not rendered).
   - Confirms that the final production application contains no mutation.
4. Updated `5-browser-extension/2-forms-browsers-local-storage/README.md` with test documentation.

## Automated Check Results
- Command: `node tests/course/r59-t020.mjs`
- Exit Code: `0`
- Results:
  - Source anchor `img` verified: PASS
  - Production form submission and state transition: PASS
  - Deliberate mutation detected by regression check: PASS
  - Screenshots saved: `work/R59-T020/correct-state.png` and `work/R59-T020/mutated-state.png`.
  - Results JSON saved: `work/R59-T020/results.json`.

## Tool Versions
- Node.js: v26.7.0
- Playwright: ^1.65.0
- Chromium: Headless Shell 158.0.8127.18
