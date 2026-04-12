# Mobile Bottom Sheet for Comments

## Problem

On mobile, when the keyboard opens and `scrollIntoView` centers the popover, the pinpoint location shifts. The popover's `position: absolute` coordinates become misaligned with the anchor element after viewport/layout changes triggered by the keyboard.

## Solution

At viewports below `768px`, restyle the existing `CommentPopover` as a fixed bottom sheet instead of an absolutely-positioned popover. This sidesteps all keyboard-related positioning issues since the sheet is anchored to the bottom of the screen.

## Scope

- Applies to both **create** and **read** modes
- No new components — CSS-driven transformation of `CommentPopover`
- Transparent click-outside overlay for dismissal

## Design

### Detection

- CSS media query `@media (max-width: 767.98px)` controls sheet styling
- No JS-based mobile detection needed

### Sheet Styling

At `<768px`, `.pp-popover` overrides:

- `position: fixed`
- `bottom: 0; left: 0; width: 100%`
- `border-radius: 16px 16px 0 0`
- `.pp-popover-arrow` hidden (`display: none`)
- Placement `useLayoutEffect` skipped (position is always fixed-bottom)

### Animation

- Slide-up entrance: `@keyframes pp-sheet-up` from `translateY(100%)` to `translateY(0)`
- Respects `prefers-reduced-motion`

### Scroll Hook

- `useScrollIntoViewOnKeyboard` skips its logic when viewport is below `768px` (sheet is fixed-bottom, no scroll needed)

### Click-Outside Overlay

- New `.pp-mobile-overlay` div rendered in `FeedbackOverlay` when a popover/sheet is open and viewport `<768px`
- `position: fixed; inset: 0; background: transparent`
- `z-index` between page content and sheet
- Click triggers close: `onCancel` in create mode, collapse pin in read mode
- Page behind remains fully visible and interactive after dismissal

### What Stays Unchanged

- All popover internals: textarea, buttons, read content, edit mode, delete confirmation
- Desktop behavior (>= 768px): existing popover with absolute positioning
- Pin placement flow: tapping to place a pin works the same
- `restorePosition` / `resolveAnchor` logic

## Files Affected

- `packages/pin-point/src/styles/pin-point.css` — media query overrides for sheet styling, animation keyframes, overlay styles
- `packages/pin-point/src/components/CommentPopover.tsx` — skip placement logic and scroll hook on mobile
- `packages/pin-point/src/FeedbackOverlay.tsx` — render mobile overlay when sheet is open
