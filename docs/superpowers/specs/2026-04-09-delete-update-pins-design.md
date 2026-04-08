# Delete & Update Pins

## Summary

Add delete and update (content-only) functionality for pins across server and frontend.

Server already has DELETE endpoint. Need to add PATCH endpoint. Frontend needs delete/edit UI in CommentPopover read mode.

## Server

### Model

Add to `models/comment.ts`:

```ts
export const UpdateCommentSchema = Schema.Struct({ content: Schema.NonEmptyString })
export type UpdateComment = typeof UpdateCommentSchema.Type
```

### Repository

Add to `CommentRepository` interface (`comment-repo.ts`):

```ts
readonly updateById: (id: string, content: string) => Effect.Effect<PinComment | null, DatabaseError>
```

PG implementation (`comment-repo-pg.ts`):

```ts
updateById: (id: string, content: string) =>
  Effect.gen(function* () {
    const result = yield* sql`UPDATE comments SET content = ${content} WHERE id = ${id} RETURNING *`
    return result.length > 0 ? decodeRow(result[0]) : null
  }).pipe(Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e }))))
```

### Service

Add to `CommentService` interface:

```ts
readonly update: (id: string, content: string) => Effect.Effect<PinComment, CommentNotFound | DatabaseError>
```

Implementation:

```ts
update: (id: string, content: string) =>
  Effect.gen(function* () {
    const updated = yield* repo.updateById(id, content)
    if (!updated) yield* Effect.fail(new CommentNotFound({ id }))
    return updated!
  })
```

### Route

Add `PATCH /comments/:id` to `routes/comments.ts`:

- Validate body with `Schema.decodeUnknownEither(UpdateCommentSchema)`
- 400 on invalid body
- `catchTag("CommentNotFound")` -> 404
- `catchTag("DatabaseError")` -> 500
- 200 with updated `PinComment` on success

Same pattern as existing DELETE route.

Note: no `updated_at` column added — conscious omission for now. Can be added later if needed.

## Frontend

### FeedbackOverlay props

Add two new **optional** callback props to `FeedbackOverlayProps`:

```ts
onCommentDelete?: (id: string) => Promise<void>
onCommentUpdate?: (id: string, content: string) => Promise<PinComment>
```

Optional to avoid breaking existing consumers. Edit/delete buttons only render when the corresponding callback is provided.

State management after actions:
- Delete: remove comment from `comments` array, set `expandedPinId` to null
- Update: replace comment in `comments` array with returned PinComment

FeedbackOverlay bridges the props to CommentPopover by wrapping them:
- `onDelete={() => handleDelete(comment.id)}` where `handleDelete` calls `onCommentDelete`, updates state
- `onUpdate={(content) => handleUpdate(comment.id, content)}` where `handleUpdate` calls `onCommentUpdate`, updates state

### CommentPopover read mode

Add pencil (edit) and trash (delete) icon buttons in top-right corner of popover.

**Delete flow:**
1. Click trash icon
2. Inline confirmation appears: "Delete? Yes / No"
3. "Yes" calls `onCommentDelete(id)`
4. Pin removed from view

**Edit flow:**
1. Click pencil icon
2. Content text becomes pre-filled textarea
3. Save / Cancel buttons appear
4. Save calls `onCommentUpdate(id, newContent)`
5. Returns to read mode with updated content

### CommentPopover props changes

Add to read mode props:
- `onDelete: () => void`
- `onUpdate: (content: string) => Promise<void>`

Internal state for CommentPopover read mode:
- `isEditing: boolean` (shows textarea vs text)
- `isConfirmingDelete: boolean` (shows confirmation vs trash icon)
- `editContent: string` (textarea value)

### Demo app

Wire up in `packages/pin-point/demo/main.tsx`:

```ts
onCommentDelete={async (id) => {
  await fetch(`${API}/comments/${id}`, { method: "DELETE" })
}}
onCommentUpdate={async (id, content) => {
  const res = await fetch(`${API}/comments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
  return res.json()
}}
```

## Testing

### Server e2e tests

- PATCH success: 200 + updated content returned
- PATCH 404: non-existent id
- PATCH 400: missing/invalid content
- DELETE: verify existing tests still pass

### Frontend unit tests

- CommentPopover: edit mode renders textarea with existing content
- CommentPopover: save calls onUpdate with new content
- CommentPopover: cancel returns to read mode
- CommentPopover: delete confirmation flow
- CommentPopover: confirm delete calls onDelete
- FeedbackOverlay: comment removed from state after delete
- FeedbackOverlay: comment updated in state after update
