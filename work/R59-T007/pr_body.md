## Description
Publishes an executable, tested walkthrough of the space game scoring and lives mechanics. Documents the page entry point, setup commands, layout observations, and complete user interactions (movement, laser scoring collision, and damage collision) while verifying them through an automated Playwright test suite.

## Related Issue
Fixes: #7

## Type of Change
- [ ] Bug Fix
- [ ] New Feature
- [ ] UI/UX Improvement
- [ ] Performance Improvement
- [x] Tests
- [x] Documentation
- [x] Refactoring / Maintenance
- [ ] CI/CD

## Changes Made
- Documented the entry point, setup command, canvas selectors, and game mechanics walkthrough in `6-space-game/5-keeping-score/README.md`.
- Exposed game state hooks (`window.hero`, `window.gameObjects`, `window.eventEmitter`, `window.Messages`) in `6-space-game/5-keeping-score/solution/app.js` to facilitate testing and clean teardown.
- Created Playwright automated check `tests/course/r59-t007.mjs` executing the walkthrough end-to-end (canvas anchor, initial state, movement, 100-point laser hit, life decrement).
- Stored verification evidence and screenshots in `work/R59-T007/`.

## Screenshots / Recordings
- Initial Gameplay: `work/R59-T007/gameplay-initial.png`
- Scored 100 Points: `work/R59-T007/scored-100-points.png`
- Life Decremented: `work/R59-T007/life-decremented.png`

## Testing
Ran automated Playwright walkthrough check:
`node tests/course/r59-t007.mjs`
All walkthrough steps passed with exit code 0.

## Checklist
- [x] I have tested my changes locally.
- [x] I have added or updated tests, if needed.
- [x] I have updated documentation, if needed.
- [x] I have followed the project's coding guidelines.
- [x] I have run the relevant tests and checks.
- [x] I have addressed previous review feedback, if applicable.

## Additional Notes
- Game loop intervals are cleanly stopped at test completion to prevent lingering background timers.
