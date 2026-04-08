# Delete & Update Pins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add delete and update (content-only) for pins across server and React frontend.

**Architecture:** Server adds PATCH `/comments/:id` endpoint following existing Effect + Hono patterns. Frontend adds optional `onCommentDelete`/`onCommentUpdate` props to `FeedbackOverlay`, and edit/delete UI to `CommentPopover` read mode.

**Tech Stack:** Effect, Hono, PostgreSQL, @effect/sql-pg, React, Vitest, @testing-library/react

---

## File Map

**Server — modify:**
- `packages/pin-point-server/src/models/comment.ts` — add `UpdateCommentSchema`
- `packages/pin-point-server/src/repositories/comment-repo.ts` — add `updateById` to interface
- `packages/pin-point-server/src/repositories/comment-repo-pg.ts` — add `updateById` PG implementation
- `packages/pin-point-server/src/services/comment-service.ts` — add `update` to interface + implementation
- `packages/pin-point-server/src/routes/comments.ts` — add PATCH route, import `UpdateCommentSchema`

**Server — modify (tests):**
- `packages/pin-point-server/src/__tests__/comment-schema.test.ts` — add `UpdateCommentSchema` tests
- `packages/pin-point-server/src/__tests__/comment-service.test.ts` — add `update` tests
- `packages/pin-point-server/src/__tests__/comment-routes.test.ts` — add PATCH route tests
- `packages/pin-point-server/src/__tests__/e2e.test.ts` — add update to lifecycle test

**Frontend — modify:**
- `packages/pin-point/src/types.ts` — add optional props to `FeedbackOverlayProps`
- `packages/pin-point/src/components/CommentPopover.tsx` — add edit/delete UI to read mode
- `packages/pin-point/src/FeedbackOverlay.tsx` — wire delete/update handlers
- `packages/pin-point/src/styles/pin-point.css` — add styles for icon buttons, confirm, edit mode
- `packages/pin-point/demo/main.tsx` — wire `onCommentDelete`/`onCommentUpdate`

**Frontend — modify (tests):**
- `packages/pin-point/src/components/CommentPopover.test.tsx` — add edit/delete tests
- `packages/pin-point/src/FeedbackOverlay.test.tsx` — add delete/update integration tests

---

### Task 1: Server — UpdateCommentSchema

**Files:**
- Modify: `packages/pin-point-server/src/models/comment.ts:24-31`
- Test: `packages/pin-point-server/src/__tests__/comment-schema.test.ts`

- [ ] **Step 1: Write failing tests for UpdateCommentSchema**

Add to `comment-schema.test.ts`:

```ts
describe("UpdateCommentSchema", () => {
  it("decodes a valid update request", () => {
    const input = { content: "Updated text" }
    const result = Schema.decodeUnknownEither(UpdateCommentSchema)(input)
    expect(result._tag).toBe("Right")
  })

  it("rejects empty content", () => {
    const input = { content: "" }
    const result = Schema.decodeUnknownEither(UpdateCommentSchema)(input)
    expect(result._tag).toBe("Left")
  })

  it("rejects missing content", () => {
    const input = {}
    const result = Schema.decodeUnknownEither(UpdateCommentSchema)(input)
    expect(result._tag).toBe("Left")
  })
})
```

Update the import at the top of the file to also import `UpdateCommentSchema`:

```ts
import {
  PinCommentSchema,
  CreateCommentSchema,
  UpdateCommentSchema,
  type PinComment,
  type CreateComment,
} from "../models/comment.js"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/pin-point-server && npx vitest run src/__tests__/comment-schema.test.ts`
Expected: FAIL — `UpdateCommentSchema` not exported

- [ ] **Step 3: Add UpdateCommentSchema to model**

In `packages/pin-point-server/src/models/comment.ts`, add after the `CreateComment` type (after line 31):

```ts
export const UpdateCommentSchema = Schema.Struct({
  content: Schema.NonEmptyString,
})

export type UpdateComment = typeof UpdateCommentSchema.Type
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/pin-point-server && npx vitest run src/__tests__/comment-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point-server/src/models/comment.ts packages/pin-point-server/src/__tests__/comment-schema.test.ts
git commit -m "feat(server): add UpdateCommentSchema"
```

---

### Task 2: Server — Repository updateById

**Files:**
- Modify: `packages/pin-point-server/src/repositories/comment-repo.ts:5-13`
- Modify: `packages/pin-point-server/src/repositories/comment-repo-pg.ts:53-58`

- [ ] **Step 1: Add `updateById` to repository interface**

In `packages/pin-point-server/src/repositories/comment-repo.ts`, add to the interface object (after the `deleteById` line, before the closing `}`):

```ts
    readonly updateById: (id: string, content: string) => Effect.Effect<PinComment | null, DatabaseError>
```

- [ ] **Step 2: Run tests to verify compile error**

Run: `cd packages/pin-point-server && npx vitest run src/__tests__/comment-routes.test.ts`
Expected: FAIL — `CommentRepoTest` is missing `updateById`

- [ ] **Step 3: Add PG implementation**

In `packages/pin-point-server/src/repositories/comment-repo-pg.ts`, add after the `deleteById` method (before the closing `}` of the return object, after line 57):

```ts
      updateById: (id: string, content: string) =>
        Effect.gen(function* () {
          const result = yield* sql`UPDATE comments SET content = ${content} WHERE id = ${id} RETURNING *`
          return result.length > 0 ? decodeRow(result[0]) : null
        }).pipe(Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e })))),
```

- [ ] **Step 4: Fix test stubs to include `updateById`**

In `packages/pin-point-server/src/__tests__/comment-routes.test.ts`, add `updateById` to `CommentRepoTest` (after the `deleteById` method):

```ts
  updateById: (id, content) => {
    const idx = stored.findIndex((c) => c.id === id)
    if (idx === -1) return Effect.succeed(null)
    stored[idx] = { ...stored[idx], content }
    return Effect.succeed(stored[idx])
  },
```

In `packages/pin-point-server/src/__tests__/comment-service.test.ts`, add `updateById` to `CommentRepoTest` (after the `deleteById` method):

```ts
  updateById: (id, content) =>
    Effect.succeed(
      id === "test-id" ? { ...testComment, content } : null
    ),
```

- [ ] **Step 5: Run existing tests to verify they still pass**

Run: `cd packages/pin-point-server && npx vitest run src/__tests__/comment-routes.test.ts src/__tests__/comment-service.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/pin-point-server/src/repositories/comment-repo.ts packages/pin-point-server/src/repositories/comment-repo-pg.ts packages/pin-point-server/src/__tests__/comment-routes.test.ts packages/pin-point-server/src/__tests__/comment-service.test.ts
git commit -m "feat(server): add updateById to comment repository"
```

---

### Task 3: Server — Service update method

**Files:**
- Modify: `packages/pin-point-server/src/services/comment-service.ts:6-14`
- Test: `packages/pin-point-server/src/__tests__/comment-service.test.ts`

- [ ] **Step 1: Write failing tests for update**

Add to `packages/pin-point-server/src/__tests__/comment-service.test.ts`:

```ts
  it.effect("update returns updated comment", () =>
    Effect.gen(function* () {
      const service = yield* CommentService
      const result = yield* service.update("test-id", "New content")
      assert(result.content === "New content")
      assert(result.id === "test-id")
    }).pipe(Effect.provide(TestLive))
  )

  it.effect("update fails with CommentNotFound for unknown id", () =>
    Effect.gen(function* () {
      const service = yield* CommentService
      const result = yield* service.update("unknown", "New content").pipe(Effect.flip)
      assert(result._tag === "CommentNotFound")
      assert((result as CommentNotFound).id === "unknown")
    }).pipe(Effect.provide(TestLive))
  )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/pin-point-server && npx vitest run src/__tests__/comment-service.test.ts`
Expected: FAIL — `service.update is not a function`

- [ ] **Step 3: Add update to service interface and implementation**

In `packages/pin-point-server/src/services/comment-service.ts`:

Add to the interface (after the `delete` line, before closing `}`):

```ts
    readonly update: (id: string, content: string) => Effect.Effect<PinComment, CommentNotFound | DatabaseError>
```

Add to the implementation return object (after the `delete` method, before closing `}`):

```ts
      update: (id: string, content: string) =>
        Effect.gen(function* () {
          const updated = yield* repo.updateById(id, content)
          if (!updated) return yield* Effect.fail(new CommentNotFound({ id }))
          return updated
        }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/pin-point-server && npx vitest run src/__tests__/comment-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point-server/src/services/comment-service.ts packages/pin-point-server/src/__tests__/comment-service.test.ts
git commit -m "feat(server): add update method to comment service"
```

---

### Task 4: Server — PATCH route

**Files:**
- Modify: `packages/pin-point-server/src/routes/comments.ts:1-70`
- Test: `packages/pin-point-server/src/__tests__/comment-routes.test.ts`

- [ ] **Step 1: Write failing tests for PATCH route**

Add to `packages/pin-point-server/src/__tests__/comment-routes.test.ts`:

```ts
  it("PATCH /comments/:id updates content and returns 200", async () => {
    stored.push({
      id: "upd-me", url: "https://example.com", content: "Original",
      anchor: { selector: "#a", xPercent: 0, yPercent: 0 },
      viewport: { width: 1024 }, createdAt: "2026-01-01T00:00:00.000Z",
    })
    const res = await app.request("/comments/upd-me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Updated" }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.content).toBe("Updated")
    expect(body.id).toBe("upd-me")
  })

  it("PATCH /comments/:id returns 404 for unknown id", async () => {
    const res = await app.request("/comments/nope", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Updated" }),
    })
    expect(res.status).toBe(404)
  })

  it("PATCH /comments/:id returns 400 for invalid body", async () => {
    const res = await app.request("/comments/upd-me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it("PATCH /comments/:id returns 400 for empty content", async () => {
    const res = await app.request("/comments/upd-me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "" }),
    })
    expect(res.status).toBe(400)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/pin-point-server && npx vitest run src/__tests__/comment-routes.test.ts`
Expected: FAIL — 404 (no PATCH route exists)

- [ ] **Step 3: Add PATCH route**

In `packages/pin-point-server/src/routes/comments.ts`, update the import to include `UpdateCommentSchema`:

```ts
import { CreateCommentSchema, UpdateCommentSchema, type PinComment } from "../models/comment.js"
```

Add the PATCH handler after the DELETE handler (before `return app`):

```ts
  app.patch("/comments/:id", async (c) => {
    const id = c.req.param("id")
    const body = await c.req.json()
    const decoded = Schema.decodeUnknownEither(UpdateCommentSchema)(body)
    if (decoded._tag === "Left") {
      return c.json({ error: "Invalid request body" }, 400)
    }

    const result = await runEffect(
      Effect.gen(function* () {
        const service = yield* CommentService
        return yield* service.update(id, decoded.right.content)
      }).pipe(
        Effect.catchTag("CommentNotFound", () =>
          Effect.succeed({ _tag: "notFound" as const })
        ),
        Effect.catchTag("DatabaseError", () =>
          Effect.succeed({ _tag: "dbError" as const })
        ),
      ),
    )
    if ("_tag" in result && result._tag === "notFound") return c.json({ error: "Not found" }, 404)
    if ("_tag" in result && result._tag === "dbError") return c.json({ error: "Internal server error" }, 500)
    return c.json(result, 200)
  })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/pin-point-server && npx vitest run src/__tests__/comment-routes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point-server/src/routes/comments.ts packages/pin-point-server/src/__tests__/comment-routes.test.ts
git commit -m "feat(server): add PATCH /comments/:id route"
```

---

### Task 5: Server — E2E test for update

**Files:**
- Test: `packages/pin-point-server/src/__tests__/e2e.test.ts`

- [ ] **Step 1: Add update step to the lifecycle e2e test**

In `packages/pin-point-server/src/__tests__/e2e.test.ts`, update the test title on line 61 from:

```ts
  it("full comment lifecycle: create, list, filter, delete", async () => {
```

to:

```ts
  it("full comment lifecycle: create, list, filter, update, delete", async () => {
```

Add the following block after the filter assertions (after line 96 `expect(filtered[0].content).toBe("Comment A")`) and before the delete section:

```ts
    // Update
    const patchRes = await app.request(`/comments/${comment1.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Comment A Updated" }),
    })
    expect(patchRes.status).toBe(200)
    const patched = await patchRes.json()
    expect(patched.content).toBe("Comment A Updated")
    expect(patched.id).toBe(comment1.id)

    // Update non-existent
    const patchNotFound = await app.request("/comments/non-existent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "nope" }),
    })
    expect(patchNotFound.status).toBe(404)
```

- [ ] **Step 2: Run e2e test (requires local postgres)**

Run: `cd packages/pin-point-server && npx vitest run src/__tests__/e2e.test.ts`
Expected: PASS (requires `pinpoint_test` database running)

- [ ] **Step 3: Commit**

```bash
git add packages/pin-point-server/src/__tests__/e2e.test.ts
git commit -m "test(server): add update to e2e lifecycle test"
```

---

### Task 6: Frontend — Types and FeedbackOverlay props

**Files:**
- Modify: `packages/pin-point/src/types.ts:28-33`

- [ ] **Step 1: Add optional props to FeedbackOverlayProps**

In `packages/pin-point/src/types.ts`, add to `FeedbackOverlayProps` (after the `onCommentsFetch` line):

```ts
  onCommentDelete?: (id: string) => Promise<void>;
  onCommentUpdate?: (id: string, content: string) => Promise<PinComment>;
```

- [ ] **Step 2: Run existing frontend tests to verify nothing breaks**

Run: `cd packages/pin-point && npx vitest run`
Expected: PASS (props are optional, existing tests don't provide them)

- [ ] **Step 3: Commit**

```bash
git add packages/pin-point/src/types.ts
git commit -m "feat(frontend): add optional delete/update props to FeedbackOverlayProps"
```

---

### Task 7: Frontend — CommentPopover delete/edit UI

**Files:**
- Modify: `packages/pin-point/src/components/CommentPopover.tsx`
- Test: `packages/pin-point/src/components/CommentPopover.test.tsx`
- Modify: `packages/pin-point/src/styles/pin-point.css`

- [ ] **Step 1: Write failing tests for delete flow**

Add to `packages/pin-point/src/components/CommentPopover.test.tsx`:

```tsx
describe("CommentPopover — read mode delete", () => {
  it("shows delete button when onDelete is provided", () => {
    render(
      <CommentPopover
        mode="read"
        content="Fix the heading"
        createdAt="2026-04-08T12:00:00Z"
        viewportWidth={1440}
        top={100}
        left={200}
        onDelete={() => {}}
      />
    );
    expect(screen.getByLabelText("Delete")).toBeInTheDocument();
  });

  it("does not show delete button when onDelete is not provided", () => {
    render(
      <CommentPopover
        mode="read"
        content="Fix the heading"
        createdAt="2026-04-08T12:00:00Z"
        viewportWidth={1440}
        top={100}
        left={200}
      />
    );
    expect(screen.queryByLabelText("Delete")).not.toBeInTheDocument();
  });

  it("shows confirmation when delete is clicked, hides delete button", () => {
    render(
      <CommentPopover
        mode="read"
        content="Fix the heading"
        createdAt="2026-04-08T12:00:00Z"
        viewportWidth={1440}
        top={100}
        left={200}
        onDelete={() => {}}
      />
    );
    fireEvent.click(screen.getByLabelText("Delete"));
    // Confirmation visible
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    // Delete button replaced by confirmation
    expect(screen.queryByLabelText("Delete")).not.toBeInTheDocument();
  });

  it("cancels delete confirmation on No click", () => {
    render(
      <CommentPopover
        mode="read"
        content="Fix the heading"
        createdAt="2026-04-08T12:00:00Z"
        viewportWidth={1440}
        top={100}
        left={200}
        onDelete={() => {}}
      />
    );
    fireEvent.click(screen.getByLabelText("Delete"));
    fireEvent.click(screen.getByText("No"));
    // Back to normal — delete button visible again, no confirmation
    expect(screen.getByLabelText("Delete")).toBeInTheDocument();
    expect(screen.queryByText("Yes")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write failing tests for edit flow**

Add to `packages/pin-point/src/components/CommentPopover.test.tsx`:

```tsx
describe("CommentPopover — read mode edit", () => {
  it("shows edit button when onUpdate is provided", () => {
    render(
      <CommentPopover
        mode="read"
        content="Fix the heading"
        createdAt="2026-04-08T12:00:00Z"
        viewportWidth={1440}
        top={100}
        left={200}
        onUpdate={async () => {}}
      />
    );
    expect(screen.getByLabelText("Edit")).toBeInTheDocument();
  });

  it("clicking edit shows textarea with existing content", () => {
    render(
      <CommentPopover
        mode="read"
        content="Fix the heading"
        createdAt="2026-04-08T12:00:00Z"
        viewportWidth={1440}
        top={100}
        left={200}
        onUpdate={async () => {}}
      />
    );
    fireEvent.click(screen.getByLabelText("Edit"));
    const textarea = screen.getByDisplayValue("Fix the heading");
    expect(textarea).toBeInTheDocument();
  });

  it("save hides textarea and shows Save/Cancel buttons while editing", async () => {
    render(
      <CommentPopover
        mode="read"
        content="Fix the heading"
        createdAt="2026-04-08T12:00:00Z"
        viewportWidth={1440}
        top={100}
        left={200}
        onUpdate={async () => {}}
      />
    );
    fireEvent.click(screen.getByLabelText("Edit"));
    // Edit mode visible
    expect(screen.getByDisplayValue("Fix the heading")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    // Edit/Delete buttons hidden
    expect(screen.queryByLabelText("Edit")).not.toBeInTheDocument();
  });

  it("save with empty content is disabled", () => {
    render(
      <CommentPopover
        mode="read"
        content="Fix the heading"
        createdAt="2026-04-08T12:00:00Z"
        viewportWidth={1440}
        top={100}
        left={200}
        onUpdate={async () => {}}
      />
    );
    fireEvent.click(screen.getByLabelText("Edit"));
    const textarea = screen.getByDisplayValue("Fix the heading");
    fireEvent.change(textarea, { target: { value: "" } });
    expect(screen.getByText("Save")).toBeDisabled();
  });

  it("cancel returns to read mode showing original content", () => {
    render(
      <CommentPopover
        mode="read"
        content="Fix the heading"
        createdAt="2026-04-08T12:00:00Z"
        viewportWidth={1440}
        top={100}
        left={200}
        onUpdate={async () => {}}
      />
    );
    fireEvent.click(screen.getByLabelText("Edit"));
    const textarea = screen.getByDisplayValue("Fix the heading");
    fireEvent.change(textarea, { target: { value: "Changed" } });
    fireEvent.click(screen.getByText("Cancel"));

    // Back to read mode with original content
    expect(screen.getByText("Fix the heading")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Changed")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Edit")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/pin-point && npx vitest run src/components/CommentPopover.test.tsx`
Expected: FAIL — no `onDelete`/`onUpdate` props, no aria labels

- [ ] **Step 4: Update CommentPopover types**

In `packages/pin-point/src/components/CommentPopover.tsx`, update the `ReadProps` type to add optional callbacks:

```ts
type ReadProps = {
  mode: "read";
  content: string;
  createdAt: string;
  viewportWidth: number;
  top: number;
  left: number;
  onDelete?: () => void;
  onUpdate?: (content: string) => Promise<void>;
  onSubmit?: never;
  onCancel?: never;
};
```

- [ ] **Step 5: Update ReadContent to accept and render edit/delete**

Replace the `ReadContent` function with:

```tsx
function ReadContent({
  content,
  createdAt,
  viewportWidth,
  onDelete,
  onUpdate,
}: {
  content: string;
  createdAt: string;
  viewportWidth: number;
  onDelete?: () => void;
  onUpdate?: (content: string) => Promise<void>;
}) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [saving, setSaving] = useState(false);

  const date = new Date(createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (isEditing) {
    return (
      <>
        <textarea
          className="pp-popover-textarea"
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          autoFocus
        />
        <div className="pp-popover-actions">
          <button
            className="pp-btn pp-btn--cancel"
            onClick={() => {
              setIsEditing(false);
              setEditContent(content);
            }}
          >
            Cancel
          </button>
          <button
            className="pp-btn pp-btn--submit"
            disabled={editContent.trim().length === 0 || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onUpdate!(editContent);
                setIsEditing(false);
              } finally {
                setSaving(false);
              }
            }}
          >
            Save
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {(onDelete || onUpdate) && (
        <div className="pp-popover-toolbar">
          {onUpdate && (
            <button
              className="pp-icon-btn"
              aria-label="Edit"
              onClick={() => setIsEditing(true)}
            >
              &#9998;
            </button>
          )}
          {onDelete && !isConfirmingDelete && (
            <button
              className="pp-icon-btn pp-icon-btn--danger"
              aria-label="Delete"
              onClick={() => setIsConfirmingDelete(true)}
            >
              &#128465;
            </button>
          )}
          {isConfirmingDelete && (
            <span className="pp-confirm">
              Delete?{" "}
              <button className="pp-confirm-btn" onClick={onDelete}>
                Yes
              </button>
              {" / "}
              <button
                className="pp-confirm-btn"
                onClick={() => setIsConfirmingDelete(false)}
              >
                No
              </button>
            </span>
          )}
        </div>
      )}
      <div className="pp-popover-content">{content}</div>
      <div className="pp-popover-meta">
        {date} · {viewportWidth}px viewport
      </div>
    </>
  );
}
```

- [ ] **Step 6: Update CommentPopover to pass new props to ReadContent**

In the `CommentPopover` function, update the `ReadContent` JSX (around line 38-42):

```tsx
        <ReadContent
          content={props.content}
          createdAt={props.createdAt}
          viewportWidth={props.viewportWidth}
          onDelete={props.onDelete}
          onUpdate={props.onUpdate}
        />
```

- [ ] **Step 7: Add CSS for icon buttons and confirmation**

Add to `packages/pin-point/src/styles/pin-point.css`:

```css
[data-pin-point] .pp-popover-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-bottom: 8px;
  position: relative;
}

[data-pin-point] .pp-icon-btn {
  background: none;
  border: 1px solid #eee;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  line-height: 1;
  color: #666;
}

[data-pin-point] .pp-icon-btn:hover {
  background: #f5f5f5;
}

[data-pin-point] .pp-icon-btn--danger:hover {
  background: #fef2f2;
  color: #e74c3c;
}

[data-pin-point] .pp-confirm {
  font-size: 12px;
  color: #666;
  font-family: system-ui, -apple-system, sans-serif;
}

[data-pin-point] .pp-confirm-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: #6C5CE7;
  font-weight: 600;
  padding: 0 2px;
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd packages/pin-point && npx vitest run src/components/CommentPopover.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/pin-point/src/components/CommentPopover.tsx packages/pin-point/src/components/CommentPopover.test.tsx packages/pin-point/src/styles/pin-point.css
git commit -m "feat(frontend): add edit/delete UI to CommentPopover read mode"
```

---

### Task 8: Frontend — FeedbackOverlay wiring

**Files:**
- Modify: `packages/pin-point/src/FeedbackOverlay.tsx`
- Test: `packages/pin-point/src/FeedbackOverlay.test.tsx`

- [ ] **Step 1: Write failing tests for delete/update wiring**

Add to `packages/pin-point/src/FeedbackOverlay.test.tsx` inside the `interaction` describe block:

```tsx
    it("delete flow: clicking delete removes comment from state", async () => {
      const target = document.createElement("div");
      target.id = "test";
      document.body.appendChild(target);

      vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
        top: 100, left: 100, width: 200, height: 50,
        bottom: 150, right: 300, x: 100, y: 100, toJSON: () => {},
      } as DOMRect);

      const onCommentDelete = vi.fn(async () => {});
      render(
        <FeedbackOverlay
          onCommentCreate={async () => {}}
          onCommentsFetch={async () => [mockComment]}
          onCommentDelete={onCommentDelete}
        >
          <div>My App</div>
        </FeedbackOverlay>
      );

      // Wait for pin
      let pinMarker: HTMLElement;
      await waitFor(() => {
        pinMarker = document.querySelector(".pp-pin") as HTMLElement;
        expect(pinMarker).toBeInTheDocument();
      });

      // Open popover
      fireEvent.click(pinMarker!);
      await waitFor(() => {
        expect(screen.getByText("Fix this heading")).toBeInTheDocument();
      });

      // Click delete
      fireEvent.click(screen.getByLabelText("Delete"));
      // Confirm
      fireEvent.click(screen.getByText("Yes"));

      await waitFor(() => {
        // Pin and popover gone from the page
        expect(document.querySelector(".pp-pin")).not.toBeInTheDocument();
        expect(screen.queryByText("Fix this heading")).not.toBeInTheDocument();
      });

      target.remove();
    });

    it("update flow: editing updates comment in state", async () => {
      const target = document.createElement("div");
      target.id = "test";
      document.body.appendChild(target);

      vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
        top: 100, left: 100, width: 200, height: 50,
        bottom: 150, right: 300, x: 100, y: 100, toJSON: () => {},
      } as DOMRect);

      const updatedComment = { ...mockComment, content: "Updated heading" };
      const onCommentUpdate = vi.fn(async () => updatedComment);
      render(
        <FeedbackOverlay
          onCommentCreate={async () => {}}
          onCommentsFetch={async () => [mockComment]}
          onCommentUpdate={onCommentUpdate}
        >
          <div>My App</div>
        </FeedbackOverlay>
      );

      let pinMarker: HTMLElement;
      await waitFor(() => {
        pinMarker = document.querySelector(".pp-pin") as HTMLElement;
        expect(pinMarker).toBeInTheDocument();
      });

      fireEvent.click(pinMarker!);
      await waitFor(() => {
        expect(screen.getByText("Fix this heading")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText("Edit"));
      const textarea = screen.getByDisplayValue("Fix this heading");
      fireEvent.change(textarea, { target: { value: "Updated heading" } });
      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        // Updated content visible, edit mode dismissed
        expect(screen.getByText("Updated heading")).toBeInTheDocument();
        expect(screen.queryByDisplayValue("Updated heading")).not.toBeInTheDocument();
      });

      target.remove();
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/pin-point && npx vitest run src/FeedbackOverlay.test.tsx`
Expected: FAIL — `onDelete`/`onUpdate` not passed to CommentPopover

- [ ] **Step 3: Add handlers and wire props in FeedbackOverlay**

In `packages/pin-point/src/FeedbackOverlay.tsx`:

Update the destructured props (line 11-16) to include new optional props:

```tsx
export function FeedbackOverlay({
  onCommentCreate,
  onCommentsFetch,
  onCommentDelete,
  onCommentUpdate,
  queryParam = "feedback",
  children,
}: FeedbackOverlayProps) {
```

Add handler functions after `handleCancel` (after line 76):

```tsx
  const handleDelete = useCallback(
    async (id: string) => {
      if (!onCommentDelete) return;
      await onCommentDelete(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
      setExpandedPinId(null);
    },
    [onCommentDelete]
  );

  const handleUpdate = useCallback(
    async (id: string, content: string) => {
      if (!onCommentUpdate) return;
      const updated = await onCommentUpdate(id, content);
      setComments((prev) =>
        prev.map((c) => (c.id === id ? updated : c))
      );
    },
    [onCommentUpdate]
  );
```

Update the read-mode `CommentPopover` JSX (around line 114-121) to pass delete/update:

```tsx
            <CommentPopover
              mode="read"
              content={comment.content}
              createdAt={comment.createdAt}
              viewportWidth={comment.viewport.width}
              top={pos.top}
              left={pos.left}
              onDelete={onCommentDelete ? () => handleDelete(comment.id) : undefined}
              onUpdate={
                onCommentUpdate
                  ? async (content: string) => {
                      await handleUpdate(comment.id, content);
                    }
                  : undefined
              }
            />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/pin-point && npx vitest run src/FeedbackOverlay.test.tsx`
Expected: PASS

- [ ] **Step 5: Run all frontend tests**

Run: `cd packages/pin-point && npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/pin-point/src/FeedbackOverlay.tsx packages/pin-point/src/FeedbackOverlay.test.tsx
git commit -m "feat(frontend): wire delete/update handlers in FeedbackOverlay"
```

---

### Task 9: Frontend — Demo app

**Files:**
- Modify: `packages/pin-point/demo/main.tsx`

- [ ] **Step 1: Add delete/update handlers to demo**

In `packages/pin-point/demo/main.tsx`, add the following props to the `<FeedbackOverlay>` component (after the `onCommentsFetch` prop):

```tsx
      onCommentDelete={async (id) => {
        await fetch(`${API}/comments/${id}`, { method: "DELETE" });
      }}
      onCommentUpdate={async (id, content) => {
        const res = await fetch(`${API}/comments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        return res.json();
      }}
```

- [ ] **Step 2: Verify demo builds**

Run: `cd packages/pin-point && npx vite build demo`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add packages/pin-point/demo/main.tsx
git commit -m "feat(demo): wire delete/update handlers"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run all server tests**

Run: `cd packages/pin-point-server && npx vitest run`
Expected: All pass

- [ ] **Step 2: Run all frontend tests**

Run: `cd packages/pin-point && npx vitest run`
Expected: All pass

- [ ] **Step 3: Check types**

Run: `cd packages/pin-point && npx tsc --noEmit && cd ../pin-point-server && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Check lint**

Run: `npm run lint` (or equivalent from project root)
Expected: No lint errors
