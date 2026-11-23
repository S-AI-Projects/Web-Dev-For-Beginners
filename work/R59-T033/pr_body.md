## Summary of Changes

Closes #33.

### Purpose
Addresses task **R59-T033** (`Exercise empty/error display: 6-space-game/1-introduction`):
- Added empty-state handling for leaderboard (`#empty-scores`) when no scores are saved in localStorage.
- Added user-facing status feedback (`#asset-status`) when custom background image URL fails to load or recovers.
- Exposed the `#assets` section for accessibility and interactive configuration.
- Added automated Playwright test suite in `tests/course/r59-t033.mjs` with 12 checks verifying source anchors (`#main`, `#hud`, `#score`, `#level`), empty state, error state, and error recovery.
- Documented testing instructions in `6-space-game/1-introduction/README.md`.

### Verification
- `node tests/course/r59-t033.mjs` runs and passes all 12 assertions (exit code 0).
- Evidence captured in `work/R59-T033/` (`screenshot-empty-leaderboard.png`, `results.json`, `baseline.json`, `versions.json`).
