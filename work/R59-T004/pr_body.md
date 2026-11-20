## Description
Implements an accessible 404 Not Found route template and ensures idempotent initialization and routing in the banking single-page application. Handles unmatched URL paths gracefully, prevents duplicated event listeners and DOM elements upon repeated initialization or route updates, and validates clean round-trip navigation.

## Related Issue
Fixes: #4

## Type of Change
- [ ] Bug Fix
- [x] New Feature
- [x] UI/UX Improvement
- [ ] Performance Improvement
- [x] Tests
- [x] Documentation
- [ ] Refactoring / Maintenance
- [ ] CI/CD

## Changes Made
- Added `<template id="not-found">` with descriptive messaging and return navigation in `7-bank-project/solution/index.html`.
- Registered `'/not-found'` in `routes` and updated `updateRoute()` in `7-bank-project/solution/app.js` to route unknown paths to the not-found template.
- Guarded `popstate` listener wiring and `init()` in `7-bank-project/solution/app.js` to guarantee idempotent behavior on repeated invocation without duplicate listeners or node generation.
- Created Playwright automated check `tests/course/r59-t004.mjs` asserting source anchors (`#app`, `#login`, `#loginTitle`, `#loginHeading`), repeated initialization, 404 view display, and return navigation.
- Updated `7-bank-project/1-template-route/README.md` with test instructions.
- Stored verification evidence in `work/R59-T004/`.

## Screenshots / Recordings
- Initial Login View: `work/R59-T004/login-initial.png`
- 404 Not Found View: `work/R59-T004/not-found-view.png`

## Testing
Executed automated Playwright regression test:
`node tests/course/r59-t004.mjs`
All assertions passed with exit code 0.

## Checklist
- [x] I have tested my changes locally.
- [x] I have added or updated tests, if needed.
- [x] I have updated documentation, if needed.
- [x] I have followed the project's coding guidelines.
- [x] I have run the relevant tests and checks.
- [x] I have addressed previous review feedback, if applicable.

## Additional Notes
- The test harness uses a custom static server with an SPA fallback to allow testing realistic client-side history navigation and refresh behaviors.
