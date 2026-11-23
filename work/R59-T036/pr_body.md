## Summary of Changes

Closes #36.

### Purpose
Addresses task **R59-T036** (`Handle an unsupported browser feature: 6-space-game/3-moving-elements-around`):
- Inspected source anchor `canvas` (`1024x768`) and its reliance on HTML5 Canvas 2D context.
- Implemented robust feature detection for `canvas.getContext('2d')` in `app.js` with structured fallback handling instead of crashing with uncaught exceptions.
- Added visible fallback alert banner (`#fallback-banner`) with informative status message when canvas 2D rendering is unavailable.
- Added accessible fallback content `<p id="canvas-fallback-text">` inside `<canvas>`.
- Included CSS `@supports` stylesheet rule and styling.
- Created Playwright regression suite `tests/course/r59-t036.mjs` verifying both feature-present and feature-absent execution paths.
- Documented testing instructions in `6-space-game/3-moving-elements-around/README.md`.

### Verification
- `node tests/course/r59-t036.mjs` runs and passes all 17 assertions (exit code 0).
- Evidence captured in `work/R59-T036/` (`screenshot-supported.png`, `screenshot-unsupported.png`, `results.json`, `baseline.json`, `versions.json`).
