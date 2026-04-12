# Mobile Bottom Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the absolutely-positioned popover with a fixed bottom sheet on mobile (`<768px`) to avoid keyboard-triggered position drift.

**Architecture:** CSS media query transforms the existing `.pp-popover` into a bottom sheet on narrow viewports. JS changes are minimal: skip placement logic on mobile, add a transparent click-outside overlay in `FeedbackOverlay`. No new components.

**Tech Stack:** React, CSS media queries, vitest + @testing-library/react

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/pin-point/src/styles/pin-point.css` | Modify | Media query overrides for sheet styling, slide-up animation, overlay styles |
| `packages/pin-point/src/components/CommentPopover.tsx` | Modify | Skip `useLayoutEffect` placement and `useScrollIntoViewOnKeyboard` on mobile |
| `packages/pin-point/src/components/CommentPopover.test.tsx` | Modify | Tests for mobile behavior: skip scroll hook, skip placement |
| `packages/pin-point/src/FeedbackOverlay.tsx` | Modify | Render `.pp-mobile-overlay` when sheet is open on mobile, pass `onClose` to read-mode popover |
| `packages/pin-point/src/FeedbackOverlay.test.tsx` | Modify | Tests for overlay rendering and click-to-dismiss |

---

### Task 1: CSS — bottom sheet styling and animation

**Files:**
- Modify: `packages/pin-point/src/styles/pin-point.css`

No TDD for this task — JSDOM doesn't apply CSS media queries, so these styles can only be verified in a real browser.

- [ ] **Step 1: Add mobile overlay styles**

Append after the `.pp-modal-actions button:disabled` block (line ~494), before the share link section:

```css
/* Mobile overlay — transparent click-outside-to-close layer */
[data-pin-point] .pp-mobile-overlay {
	position: fixed;
	inset: 0;
	background: transparent;
	z-index: 2147483647;
}
```

Note: same z-index as `.pp-popover` — but overlay renders before the popover in the DOM, so the popover sits on top.

- [ ] **Step 2: Add slide-up keyframes and mobile bottom sheet media query**

Append at the end of the file. Keyframes are hoisted out of the media query for broad browser compat:

```css
@keyframes pp-sheet-up {
	from {
		transform: translateY(100%);
	}
	to {
		transform: translateY(0);
	}
}

/* Mobile bottom sheet */
@media (max-width: 767.98px) {
	[data-pin-point] .pp-popover {
		position: fixed;
		bottom: 0;
		left: 0;
		top: auto;
		width: 100%;
		max-height: 60vh;
		overflow-y: auto;
		border-radius: 16px 16px 0 0;
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
		animation: pp-sheet-up 250ms ease-out;
	}

	[data-pin-point] .pp-popover .pp-popover-arrow {
		display: none;
	}
}

@media (max-width: 767.98px) and (prefers-reduced-motion: reduce) {
	[data-pin-point] .pp-popover {
		animation: none;
	}
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/pin-point/src/styles/pin-point.css
git commit -m "style: add mobile bottom sheet CSS and overlay"
```

---

### Task 2: CommentPopover — skip placement and scroll hook on mobile

**Files:**
- Modify: `packages/pin-point/src/components/CommentPopover.tsx`
- Test: `packages/pin-point/src/components/CommentPopover.test.tsx`

The `MOBILE_BREAKPOINT` constant is needed in both CommentPopover and FeedbackOverlay. Define it in CommentPopover and export it.

- [ ] **Step 1: Write failing test — scroll hook skips on mobile**

Add to `CommentPopover.test.tsx` inside the `"mobile keyboard scroll"` describe block. Also add `innerWidth` restore to the existing `afterEach` so it's cleaned up even if a test throws:

Note: JSDOM doesn't apply CSS media queries, so we verify the JS guard directly. This tests the hook's early-return path — acceptable because we can't observe the CSS-level behavior in JSDOM.

Update the existing `afterEach` in the `"mobile keyboard scroll"` describe block:

```typescript
afterEach(() => {
	vi.unstubAllGlobals();
	Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
});
```

Then add the test:

```typescript
it("does not scroll when viewport width is below mobile breakpoint", () => {
	const resizeHandlers: Array<() => void> = [];
	const mockViewport = {
		height: 800,
		addEventListener: (_: string, handler: () => void) => {
			resizeHandlers.push(handler);
		},
		removeEventListener: vi.fn(),
	};
	vi.stubGlobal("visualViewport", mockViewport);

	Object.defineProperty(window, "innerWidth", { value: 500, configurable: true });

	render(
		<CommentPopover
			mode="create"
			top={100}
			left={200}
			onSubmit={async () => {}}
			onCancel={() => {}}
		/>,
	);

	const popover = document.querySelector(".pp-popover") as HTMLElement;
	popover.scrollIntoView = vi.fn();

	mockViewport.height = 400;
	for (const handler of resizeHandlers) handler();

	expect(popover.scrollIntoView).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter pin-point test -- --reporter=verbose 2>&1 | tail -20`

Expected: FAIL — scroll hook currently fires regardless of viewport width.

- [ ] **Step 3: Write failing test — placement logic skipped on mobile**

Add a new describe block in `CommentPopover.test.tsx`.

Note: we check inline styles directly because JSDOM can't apply CSS media queries — verifying the JS guard skips inline positioning is the only way to test this in JSDOM.

```typescript
describe("CommentPopover — mobile sheet mode", () => {
	afterEach(() => {
		Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
	});

	it("does not apply inline positioning on mobile", () => {
		Object.defineProperty(window, "innerWidth", { value: 500, configurable: true });

		render(
			<CommentPopover
				mode="create"
				top={100}
				left={200}
				onSubmit={async () => {}}
				onCancel={() => {}}
			/>,
		);

		const popover = document.querySelector(".pp-popover") as HTMLElement;
		// On mobile, CSS handles positioning — no inline top/left
		expect(popover.style.top).toBe("");
		expect(popover.style.left).toBe("");
	});

	it("applies inline positioning on desktop", () => {
		Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });

		render(
			<CommentPopover
				mode="create"
				top={100}
				left={200}
				onSubmit={async () => {}}
				onCancel={() => {}}
			/>,
		);

		const popover = document.querySelector(".pp-popover") as HTMLElement;
		expect(popover.style.top).not.toBe("");
		expect(popover.style.left).not.toBe("");
	});
});
```

- [ ] **Step 4: Run tests to verify failures**

Run: `pnpm --filter pin-point test -- --reporter=verbose 2>&1 | tail -20`

Expected: mobile test FAILs (placement is currently applied regardless of width).

- [ ] **Step 5: Implement — add MOBILE_BREAKPOINT and guard hooks**

In `CommentPopover.tsx`:

1. Add exported constant at the top (after imports, before types):

```typescript
export const MOBILE_BREAKPOINT = 768;
```

2. Update `useScrollIntoViewOnKeyboard` to skip on mobile:

```typescript
function useScrollIntoViewOnKeyboard(
	ref: React.RefObject<HTMLDivElement | null>,
) {
	useEffect(() => {
		if (window.innerWidth < MOBILE_BREAKPOINT) return;

		const viewport = window.visualViewport;
		if (!viewport) return;

		const baselineHeight = viewport.height;

		const handleResize = () => {
			if (
				baselineHeight - viewport.height > KEYBOARD_HEIGHT_THRESHOLD &&
				ref.current
			) {
				ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
			}
		};

		viewport.addEventListener("resize", handleResize);
		return () => viewport.removeEventListener("resize", handleResize);
	}, [ref]);
}
```

3. Guard the `useLayoutEffect` placement logic:

```typescript
useLayoutEffect(() => {
	if (window.innerWidth < MOBILE_BREAKPOINT) return;

	const el = popoverRef.current;
	if (!el) return;
	const rect = el.getBoundingClientRect();
	const w = rect.width;
	const h = rect.height;

	const pinViewX = left - window.scrollX;
	const pinViewY = top - window.scrollY;

	const fitsRight =
		pinViewX - POPOVER_OFFSET + w + VIEWPORT_MARGIN <= window.innerWidth;
	const fitsLeft = pinViewX + POPOVER_OFFSET - w - VIEWPORT_MARGIN >= 0;
	const fitsBottom =
		pinViewY + POPOVER_OFFSET + h + VIEWPORT_MARGIN <= window.innerHeight;
	const fitsTop = pinViewY - POPOVER_OFFSET - h - VIEWPORT_MARGIN >= 0;

	setPlacement({
		x: fitsRight ? "right" : fitsLeft ? "left" : "right",
		y: fitsBottom ? "bottom" : fitsTop ? "top" : "bottom",
	});
	setSize({ width: w, height: h });
}, [top, left]);
```

4. Guard the style computation so mobile gets no inline positioning:

```typescript
const isMobile = typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;

const style: React.CSSProperties = isMobile
	? {}
	: size
		? {
				top: `${
					placement.y === "bottom"
						? top + POPOVER_OFFSET
						: top - POPOVER_OFFSET - size.height
				}px`,
				left: `${
					placement.x === "right"
						? left - POPOVER_OFFSET
						: left + POPOVER_OFFSET - size.width
				}px`,
			}
		: {
				top: `${top + POPOVER_OFFSET}px`,
				left: `${left - POPOVER_OFFSET}px`,
				visibility: "hidden",
			};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter pin-point test -- --reporter=verbose 2>&1 | tail -30`

Expected: ALL pass.

- [ ] **Step 7: Commit**

```bash
git add packages/pin-point/src/components/CommentPopover.tsx packages/pin-point/src/components/CommentPopover.test.tsx
git commit -m "feat: skip popover placement and scroll hook on mobile"
```

---

### Task 3: FeedbackOverlay — mobile overlay for click-outside dismiss

**Files:**
- Modify: `packages/pin-point/src/FeedbackOverlay.tsx`
- Test: `packages/pin-point/src/FeedbackOverlay.test.tsx`

- [ ] **Step 1: Write failing test — overlay renders on mobile when create popover is open**

Add to `FeedbackOverlay.test.tsx`:

```typescript
describe("mobile overlay", () => {
	beforeEach(() => {
		window.history.replaceState({}, "", "/?pin-token=ft_test");
		Object.defineProperty(window, "innerWidth", { value: 500, configurable: true });
		document.elementFromPoint = vi.fn().mockReturnValue(document.body);
	});

	afterEach(() => {
		Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
		// @ts-expect-error reset jsdom stub
		delete document.elementFromPoint;
	});

	it("renders mobile overlay when pending pin exists on narrow viewport", async () => {
		render(
			<FeedbackOverlay
				onCommentCreate={async () => {}}
				onCommentsFetch={async () => []}
			>
				<div>My App</div>
			</FeedbackOverlay>,
		);

		enterPinMode();

		const intercept = document.querySelector(".pp-intercept") as HTMLElement;
		fireEvent.click(intercept, { clientX: 100, clientY: 200 });

		await waitFor(() => {
			expect(document.querySelector(".pp-mobile-overlay")).toBeInTheDocument();
		});
	});

	it("does not render mobile overlay on wide viewport", async () => {
		// Override the beforeEach narrow viewport to test desktop behavior
		Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });

		render(
			<FeedbackOverlay
				onCommentCreate={async () => {}}
				onCommentsFetch={async () => []}
			>
				<div>My App</div>
			</FeedbackOverlay>,
		);

		enterPinMode();

		const intercept = document.querySelector(".pp-intercept") as HTMLElement;
		fireEvent.click(intercept, { clientX: 100, clientY: 200 });

		await waitFor(() => {
			expect(
				screen.getByPlaceholderText("Leave your feedback..."),
			).toBeInTheDocument();
		});

		expect(document.querySelector(".pp-mobile-overlay")).not.toBeInTheDocument();
	});

	it("clicking mobile overlay cancels pending pin", async () => {
		render(
			<FeedbackOverlay
				onCommentCreate={async () => {}}
				onCommentsFetch={async () => []}
			>
				<div>My App</div>
			</FeedbackOverlay>,
		);

		enterPinMode();

		const intercept = document.querySelector(".pp-intercept") as HTMLElement;
		fireEvent.click(intercept, { clientX: 100, clientY: 200 });

		await waitFor(() => {
			expect(document.querySelector(".pp-mobile-overlay")).toBeInTheDocument();
		});

		fireEvent.click(document.querySelector(".pp-mobile-overlay") as HTMLElement);

		await waitFor(() => {
			expect(
				screen.queryByPlaceholderText("Leave your feedback..."),
			).not.toBeInTheDocument();
			expect(document.querySelector(".pp-mobile-overlay")).not.toBeInTheDocument();
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter pin-point test -- --reporter=verbose 2>&1 | tail -20`

Expected: FAIL — no `.pp-mobile-overlay` rendered yet.

- [ ] **Step 3: Write failing test — overlay for read mode (expanded pin)**

Add inside the same `"mobile overlay"` describe block:

```typescript
it("renders mobile overlay when pin is expanded on narrow viewport", async () => {
	const target = document.createElement("div");
	target.id = "test";
	document.body.appendChild(target);

	vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
		top: 100,
		left: 100,
		width: 200,
		height: 50,
		bottom: 150,
		right: 300,
		x: 100,
		y: 100,
		toJSON: () => {},
	} as DOMRect);

	render(
		<FeedbackOverlay
			onCommentCreate={async () => {}}
			onCommentsFetch={async () => [mockComment]}
		>
			<div>My App</div>
		</FeedbackOverlay>,
	);

	let pinMarker!: HTMLElement;
	await waitFor(() => {
		pinMarker = document.querySelector(".pp-pin") as HTMLElement;
		expect(pinMarker).toBeInTheDocument();
	});

	fireEvent.click(pinMarker);

	await waitFor(() => {
		expect(document.querySelector(".pp-mobile-overlay")).toBeInTheDocument();
	});

	target.remove();
});

it("clicking overlay collapses expanded pin", async () => {
	const target = document.createElement("div");
	target.id = "test";
	document.body.appendChild(target);

	vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
		top: 100,
		left: 100,
		width: 200,
		height: 50,
		bottom: 150,
		right: 300,
		x: 100,
		y: 100,
		toJSON: () => {},
	} as DOMRect);

	render(
		<FeedbackOverlay
			onCommentCreate={async () => {}}
			onCommentsFetch={async () => [mockComment]}
		>
			<div>My App</div>
		</FeedbackOverlay>,
	);

	let pinMarker!: HTMLElement;
	await waitFor(() => {
		pinMarker = document.querySelector(".pp-pin") as HTMLElement;
		expect(pinMarker).toBeInTheDocument();
	});

	fireEvent.click(pinMarker);

	await waitFor(() => {
		expect(screen.getByText("Fix this heading")).toBeInTheDocument();
	});

	fireEvent.click(document.querySelector(".pp-mobile-overlay") as HTMLElement);

	await waitFor(() => {
		expect(screen.queryByText("Fix this heading")).not.toBeInTheDocument();
		expect(document.querySelector(".pp-mobile-overlay")).not.toBeInTheDocument();
	});

	target.remove();
});
```

- [ ] **Step 4: Implement — render mobile overlay in FeedbackOverlay**

In `FeedbackOverlay.tsx`:

1. Import `MOBILE_BREAKPOINT`:

```typescript
import { MOBILE_BREAKPOINT } from "./components/CommentPopover";
```

2. Gate the intercept layer — on mobile, hide it when a pending pin exists so the overlay behind the sheet is clickable. Change the intercept line from:

```tsx
{pinMode && <ClickInterceptLayer onClick={handleClick} />}
```

to:

```tsx
{pinMode &&
	!(pendingPin && window.innerWidth < MOBILE_BREAKPOINT) && (
		<ClickInterceptLayer onClick={handleClick} />
	)}
```

3. Before the `{expandedPinId && ...}` block, add the mobile overlay. It renders when (a) viewport < breakpoint AND (b) either a pending pin or expanded pin exists:

```tsx
{window.innerWidth < MOBILE_BREAKPOINT &&
	(pendingPin || expandedPinId) && (
		// biome-ignore lint/a11y/useKeyWithClickEvents: overlay dismiss, not interactive
		<div
			className="pp-mobile-overlay"
			onClick={() => {
				setPendingPin(null);
				setExpandedPinId(null);
			}}
		/>
	)}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter pin-point test -- --reporter=verbose 2>&1 | tail -30`

Expected: ALL pass.

- [ ] **Step 6: Run type check**

Run: `npx tsc --noEmit -p packages/pin-point/tsconfig.json`

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add packages/pin-point/src/FeedbackOverlay.tsx packages/pin-point/src/FeedbackOverlay.test.tsx
git commit -m "feat: add mobile overlay for click-outside sheet dismiss"
```

---

### Task 4: Verify full test suite and lint

- [ ] **Step 1: Run full test suite**

Run: `pnpm --filter pin-point test -- --reporter=verbose`

Expected: All tests pass.

- [ ] **Step 2: Run lint**

Run: `pnpm --filter pin-point lint 2>&1 || npx biome check packages/pin-point/src`

Expected: No errors.

- [ ] **Step 3: Fix any issues found, commit if needed**
