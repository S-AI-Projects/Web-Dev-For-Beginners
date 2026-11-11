# Task R59-T015 - Verification Notes

**Task:** Make browser tests deterministic: 7-bank-project/4-state-management
**Page:** `7-bank-project/solution/index.html`
**Student:** Alok Gupta (URN: E26B07F0573)

## Baseline Behavior
- The bank application uses client-side state persisted in `localStorage` (`savedAccount` and `accounts`).
- Live tests that rely on external servers or live timing can be flaky and non-deterministic.
- We need an automated regression check demonstrating that identical local fixtures in separate clean browser contexts produce exactly identical rendered DOM states.

## Changes Made
1. Created `tests/course/r59-t015.mjs`:
   - Runs a local static server serving the bank project solution.
   - Launches Chromium and opens two independent, isolated browser contexts.
   - Injects a fixed deterministic account fixture with balance, user information, and transaction records.
   - Extracts DOM snapshots containing account user, formatted balance, account description, and transaction rows.
   - Strictly asserts `assert.deepEqual(snapshot1, snapshot2)`.
   - Tests session reset by clearing `localStorage` and asserting return to the `#loginHeading` view.
2. Saved test results and screenshots to `work/R59-T015/`.
3. Updated `7-bank-project/4-state-management/README.md` with test documentation.

## Automated Check Results
- Command: `node tests/course/r59-t015.mjs`
- Exit Code: `0`
- Results:
  - Context 1 DOM snapshot generated with 0 page errors.
  - Context 2 DOM snapshot generated with 0 page errors.
  - Deep equality comparison between Context 1 and Context 2: PASS (Strictly identical DOM).
  - Session clearing / logout resets route to `/login` and renders `#loginHeading`: PASS.
  - Screenshot saved: `work/R59-T015/deterministic-dashboard.png`.

## Tool Versions
- Node.js: v26.7.0
- Playwright: ^1.65.0
- Chromium: Headless Shell 158.0.8127.18
