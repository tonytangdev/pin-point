# Pin-Point: Visual Feedback Overlay for React

## Overview

A React component (npm package) that lets clients/stakeholders leave visual feedback on a website by clicking anywhere on the page to drop a pin and attach a comment. Activated via URL query parameter, self-hosted storage via developer-provided callbacks.

## Users

Clients and stakeholders reviewing a website. No authentication required — anyone with a feedback-enabled link can comment.

## Distribution

npm package. React component with peer dependency on React 18+.

## API

### Component

```tsx
<FeedbackOverlay
  onCommentCreate={(comment: PinComment) => Promise<void>}
  onCommentsFetch={() => Promise<PinComment[]>}
  queryParam?: string  // default: "feedback"
>
  <App />
</FeedbackOverlay>
```

### PinComment Type

```ts
type PinComment = {
  id: string;
  url: string;                    // page pathname
  content: string;                // comment text
  anchor: {
    selector: string;             // CSS selector of nearest identifiable element
    xPercent: number;             // x offset as % of anchor element width
    yPercent: number;             // y offset as % of anchor element height
  };
  viewport: {
    width: number;                // window.innerWidth at comment time
  };
  createdAt: string;              // ISO timestamp
};
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onCommentCreate` | `(comment: PinComment) => Promise<void>` | Yes | Called when user submits a comment |
| `onCommentsFetch` | `() => Promise<PinComment[]>` | Yes | Called on mount to load existing comments |
| `queryParam` | `string` | No | Query param that activates feedback mode. Default: `"feedback"` |
| `children` | `ReactNode` | Yes | The app content |

## Activation

Feedback mode activates when `?feedback=true` (or custom param) is present in the URL. When inactive, the component renders children only — zero overhead, no extra DOM, no listeners.

When active:
1. Transparent click-intercept layer covers the page
2. Cursor changes to crosshair
3. Bottom toolbar appears: "Click anywhere to leave feedback" + comment count badge
4. Existing pins load via `onCommentsFetch`
5. Page scroll still works; clicks are intercepted for pinning

## Pinpointing: DOM Anchor Resolution

When a user clicks to place a pin, the system resolves a stable anchor element. Priority order:

1. **Exact match** — clicked element has an `id` -> `#myElement`
2. **Nearest ancestor with id** — walk up DOM -> `#parentId`
3. **Nearest ancestor with data attribute** — `data-testid`, `data-cy`, or any `data-*` -> `[data-testid="hero-section"]`
4. **Fallback: structural path** — tag names + nth-child, max 3 levels -> `main > div:nth-child(2) > section`

Coordinates (`xPercent`, `yPercent`) are stored relative to the anchor element's bounding box. Viewport width is stored alongside for context.

### Known Limitations (MVP)

- Dynamically rendered content may not exist on pin restore — those pins silently hide
- If anchor element is removed between visits, pin is lost
- Pins won't perfectly align across breakpoints; viewport width metadata tells the dev what width the reviewer used

## UI

### Pin Markers
- Numbered purple circles (#6C5CE7) at each comment location
- White border, drop shadow for visibility on any background
- Click to expand comment popover

### Comment Popover
- White card with arrow pointing to pin
- Shows comment text, timestamp, and viewport width
- For new comments: textarea + Cancel/Submit buttons

### Bottom Toolbar
- Dark pill at bottom-center
- Purple dot + "Click anywhere to leave feedback" text + comment count badge
- Always visible in feedback mode

## Component Internals

### State
- `isActive: boolean` — derived from URL query param
- `comments: PinComment[]` — loaded from `onCommentsFetch` on mount
- `pendingPin: { x, y, anchor } | null` — set on click, cleared on submit/cancel
- `expandedPinId: string | null` — which pin's popover is open

### Internal Modules

| Module | Responsibility |
|--------|---------------|
| `useQueryParamDetector` | Reads URL, returns `isActive`. Listens for popstate/pushstate. |
| `resolveAnchor(element, clickX, clickY)` | Walks DOM, finds best anchor, computes relative percentages. |
| `restorePosition(anchor)` | Finds element via `querySelector`, computes absolute screen position. Returns `{ top, left }` or `null`. |
| `ClickInterceptLayer` | Transparent full-screen div. Captures clicks, calls `resolveAnchor`, sets `pendingPin`. Passes through scroll. |
| `PinMarker` | Numbered circle at computed position. Click toggles `expandedPinId`. |
| `CommentPopover` | Comment text + metadata for existing pins, or textarea input for new pins. |
| `FeedbackToolbar` | Bottom-center pill with instruction text + comment count. |

### Render Tree (Active)

```
<FeedbackOverlay>
  {children}
  <ClickInterceptLayer />
  {comments.map(c => <PinMarker />)}
  {expandedPinId && <CommentPopover />}
  {pendingPin && <CommentPopover mode="create" />}
  <FeedbackToolbar />
</FeedbackOverlay>
```

## Styling & Isolation

- All elements wrapped in container with `data-pin-point` attribute
- All classes prefixed with `pp-` (e.g. `pp-pin`, `pp-popover`, `pp-toolbar`)
- CSS scoped via `[data-pin-point] .pp-*` selectors
- Styles injected via `<style>` tag in document head
- Overlay uses `z-index: 2147483647`
- No Shadow DOM (React event delegation issues)
- No CSS-in-JS runtime (keeps bundle lightweight)

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `onCommentsFetch` fails | Pins don't render. Toolbar shows "Couldn't load comments." |
| `onCommentCreate` fails | Input stays open, text preserved. Inline error: "Couldn't save. Try again." |
| Anchor element not found on restore | Pin silently skipped |
| Multiple tabs / stale data | No real-time sync. Comments load once on mount. Refresh to see new comments. |
| Click on iframe | Click intercept layer sits above, iframes blocked. No special handling. |
| Rapid double-click | Debounced — only first click registers |

## Package & Build

- **Name:** `pin-point`
- **Build:** ESM + CJS dual build (tsup)
- **Peer deps:** `react >= 18`, `react-dom >= 18`
- **Runtime deps:** None
- **TypeScript:** Ships with types
- **Estimated size:** <10KB gzipped

## File Structure

```
pin-point/
├── src/
│   ├── index.ts
│   ├── FeedbackOverlay.tsx
│   ├── hooks/
│   │   └── useQueryParamDetector.ts
│   ├── utils/
│   │   ├── resolveAnchor.ts
│   │   └── restorePosition.ts
│   ├── components/
│   │   ├── ClickInterceptLayer.tsx
│   │   ├── PinMarker.tsx
│   │   ├── CommentPopover.tsx
│   │   └── FeedbackToolbar.tsx
│   └── styles/
│       └── pin-point.css
├── tsconfig.json
├── tsup.config.ts
├── package.json
└── README.md
```

## Testing (MVP)

- Unit tests for `resolveAnchor` and `restorePosition` (pure functions)
- Component tests with React Testing Library (mock callbacks, verify pin creation flow)
- No E2E tests

## MVP Scope

- Create and read comments (pins on page)
- No replies, threading, editing, or resolve/open status
- No authentication
- No real-time sync

## Future Enhancements (Post-MVP)

- Threaded replies
- Resolve/open status
- Screenshot capture alongside pin
- Real-time sync (WebSocket/polling)
- Browser extension variant
- Framework-agnostic vanilla JS wrapper
