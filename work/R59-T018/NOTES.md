# Task R59-T018 - Verification Notes

**Task:** Keep fixture text as text: 3-terrarium/1-intro-to-html
**Page:** `3-terrarium/solution/index.html`
**Student:** Alok Gupta (URN: E26B07F0573)

## Baseline Behavior
- `3-terrarium/solution/index.html` is an interactive drag-and-drop page for arranging virtual plants in a terrarium.
- The base layout contains static headings, containers (`#page`, `#plant-selection`, `#left-container`), and plant images (`#plant1`..`#plant14`).
- It previously contained no user text input control to demonstrate safe handling of untrusted text.

## Changes Made
1. Added an isolated companion label card in `3-terrarium/solution/index.html` with:
   - `<input id="terrarium-title-input" placeholder="Enter plant label...">`
   - `<div id="terrarium-title-display" aria-live="polite">`
2. In `3-terrarium/solution/script.js`, added an event listener using `textContent = input.value` to ensure any HTML or script strings are treated purely as literal text.
3. Created Playwright automated test `tests/course/r59-t018.mjs` verifying that injecting `<img src=x onerror="window.__xss_flag=true">`:
   - Renders the exact literal text in the DOM.
   - Creates no `<img>` element.
   - Executes no `onerror` handler (`window.__xss_flag === undefined`).
4. Updated `3-terrarium/1-intro-to-html/README.md` with test documentation.

## Automated Check Results
- Command: `node tests/course/r59-t018.mjs`
- Exit Code: `0`
- Results:
  - Page anchors `#page`, `#plant-selection`, `#left-container`, `#plant1` present: PASS
  - Safe text rendering verified: PASS
  - No element injection: PASS
  - No handler execution: PASS
  - Screenshot saved: `work/R59-T018/safe-text-rendered.png`
  - Results JSON saved: `work/R59-T018/results.json`

## Tool Versions
- Node.js: v26.7.0
- Playwright: ^1.65.0
- Chromium: Headless Shell 158.0.8127.18
