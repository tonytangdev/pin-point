# Mobile Keyboard Popover Visibility

## Problem

On mobile devices, when the soft keyboard opens (e.g., user taps the textarea in a comment popover), the popover can be pushed out of the visible area. The user can't see what they're typing.

## Goal

When the mobile keyboard opens, the comment popover scrolls into view automatically. Applies to both "create" (new feedback) and "edit" (editing existing comment) popovers.

## Approach: VisualViewport API listener

Use the `window.visualViewport` resize event to detect keyboard open/close, then call `scrollIntoView()` on the popover.

## Design

### New hook: `useScrollIntoViewOnKeyboard`

- **Location**: `packages/pin-point/src/components/CommentPopover.tsx` (co-located, not a separate file)
- **Input**: `React.RefObject<HTMLDivElement>` (the popover element ref)
- **Behavior**:
  1. On mount, store `window.visualViewport.height` as the baseline.
  2. Subscribe to `window.visualViewport` `resize` event.
  3. On resize, if height shrinks by >150px from baseline, call `ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })`.
  4. The 150px threshold catches soft keyboards (typically 250-400px) but ignores minor viewport changes (browser toolbar show/hide).
  5. On unmount, remove the listener.
- **No-op guard**: If `window.visualViewport` is undefined (desktop browsers, pre-2020 mobile), the hook does nothing.

### Integration

- `CommentPopover` already has `popoverRef`. Pass it to the hook.
- Single call site: `useScrollIntoViewOnKeyboard(popoverRef)` inside `CommentPopover`.

### What doesn't change

- No CSS changes.
- No changes to `FeedbackToolbar`, `FeedbackOverlay`, or any other component.
- No changes to popover placement logic.
- No changes to the server package.

## Testing

- Unit test: verify `scrollIntoView` is called when `visualViewport` height shrinks past threshold.
- Unit test: verify no-op when `visualViewport` is unavailable.
- Manual test: open popover on mobile device, tap textarea, confirm popover scrolls into view.
