## Summary of Changes

Closes #35.

### Purpose
Addresses task **R59-T035** (`Make browser tests deterministic: 6-space-game/4-collision-detection`):
- Verified source anchor `canvas` (`1024x768`) and isolated 2D game rendering environment.
- Exposed explicit deterministic hooks on `window.SpaceGameCollision` for testing collision detection logic without flaky timers or race conditions.
- Validated AABB collision intersection logic (`intersectRect`) using deterministic bounding box fixtures.
- Validated collision handling behavior: laser-enemy impact (enemy marked dead, hero score incremented) and hero-enemy impact (hero life decremented).
- Executed full test lifecycle across two fresh, isolated browser contexts (Context-A and Context-B) verifying cross-context determinism of layout, entity counts, positions, and collision outcomes.
- Documented testing instructions in `6-space-game/4-collision-detection/README.md`.

### Verification
- `node tests/course/r59-t035.mjs` runs and passes all 32 assertions (exit code 0).
- Evidence captured in `work/R59-T035/` (`screenshot-context-a.png`, `screenshot-context-b.png`, `results.json`, `baseline.json`, `versions.json`).
