# Mobile Keyboard Popover Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the comment popover visible when the mobile soft keyboard opens by scrolling it into view.

**Architecture:** A `useScrollIntoViewOnKeyboard` hook co-located in `CommentPopover.tsx` listens to the `VisualViewport` resize event. When the viewport height shrinks by >150px (keyboard opened), it calls `scrollIntoView()` on the popover ref. No-op on desktop/older browsers.

**Tech Stack:** React 19, TypeScript, Vitest, @testing-library/react

---

### Task 1: Write failing tests for the hook

**Files:**
- Modify: `packages/pin-point/src/components/CommentPopover.test.tsx`

- [ ] **Step 1: Add test — scrollIntoView is called when visualViewport height shrinks past threshold**

Add a new `describe` block at the end of the file:

```tsx
describe("CommentPopover — mobile keyboard scroll", () => {
	it("scrolls popover into view when visualViewport height shrinks past threshold", () => {
		const resizeHandlers: Array<() => void> = [];
		const mockViewport = {
			height: 800,
			addEventListener: (_: string, handler: () => void) => {
				resizeHandlers.push(handler);
			},
			removeEventListener: vi.fn(),
		};
		vi.stubGlobal("visualViewport", mockViewport);

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

		// Simulate keyboard opening — height shrinks by >150px
		mockViewport.height = 400;
		for (const handler of resizeHandlers) handler();

		expect(popover.scrollIntoView).toHaveBeenCalledWith({
			behavior: "smooth",
			block: "nearest",
		});

		vi.unstubAllGlobals();
	});

	it("does not scroll when visualViewport is unavailable", () => {
		vi.stubGlobal("visualViewport", undefined);

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

		// No crash, no scroll
		expect(popover.scrollIntoView).not.toHaveBeenCalled();

		vi.unstubAllGlobals();
	});

	it("does not scroll when height shrinks less than threshold", () => {
		const resizeHandlers: Array<() => void> = [];
		const mockViewport = {
			height: 800,
			addEventListener: (_: string, handler: () => void) => {
				resizeHandlers.push(handler);
			},
			removeEventListener: vi.fn(),
		};
		vi.stubGlobal("visualViewport", mockViewport);

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

		// Shrink by only 100px — below 150px threshold
		mockViewport.height = 700;
		for (const handler of resizeHandlers) handler();

		expect(popover.scrollIntoView).not.toHaveBeenCalled();

		vi.unstubAllGlobals();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/pin-point && pnpm test -- --reporter=verbose 2>&1 | tail -20`

Expected: 3 new tests fail (the hook doesn't exist yet, so `scrollIntoView` is never called).

- [ ] **Step 3: Commit failing tests**

```bash
git add packages/pin-point/src/components/CommentPopover.test.tsx
git commit -m "test: add failing tests for mobile keyboard scroll hook"
```

---

### Task 2: Implement the hook and integrate it

**Files:**
- Modify: `packages/pin-point/src/components/CommentPopover.tsx`

- [ ] **Step 1: Add the `useScrollIntoViewOnKeyboard` hook**

Add this hook above the `CommentPopover` component (after the existing imports and types, before `export function CommentPopover`):

```tsx
const KEYBOARD_HEIGHT_THRESHOLD = 150;

function useScrollIntoViewOnKeyboard(
	ref: React.RefObject<HTMLDivElement | null>,
) {
	useEffect(() => {
		const viewport = window.visualViewport;
		if (!viewport) return;

		const baselineHeight = viewport.height;

		const handleResize = () => {
			if (
				baselineHeight - viewport.height > KEYBOARD_HEIGHT_THRESHOLD &&
				ref.current
			) {
				ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
			}
		};

		viewport.addEventListener("resize", handleResize);
		return () => viewport.removeEventListener("resize", handleResize);
	}, [ref]);
}
```

- [ ] **Step 2: Call the hook inside `CommentPopover`**

In the `CommentPopover` function body, add the hook call after the existing `useLayoutEffect` block (after line 68):

```tsx
useScrollIntoViewOnKeyboard(popoverRef);
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd packages/pin-point && pnpm test -- --reporter=verbose 2>&1 | tail -30`

Expected: All tests pass, including the 3 new ones.

- [ ] **Step 4: Run type checking**

Run: `cd packages/pin-point && pnpm tsc --noEmit`

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point/src/components/CommentPopover.tsx
git commit -m "feat: scroll popover into view when mobile keyboard opens"
```
