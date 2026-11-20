# Task R59-T004 - Verification Notes

**Task:** Check repeat initialization: 7-bank-project/1-template-route
**Page:** `7-bank-project/solution/index.html`
**Student:** Vedika Yadav (URN: `e26b07f0785`)

## 1. Baseline Behavior
- `7-bank-project/solution/index.html` implements client-side templating and routing using HTML `<template>` and History API.
- Previously, the app only defined routes for `/dashboard` and `/login`. Any request to an unknown route would default to `/dashboard` rather than presenting an informative 404 not-found view.
- Furthermore, invoking `init()` or route updating repeatedly could rebind event listeners or risk appending duplicated DOM elements if not guarded.

## 2. Changes Made
1. **404 Not Found Template**: Added `<template id="not-found">` with warning icon, message, and `#goHomeBtn` link in `7-bank-project/solution/index.html`.
2. **Idempotent Initialization & Routing**:
   - In `7-bank-project/solution/app.js`, configured `routes['/not-found']` and updated `updateRoute()` to route unmatched paths to the 404 template.
   - Guarded `popstate` listener registration via `window.__popstateWired` to prevent duplicate listener stacking.
   - Guarded `init()` with `appInitialized` flag, ensuring idempotent repeated calls without redundant work or state clobbering.
   - Exposed `window.init`, `window.navigate`, and `window.updateRoute` for external control and verification.
3. **Automated Test Check**: Created `tests/course/r59-t004.mjs` verifying required anchors (`#app`, `#login`, `#loginTitle`, `#loginHeading`), testing repeated initialization calls, validating 404 template activation on invalid routes, testing repeated route navigation, and ensuring smooth return navigation to the login view.
4. **Documentation**: Added testing instructions to `7-bank-project/1-template-route/README.md`.

## 3. Automated Check Results
- Command: `node tests/course/r59-t004.mjs`
- Exit Code: `0`
- Results:
  - Source anchors `#app`, `#login`, `#loginTitle`, `#loginHeading` verified: PASS
  - Initial login view rendered with single form: PASS
  - Repeated `init()` and `updateRoute()` produce exactly one form and heading (no duplication): PASS
  - Invalid route navigates to 404 Not Found view with `#notFoundTitle`: PASS
  - Repeated navigation to invalid route produces single view without duplication: PASS
  - Return to login view via `#goHomeBtn` succeeds with 0 page errors: PASS
  - Screenshots saved:
    - `work/R59-T004/login-initial.png`
    - `work/R59-T004/not-found-view.png`

## 4. Tool Versions
- Node.js: v24.22.1
- Playwright: ^1.65.1
- Chromium: Headless Shell 159.0.8154.6
