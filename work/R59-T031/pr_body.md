## Description

This PR implements and verifies keyboard accessibility for '3-terrarium/1-intro-to-html' (Issue #31). It adds an accessible skip-to-content link, logical Tab traversal reaching all 14 interactive plants without introducing positive `tabindex` values, distinct visible focus indicators, and keyboard controls (Enter/Space to grab/drop, Arrow keys to reposition) while preserving demonstrated CSS layout and mouse dragging.

## Related Issue

Fixes: #31

## Type of Change

- [x] Bug Fix
- [ ] New Feature
- [x] UI/UX Improvement
- [ ] Performance Improvement
- [x] Tests
- [x] Documentation
- [ ] Refactoring / Maintenance
- [ ] CI/CD

## Changes Made

- **3-terrarium/solution/index.html**:
  - Added an accessible off-screen skip link (`.skip-link`) that reveals upon keyboard focus and jumps directly to `<main id="main">`.
  - Added standard `tabindex="0"`, `role="button"`, and descriptive `alt` attributes across all 14 plants (`#plant1` through `#plant14`) with no positive `tabindex`.
- **3-terrarium/solution/style.css**:
  - Added skip link styles and high-contrast visible focus outline (`outline: 3px solid #2e7d32; outline-offset: 3px;`) for plants and nav links.
  - Added visual grab state indication (`outline: 3px dashed #ff9800`) when a plant is picked up via keyboard.
- **3-terrarium/solution/script.js**:
  - Enhanced the `dragElement` closure with keyboard event handlers: Enter/Space toggles grab (`aria-pressed`), Arrow keys adjust `top`/`left` offsets by 10px, and Escape or blur drops the element.
- **3-terrarium/1-intro-to-html/README.md**:
  - Added run and test instructions for R59-T031.
- **package.json**:
  - Added `"playwright": "^1.65.1"` to devDependencies and test scripts.
- **tests/course/r59-t031.mjs**:
  - Added automated Playwright test suite validating HTTP 200, source anchors, skip-link navigation, Tab focus outlines, keyboard pickup and arrow-key movement, zero positive `tabindex`, and zero runtime page errors.
- **work/R59-T031/**:
  - Recorded baseline observations, execution metrics, tool versions, and focus/movement screenshots.

## Screenshots / Recordings

- Focused Plant (Visible Outline): `work/R59-T031/screenshot-focused.png`
- Keyboard Repositioned Plant: `work/R59-T031/screenshot-moved.png`

## Testing

- **What was tested**:
  - HTTP 200 page load and zero initial errors.
  - Source anchors verified (`#page`, `#plant-selection`, `#left-container`, `#plant1`).
  - Skip link off-screen initially, reveals and gains visible outline on Tab, navigates to `#main` on Enter.
  - `#plant1` gains visible focus outline (`outlineStyle === 'solid'`).
  - Enter key activates grab state (`aria-pressed === 'true'`).
  - Arrow keys reposition plant (+20px right, +20px down).
  - Space key drops plant (`aria-pressed === 'false'`).
  - All 14 plants have accessible role, `tabindex="0"`, and descriptive `alt` text.
  - Zero positive `tabindex` attributes in document.
  - Zero uncaught page/console errors during the entire session.
- **How it was tested**: Automated Playwright test run on headless Chromium.
- **Test commands executed**:
  ```bash
  node tests/course/r59-t031.mjs
  ```
- **Actual results**: 12/12 checks passed.
- **Limitations**: None.

## Checklist

- [x] I have tested my changes locally.
- [x] I have added or updated tests, if needed.
- [x] I have updated documentation, if needed.
- [x] I have followed the project's coding guidelines.
- [x] I have run the relevant tests and checks.
- [x] I have addressed previous review feedback, if applicable.

## Additional Notes

Process and browser contexts are cleanly initialized and terminated upon test completion.
