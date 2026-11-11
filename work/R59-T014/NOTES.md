# Task R59-T014 - Verification Notes

**Task:** Check repeat initialization: 6-space-game/3-moving-elements-around
**Page:** `6-space-game/3-moving-elements-around/solution/index.html`
**Student:** Alok Gupta (URN: E26B07F0573)

## Baseline Behavior
- In `6-space-game/3-moving-elements-around/solution/app.js`:
  - `initGame()` repeatedly subscribed new event listener callbacks to `eventEmitter.on()` without clearing existing subscriptions.
  - Every call to `new Enemy()` created an unmanaged `setInterval` timer whose reference was lost upon re-initialization.
  - Calling `initGame()` twice resulted in duplicated movement steps (e.g. moving 10px instead of 5px per key press) and orphaned background timers.

## Changes Made
1. Added `clear(message)` to `EventEmitter` to enable clearing listeners for specific messages or resetting all listeners.
2. Stored `this.intervalId` in `Enemy` and implemented `cleanup()` to cancel active intervals via `clearInterval`.
3. Created `cleanupGame()` which calls `cleanup()` on all game objects, empties `gameObjects`, and resets the `EventEmitter`.
4. Called `cleanupGame()` at the beginning of `initGame()`.
5. Exposed `window.__game` lifecycle functions for test automation.
6. Created Playwright automated test `tests/course/r59-t014.mjs`.
7. Updated `6-space-game/3-moving-elements-around/README.md` with test documentation.

## Automated Check Results
- Command: `node tests/course/r59-t014.mjs`
- Exit Code: `0`
- Results:
  - Canvas element present in DOM: PASS
  - Hero initialized at baseline: PASS
  - First ArrowUp moves hero by exactly 5px: PASS
  - Repeat init keeps game objects count at 26 (no duplicated objects): PASS
  - Second ArrowUp after re-init moves hero by exactly 5px (no duplicate listeners): PASS
  - Cleanup cancels timers and empties objects array: PASS
  - Screenshot saved: `work/R59-T014/repeat-init-verified.png`

## Tool Versions
- Node.js: v26.7.0
- Playwright: ^1.65.0
- Chromium: Headless Shell 158.0.8127.18
