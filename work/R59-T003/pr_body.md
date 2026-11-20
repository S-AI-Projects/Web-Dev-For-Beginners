## Description
Implements meaningful empty and error fallback display states for the extension popup starter page. Displays an initial guidance empty state in the results region, presents a styled fallback badge if the primary image asset fails to load, and ensures clean recovery when the asset fixture is restored, with no uncaught errors.

## Related Issue
Fixes: #3

## Type of Change
- [ ] Bug Fix
- [ ] New Feature
- [x] UI/UX Improvement
- [ ] Performance Improvement
- [x] Tests
- [x] Documentation
- [ ] Refactoring / Maintenance
- [ ] CI/CD

## Changes Made
- Added initial empty-state message `#empty-state` in `5-browser-extension/start/dist/index.html`.
- Added `#image-fallback` container in `5-browser-extension/start/dist/index.html` and fallback badge styling in `5-browser-extension/start/dist/styles.css`.
- Added image error listener and `restoreImage()` recovery function in `5-browser-extension/start/dist/main.js`.
- Created Playwright automated test `tests/course/r59-t003.mjs` verifying initial empty state, asset failure fallback display, no uncaught page errors, and fixture recovery.
- Documented testing instructions in `5-browser-extension/1-about-browsers/README.md`.
- Stored verification evidence in `work/R59-T003/`.

## Screenshots / Recordings
- Initial Empty State: `work/R59-T003/normal-initial-state.png`
- Failed Asset Fallback: `work/R59-T003/failed-asset-fallback.png`
- Recovered State: `work/R59-T003/recovered-state.png`

## Testing
Executed automated Playwright regression suite:
`node tests/course/r59-t003.mjs`
All assertions passed cleanly with exit code 0.

## Checklist
- [x] I have tested my changes locally.
- [x] I have added or updated tests, if needed.
- [x] I have updated documentation, if needed.
- [x] I have followed the project's coding guidelines.
- [x] I have run the relevant tests and checks.
- [x] I have addressed previous review feedback, if applicable.

## Additional Notes
- The test suite uses Playwright network routing to intercept and abort image requests to strictly test client fallback behavior without mutating physical files.
