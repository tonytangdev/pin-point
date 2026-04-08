# Effect TS + PostgreSQL Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `pin-point-server` from async/await + SQLite to Effect TS + PostgreSQL while preserving the same REST API contract.

**Architecture:** Full rewrite of ~600 LOC backend. Effect services/layers replace manual DI. `@effect/sql-pg` replaces `better-sqlite3`. `effect/Schema` replaces Zod. Hono stays as HTTP framework, bridged to Effect via `Effect.runPromise`.

**Tech Stack:** Effect, @effect/sql-pg, @effect/platform-node, @effect/vitest, Hono, PostgreSQL 18, Docker Compose

**Spec:** `docs/superpowers/specs/2026-04-08-effect-ts-postgres-migration-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/pin-point-server/docker-compose.yml` | Postgres 18 for dev/test |
| Create | `packages/pin-point-server/src/errors.ts` | Tagged error classes |
| Create | `packages/pin-point-server/src/config.ts` | AppConfig via Effect.Config (replaces current) |
| Create | `packages/pin-point-server/src/models/comment.ts` | Domain schemas (replaces src/types.ts) |
| Create | `packages/pin-point-server/src/repositories/comment-repo.ts` | CommentRepository service tag (replaces interface) |
| Create | `packages/pin-point-server/src/repositories/comment-repo-pg.ts` | Postgres implementation + row schema |
| Create | `packages/pin-point-server/src/services/comment-service.ts` | CommentService layer (replaces current) |
| Create | `packages/pin-point-server/src/routes/comments.ts` | Hono routes with Effect bridge (replaces current) |
| Create | `packages/pin-point-server/src/app.ts` | Hono app factory (replaces current) |
| Create | `packages/pin-point-server/src/migrations/0001_create_comments.ts` | Initial DB migration |
| Create | `packages/pin-point-server/src/index.ts` | Entry point with layer composition (replaces current) |
| Create | `packages/pin-point-server/src/__tests__/comment-service.test.ts` | Unit tests with stub layers |
| Create | `packages/pin-point-server/src/__tests__/comment-routes.test.ts` | Route tests with stub layers |
| Create | `packages/pin-point-server/src/__tests__/e2e.test.ts` | E2E tests with real Postgres |
| Modify | `packages/pin-point-server/package.json` | Swap dependencies |
| Delete | `packages/pin-point-server/src/types.ts` | Replaced by models/comment.ts |
| Delete | `packages/pin-point-server/src/repositories/comment-repository.ts` | Replaced by comment-repo.ts |
| Delete | `packages/pin-point-server/src/repositories/sqlite-repository.ts` | Replaced by comment-repo-pg.ts |
| Delete | `packages/pin-point-server/src/repositories/in-memory-repository.ts` | Replaced by stub layers in tests |
| Delete | `packages/pin-point-server/src/__tests__/sqlite-repository.test.ts` | Replaced by new tests |
| Delete | `packages/pin-point-server/src/__tests__/types.test.ts` | Replaced by schema tests in new test files |

---

### Task 1: Swap Dependencies

**Files:**
- Modify: `packages/pin-point-server/package.json`

- [ ] **Step 1: Remove old dependencies**

```bash
cd packages/pin-point-server && pnpm remove better-sqlite3 @types/better-sqlite3 zod @hono/zod-validator
```

- [ ] **Step 2: Add Effect ecosystem dependencies**

```bash
cd packages/pin-point-server && pnpm add effect @effect/sql @effect/sql-pg @effect/platform @effect/platform-node
```

- [ ] **Step 3: Add Effect test dependency**

```bash
cd packages/pin-point-server && pnpm add -D @effect/vitest
```

- [ ] **Step 4: Verify install succeeded**

```bash
cd packages/pin-point-server && pnpm ls --depth 0
```

Expected: effect, @effect/sql, @effect/sql-pg, @effect/platform, @effect/platform-node, @effect/vitest listed. No better-sqlite3, zod, or @hono/zod-validator.

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point-server/package.json pnpm-lock.yaml
git commit -m "chore(server): swap deps to effect ecosystem, remove sqlite/zod"
```

---

### Task 2: Docker Compose + Errors + Config

**Files:**
- Create: `packages/pin-point-server/docker-compose.yml`
- Create: `packages/pin-point-server/src/errors.ts`
- Create: `packages/pin-point-server/src/config.ts` (replace existing)

- [ ] **Step 1: Create docker-compose.yml**

```yaml
# packages/pin-point-server/docker-compose.yml
services:
  postgres:
    image: postgres:18
    environment:
      POSTGRES_DB: pinpoint
      POSTGRES_USER: pinpoint
      POSTGRES_PASSWORD: pinpoint
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 2: Start Postgres and verify it's running**

```bash
cd packages/pin-point-server && docker compose up -d
docker compose exec postgres pg_isready
```

Expected: `localhost:5432 - accepting connections`

- [ ] **Step 3: Create errors.ts**

```typescript
// packages/pin-point-server/src/errors.ts
import { Data } from "effect"

export class CommentNotFound extends Data.TaggedError("CommentNotFound")<{
  readonly id: string
}> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly cause: unknown
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string
}> {}
```

- [ ] **Step 4: Replace config.ts with Effect.Config version**

Delete existing `packages/pin-point-server/src/config.ts` and create:

```typescript
// packages/pin-point-server/src/config.ts
import { Config } from "effect"

export const AppConfig = Config.all({
  port: Config.number("PORT").pipe(Config.withDefault(3000)),
  host: Config.string("HOST").pipe(Config.withDefault("0.0.0.0")),
  corsOrigin: Config.string("CORS_ORIGIN").pipe(Config.withDefault("*")),
})

export type AppConfig = Config.Config.Success<typeof AppConfig>
```

- [ ] **Step 5: Verify types compile**

```bash
cd packages/pin-point-server && npx tsc --noEmit src/errors.ts src/config.ts
```

Expected: no errors (may warn about missing other files — that's ok, we're rewriting them).

- [ ] **Step 6: Commit**

```bash
git add packages/pin-point-server/docker-compose.yml packages/pin-point-server/src/errors.ts packages/pin-point-server/src/config.ts
git commit -m "feat(server): add docker-compose, effect errors, effect config"
```

---

### Task 3: Domain Schemas

**Files:**
- Create: `packages/pin-point-server/src/models/comment.ts`
- Create: `packages/pin-point-server/src/__tests__/comment-schema.test.ts`

- [ ] **Step 1: Write the failing test for domain schemas**

```typescript
// packages/pin-point-server/src/__tests__/comment-schema.test.ts
import { describe, it, expect } from "vitest"
import { Schema } from "effect"
import {
  PinCommentSchema,
  CreateCommentSchema,
  type PinComment,
  type CreateComment,
} from "../models/comment.js"

describe("CreateCommentSchema", () => {
  it("decodes a valid create request", () => {
    const input = {
      url: "https://example.com",
      content: "Hello",
      anchor: { selector: "#main", xPercent: 50, yPercent: 25 },
      viewport: { width: 1024 },
    }
    const result = Schema.decodeUnknownEither(CreateCommentSchema)(input)
    expect(result._tag).toBe("Right")
  })

  it("rejects missing required fields", () => {
    const input = { url: "https://example.com" }
    const result = Schema.decodeUnknownEither(CreateCommentSchema)(input)
    expect(result._tag).toBe("Left")
  })
})

describe("PinCommentSchema", () => {
  it("decodes a full comment", () => {
    const input = {
      id: "abc-123",
      url: "https://example.com",
      content: "Hello",
      anchor: { selector: "#main", xPercent: 50, yPercent: 25 },
      viewport: { width: 1024 },
      createdAt: "2026-01-01T00:00:00.000Z",
    }
    const result = Schema.decodeUnknownEither(PinCommentSchema)(input)
    expect(result._tag).toBe("Right")
  })

  it("rejects invalid anchor (missing selector)", () => {
    const input = {
      id: "abc-123",
      url: "https://example.com",
      content: "Hello",
      anchor: { xPercent: 50, yPercent: 25 },
      viewport: { width: 1024 },
      createdAt: "2026-01-01T00:00:00.000Z",
    }
    const result = Schema.decodeUnknownEither(PinCommentSchema)(input)
    expect(result._tag).toBe("Left")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/pin-point-server && npx vitest run src/__tests__/comment-schema.test.ts
```

Expected: FAIL — cannot resolve `../models/comment.js`

- [ ] **Step 3: Create the domain schemas**

```typescript
// packages/pin-point-server/src/models/comment.ts
import { Schema } from "effect"

export const AnchorSchema = Schema.Struct({
  selector: Schema.String,
  xPercent: Schema.Number,
  yPercent: Schema.Number,
})

export const ViewportSchema = Schema.Struct({
  width: Schema.Number,
})

export const PinCommentSchema = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
  content: Schema.String,
  anchor: AnchorSchema,
  viewport: ViewportSchema,
  createdAt: Schema.String,
})

export type PinComment = typeof PinCommentSchema.Type

export const CreateCommentSchema = Schema.Struct({
  url: Schema.String,
  content: Schema.String,
  anchor: AnchorSchema,
  viewport: ViewportSchema,
})

export type CreateComment = typeof CreateCommentSchema.Type
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/pin-point-server && npx vitest run src/__tests__/comment-schema.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point-server/src/models/comment.ts packages/pin-point-server/src/__tests__/comment-schema.test.ts
git commit -m "feat(server): add effect domain schemas with tests"
```

---

### Task 4: CommentRepository Service Tag

**Files:**
- Create: `packages/pin-point-server/src/repositories/comment-repo.ts`

- [ ] **Step 1: Create the CommentRepository service tag**

```typescript
// packages/pin-point-server/src/repositories/comment-repo.ts
import { Context, Effect } from "effect"
import type { PinComment } from "../models/comment.js"
import type { DatabaseError } from "../errors.js"

export class CommentRepository extends Context.Tag("CommentRepository")<
  CommentRepository,
  {
    readonly create: (comment: PinComment) => Effect.Effect<PinComment, DatabaseError>
    readonly findByUrl: (url: string) => Effect.Effect<PinComment[], DatabaseError>
    readonly findAll: () => Effect.Effect<PinComment[], DatabaseError>
    readonly deleteById: (id: string) => Effect.Effect<boolean, DatabaseError>
  }
>() {}
```

- [ ] **Step 2: Verify types compile**

```bash
cd packages/pin-point-server && npx tsc --noEmit src/repositories/comment-repo.ts
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/pin-point-server/src/repositories/comment-repo.ts
git commit -m "feat(server): add CommentRepository effect service tag"
```

---

### Task 5: CommentService Layer + Unit Tests

**Files:**
- Create: `packages/pin-point-server/src/services/comment-service.ts` (replace existing)
- Create: `packages/pin-point-server/src/__tests__/comment-service.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/pin-point-server/src/__tests__/comment-service.test.ts
import { describe, assert } from "vitest"
import { it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { CommentService, CommentServiceLive } from "../services/comment-service.js"
import { CommentRepository } from "../repositories/comment-repo.js"
import type { PinComment } from "../models/comment.js"
import { CommentNotFound } from "../errors.js"

const testComment: PinComment = {
  id: "test-id",
  url: "https://example.com",
  content: "Hello",
  anchor: { selector: "#main", xPercent: 50, yPercent: 25 },
  viewport: { width: 1024 },
  createdAt: "2026-01-01T00:00:00.000Z",
}

const CommentRepoTest = Layer.succeed(CommentRepository, {
  create: (comment) => Effect.succeed(comment),
  findByUrl: (url) =>
    Effect.succeed(url === testComment.url ? [testComment] : []),
  findAll: () => Effect.succeed([testComment]),
  deleteById: (id) => Effect.succeed(id === "test-id"),
})

const TestLive = CommentServiceLive.pipe(Layer.provide(CommentRepoTest))

describe("CommentService", () => {
  it.effect("create returns a comment with generated id and createdAt", () =>
    Effect.gen(function* () {
      const service = yield* CommentService
      const result = yield* service.create({
        url: "https://example.com",
        content: "Hello",
        anchor: { selector: "#main", xPercent: 50, yPercent: 25 },
        viewport: { width: 1024 },
      })
      assert(result.id !== undefined)
      assert(result.createdAt !== undefined)
      assert(result.url === "https://example.com")
    }).pipe(Effect.provide(TestLive))
  )

  it.effect("findAll returns comments", () =>
    Effect.gen(function* () {
      const service = yield* CommentService
      const result = yield* service.findAll()
      assert(result.length === 1)
      assert(result[0].id === "test-id")
    }).pipe(Effect.provide(TestLive))
  )

  it.effect("findByUrl returns filtered comments", () =>
    Effect.gen(function* () {
      const service = yield* CommentService
      const found = yield* service.findByUrl("https://example.com")
      assert(found.length === 1)
      const notFound = yield* service.findByUrl("https://other.com")
      assert(notFound.length === 0)
    }).pipe(Effect.provide(TestLive))
  )

  it.effect("delete succeeds for existing comment", () =>
    Effect.gen(function* () {
      const service = yield* CommentService
      yield* service.delete("test-id")
    }).pipe(Effect.provide(TestLive))
  )

  it.effect("delete fails with CommentNotFound for unknown id", () =>
    Effect.gen(function* () {
      const service = yield* CommentService
      const result = yield* service.delete("unknown").pipe(Effect.flip)
      assert(result._tag === "CommentNotFound")
      assert((result as CommentNotFound).id === "unknown")
    }).pipe(Effect.provide(TestLive))
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/pin-point-server && npx vitest run src/__tests__/comment-service.test.ts
```

Expected: FAIL — cannot resolve `../services/comment-service.js`

- [ ] **Step 3: Write the CommentService implementation**

Delete existing `packages/pin-point-server/src/services/comment-service.ts` and create:

```typescript
// packages/pin-point-server/src/services/comment-service.ts
import { Context, Effect, Layer } from "effect"
import type { PinComment, CreateComment } from "../models/comment.js"
import { CommentRepository } from "../repositories/comment-repo.js"
import { CommentNotFound, type DatabaseError } from "../errors.js"

export class CommentService extends Context.Tag("CommentService")<
  CommentService,
  {
    readonly create: (input: CreateComment) => Effect.Effect<PinComment, DatabaseError>
    readonly findAll: () => Effect.Effect<PinComment[], DatabaseError>
    readonly findByUrl: (url: string) => Effect.Effect<PinComment[], DatabaseError>
    readonly delete: (id: string) => Effect.Effect<void, CommentNotFound | DatabaseError>
  }
>() {}

export const CommentServiceLive = Layer.effect(
  CommentService,
  Effect.gen(function* () {
    const repo = yield* CommentRepository

    return {
      create: (input: CreateComment) =>
        Effect.gen(function* () {
          const comment: PinComment = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            ...input,
          }
          return yield* repo.create(comment)
        }),

      findAll: () => repo.findAll(),

      findByUrl: (url: string) => repo.findByUrl(url),

      delete: (id: string) =>
        Effect.gen(function* () {
          const deleted = yield* repo.deleteById(id)
          if (!deleted) yield* Effect.fail(new CommentNotFound({ id }))
        }),
    }
  }),
)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/pin-point-server && npx vitest run src/__tests__/comment-service.test.ts
```

Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point-server/src/services/comment-service.ts packages/pin-point-server/src/__tests__/comment-service.test.ts
git commit -m "feat(server): add effect CommentService layer with unit tests"
```

---

### Task 6: Hono Routes + Route Tests

**Files:**
- Create: `packages/pin-point-server/src/routes/comments.ts` (replace existing)
- Create: `packages/pin-point-server/src/app.ts` (replace existing)
- Create: `packages/pin-point-server/src/__tests__/comment-routes.test.ts` (replace existing)

- [ ] **Step 1: Write the failing route tests**

```typescript
// packages/pin-point-server/src/__tests__/comment-routes.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { Effect, Layer } from "effect"
import { CommentRepository } from "../repositories/comment-repo.js"
import { CommentServiceLive } from "../services/comment-service.js"
import { createApp } from "../app.js"
import type { PinComment } from "../models/comment.js"

const stored: PinComment[] = []

const CommentRepoTest = Layer.succeed(CommentRepository, {
  create: (comment) => {
    stored.push(comment)
    return Effect.succeed(comment)
  },
  findByUrl: (url) =>
    Effect.succeed(stored.filter((c) => c.url === url)),
  findAll: () => Effect.succeed([...stored]),
  deleteById: (id) => {
    const idx = stored.findIndex((c) => c.id === id)
    if (idx === -1) return Effect.succeed(false)
    stored.splice(idx, 1)
    return Effect.succeed(true)
  },
})

const TestLive = CommentServiceLive.pipe(Layer.provide(CommentRepoTest))

describe("Comment Routes", () => {
  const app = createApp(TestLive)

  beforeEach(() => {
    stored.length = 0
  })

  it("POST /comments creates a comment and returns 201", async () => {
    const res = await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com",
        content: "Test comment",
        anchor: { selector: "#main", xPercent: 50, yPercent: 25 },
        viewport: { width: 1024 },
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.url).toBe("https://example.com")
    expect(body.id).toBeDefined()
    expect(body.createdAt).toBeDefined()
  })

  it("POST /comments with invalid body returns 400", async () => {
    const res = await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    })
    expect(res.status).toBe(400)
  })

  it("GET /comments returns all comments", async () => {
    stored.push({
      id: "1",
      url: "https://example.com",
      content: "A",
      anchor: { selector: "#a", xPercent: 0, yPercent: 0 },
      viewport: { width: 1024 },
      createdAt: "2026-01-01T00:00:00.000Z",
    })
    const res = await app.request("/comments")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.length).toBe(1)
  })

  it("GET /comments?url= filters by url", async () => {
    stored.push(
      {
        id: "1",
        url: "https://a.com",
        content: "A",
        anchor: { selector: "#a", xPercent: 0, yPercent: 0 },
        viewport: { width: 1024 },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "2",
        url: "https://b.com",
        content: "B",
        anchor: { selector: "#b", xPercent: 0, yPercent: 0 },
        viewport: { width: 1024 },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    )
    const res = await app.request("/comments?url=https://a.com")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.length).toBe(1)
    expect(body[0].url).toBe("https://a.com")
  })

  it("DELETE /comments/:id returns 204 on success", async () => {
    stored.push({
      id: "del-me",
      url: "https://example.com",
      content: "Delete me",
      anchor: { selector: "#a", xPercent: 0, yPercent: 0 },
      viewport: { width: 1024 },
      createdAt: "2026-01-01T00:00:00.000Z",
    })
    const res = await app.request("/comments/del-me", { method: "DELETE" })
    expect(res.status).toBe(204)
  })

  it("DELETE /comments/:id returns 404 for unknown id", async () => {
    const res = await app.request("/comments/nope", { method: "DELETE" })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/pin-point-server && npx vitest run src/__tests__/comment-routes.test.ts
```

Expected: FAIL — cannot resolve `../app.js`

- [ ] **Step 3: Write the routes**

Delete existing `packages/pin-point-server/src/routes/comments.ts` and create:

```typescript
// packages/pin-point-server/src/routes/comments.ts
import { Hono } from "hono"
import { Effect, Layer, Schema } from "effect"
import { CommentService } from "../services/comment-service.js"
import { CreateCommentSchema, type PinComment } from "../models/comment.js"

export const makeCommentRoutes = (layer: Layer.Layer<CommentService>) => {
  const app = new Hono()

  const runEffect = <A>(effect: Effect.Effect<A, never, CommentService>) =>
    Effect.runPromise(effect.pipe(Effect.provide(layer)))

  app.post("/comments", async (c) => {
    const body = await c.req.json()
    const decoded = Schema.decodeUnknownEither(CreateCommentSchema)(body)
    if (decoded._tag === "Left") {
      return c.json({ error: "Invalid request body" }, 400)
    }

    const result = await runEffect(
      Effect.gen(function* () {
        const service = yield* CommentService
        return yield* service.create(decoded.right)
      }).pipe(
        Effect.catchTag("DatabaseError", () =>
          Effect.succeed({ _error: true as const })
        ),
      ),
    )
    if ("_error" in result) return c.json({ error: "Internal server error" }, 500)
    return c.json(result, 201)
  })

  app.get("/comments", async (c) => {
    const url = c.req.query("url")
    const result = await runEffect(
      Effect.gen(function* () {
        const service = yield* CommentService
        return url ? yield* service.findByUrl(url) : yield* service.findAll()
      }).pipe(
        Effect.catchTag("DatabaseError", () =>
          Effect.succeed([] as PinComment[])
        ),
      ),
    )
    return c.json(result)
  })

  app.delete("/comments/:id", async (c) => {
    const id = c.req.param("id")
    const result = await runEffect(
      Effect.gen(function* () {
        const service = yield* CommentService
        yield* service.delete(id)
        return { _tag: "ok" as const }
      }).pipe(
        Effect.catchTag("CommentNotFound", () =>
          Effect.succeed({ _tag: "notFound" as const })
        ),
        Effect.catchTag("DatabaseError", () =>
          Effect.succeed({ _tag: "dbError" as const })
        ),
      ),
    )
    if (result._tag === "notFound") return c.json({ error: "Not found" }, 404)
    if (result._tag === "dbError") return c.json({ error: "Internal server error" }, 500)
    return c.body(null, 204)
  })

  return app
}
```

- [ ] **Step 4: Write the app factory**

Delete existing `packages/pin-point-server/src/app.ts` and create:

```typescript
// packages/pin-point-server/src/app.ts
import { Hono } from "hono"
import { cors } from "hono/cors"
import type { Layer } from "effect"
import type { CommentService } from "./services/comment-service.js"
import { makeCommentRoutes } from "./routes/comments.js"

export const createApp = (layer: Layer.Layer<CommentService>) => {
  const app = new Hono()

  app.use("*", cors())
  app.route("/", makeCommentRoutes(layer))

  app.onError((err, c) => {
    console.error(err)
    return c.json({ error: "Internal server error" }, 500)
  })

  return app
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/pin-point-server && npx vitest run src/__tests__/comment-routes.test.ts
```

Expected: all 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/pin-point-server/src/routes/comments.ts packages/pin-point-server/src/app.ts packages/pin-point-server/src/__tests__/comment-routes.test.ts
git commit -m "feat(server): add effect-bridged hono routes with tests"
```

---

### Task 7: Postgres Repository + Migration

**Files:**
- Create: `packages/pin-point-server/src/repositories/comment-repo-pg.ts`
- Create: `packages/pin-point-server/src/migrations/0001_create_comments.ts`

- [ ] **Step 1: Create the migration**

```typescript
// packages/pin-point-server/src/migrations/0001_create_comments.ts
import { SqlClient } from "@effect/sql"
import { Effect } from "effect"

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  sql`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      content TEXT NOT NULL,
      anchor JSONB NOT NULL,
      viewport JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_comments_url ON comments(url);
  `
)
```

- [ ] **Step 2: Create the Postgres repository implementation**

```typescript
// packages/pin-point-server/src/repositories/comment-repo-pg.ts
import { Effect, Layer, Schema } from "effect"
import { SqlClient } from "@effect/sql"
import { CommentRepository } from "./comment-repo.js"
import { AnchorSchema, ViewportSchema, type PinComment } from "../models/comment.js"
import { DatabaseError } from "../errors.js"

const PinCommentRowSchema = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
  content: Schema.String,
  anchor: AnchorSchema,
  viewport: ViewportSchema,
  createdAt: Schema.String.pipe(Schema.propertySignature, Schema.fromKey("created_at")),
})

const decodeRow = Schema.decodeUnknownSync(PinCommentRowSchema)

export const CommentRepoLive = Layer.effect(
  CommentRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    return {
      create: (comment: PinComment) =>
        Effect.gen(function* () {
          yield* sql`
            INSERT INTO comments (id, url, content, anchor, viewport, created_at)
            VALUES (${comment.id}, ${comment.url}, ${comment.content},
                    ${comment.anchor}, ${comment.viewport}, ${comment.createdAt})
          `
          return comment
        }).pipe(Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e })))),

      findByUrl: (url: string) =>
        sql`SELECT * FROM comments WHERE url = ${url}`
          .pipe(
            Effect.map((rows) => rows.map(decodeRow)),
            Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e }))),
          ),

      findAll: () =>
        sql`SELECT * FROM comments`
          .pipe(
            Effect.map((rows) => rows.map(decodeRow)),
            Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e }))),
          ),

      deleteById: (id: string) =>
        Effect.gen(function* () {
          const result = yield* sql`DELETE FROM comments WHERE id = ${id} RETURNING id`
          return result.length > 0
        }).pipe(Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e })))),
    }
  }),
)
```

- [ ] **Step 3: Verify types compile**

```bash
cd packages/pin-point-server && npx tsc --noEmit src/repositories/comment-repo-pg.ts src/migrations/0001_create_comments.ts
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/pin-point-server/src/repositories/comment-repo-pg.ts packages/pin-point-server/src/migrations/0001_create_comments.ts
git commit -m "feat(server): add postgres repository with row schema and migration"
```

---

### Task 8: Entry Point + Layer Composition

**Files:**
- Create: `packages/pin-point-server/src/index.ts` (replace existing)

- [ ] **Step 1: Write the entry point**

Delete existing `packages/pin-point-server/src/index.ts` and create:

```typescript
// packages/pin-point-server/src/index.ts
import { Effect, Config, Layer } from "effect"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { PgClient, PgMigrator } from "@effect/sql-pg"
import { serve } from "@hono/node-server"
import { fileURLToPath } from "node:url"
import { createApp } from "./app.js"
import { AppConfig } from "./config.js"
import { CommentRepoLive } from "./repositories/comment-repo-pg.js"
import { CommentServiceLive } from "./services/comment-service.js"

const SqlLive = PgClient.layerConfig({
  database: Config.string("PG_DATABASE"),
  host: Config.string("PG_HOST").pipe(Config.withDefault("localhost")),
  port: Config.number("PG_PORT").pipe(Config.withDefault(5432)),
  username: Config.string("PG_USERNAME").pipe(Config.withDefault("pinpoint")),
  password: Config.redacted("PG_PASSWORD"),
})

const MigratorLive = PgMigrator.layer({
  loader: PgMigrator.fromFileSystem(
    fileURLToPath(new URL("migrations", import.meta.url))
  ),
  schemaDirectory: "src/migrations",
}).pipe(Layer.provide(SqlLive))

const MainLive = CommentServiceLive.pipe(
  Layer.provide(CommentRepoLive),
  Layer.provide(SqlLive),
)

const program = Effect.gen(function* () {
  const config = yield* Effect.config(AppConfig)
  const app = createApp(MainLive)

  const server = serve({
    fetch: app.fetch,
    port: config.port,
    hostname: config.host,
  })

  yield* Effect.log(`Server listening on ${config.host}:${config.port}`)

  yield* Effect.addFinalizer(() =>
    Effect.sync(() => server.close()),
  )

  yield* Effect.never
})

program.pipe(
  Effect.scoped,
  Effect.provide(Layer.mergeAll(MainLive, MigratorLive)),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain,
)
```

- [ ] **Step 2: Verify types compile**

```bash
cd packages/pin-point-server && npx tsc --noEmit
```

Expected: no errors (old files will cause errors — proceed to Task 9 to clean them up)

- [ ] **Step 3: Commit**

```bash
git add packages/pin-point-server/src/index.ts
git commit -m "feat(server): add effect entry point with layer composition"
```

---

### Task 9: Delete Old Files

**Files:**
- Delete: `packages/pin-point-server/src/types.ts`
- Delete: `packages/pin-point-server/src/repositories/comment-repository.ts`
- Delete: `packages/pin-point-server/src/repositories/sqlite-repository.ts`
- Delete: `packages/pin-point-server/src/repositories/in-memory-repository.ts`
- Delete: `packages/pin-point-server/src/__tests__/sqlite-repository.test.ts`
- Delete: `packages/pin-point-server/src/__tests__/types.test.ts`
- Delete: `packages/pin-point-server/src/__tests__/comments-routes.test.ts`
- Delete: `packages/pin-point-server/src/__tests__/e2e.test.ts`

- [ ] **Step 1: Delete all old source files**

```bash
cd packages/pin-point-server && rm \
  src/types.ts \
  src/repositories/comment-repository.ts \
  src/repositories/sqlite-repository.ts \
  src/repositories/in-memory-repository.ts \
  src/__tests__/sqlite-repository.test.ts \
  src/__tests__/types.test.ts \
  src/__tests__/comments-routes.test.ts \
  src/__tests__/e2e.test.ts
```

- [ ] **Step 2: Verify tsc compiles clean**

```bash
cd packages/pin-point-server && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run all existing tests pass**

```bash
cd packages/pin-point-server && npx vitest run
```

Expected: comment-schema, comment-service, comment-routes tests all PASS

- [ ] **Step 4: Commit**

```bash
git add -A packages/pin-point-server/src
git commit -m "refactor(server): remove old sqlite/zod/in-memory code"
```

---

### Task 10: E2E Tests with Real Postgres

**Files:**
- Create: `packages/pin-point-server/src/__tests__/e2e.test.ts`

**Prerequisite:** Postgres must be running via `docker compose up -d` in `packages/pin-point-server`.

- [ ] **Step 1: Create the pinpoint_test database**

```bash
cd packages/pin-point-server && docker compose exec postgres psql -U pinpoint -c "CREATE DATABASE pinpoint_test;" || true
```

- [ ] **Step 2: Write the E2E test**

```typescript
// packages/pin-point-server/src/__tests__/e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest"
import { Effect, Layer, Redacted, Scope } from "effect"
import { NodeContext } from "@effect/platform-node"
import { PgClient, PgMigrator } from "@effect/sql-pg"
import { SqlClient } from "@effect/sql"
import { fileURLToPath } from "node:url"
import { createApp } from "../app.js"
import { CommentRepoLive } from "../repositories/comment-repo-pg.js"
import { CommentServiceLive } from "../services/comment-service.js"

const TestSqlLive = PgClient.layer({
  database: "pinpoint_test",
  host: "localhost",
  port: 5432,
  username: "pinpoint",
  password: Redacted.make("pinpoint"),
})

const TestMigratorLive = PgMigrator.layer({
  loader: PgMigrator.fromFileSystem(
    fileURLToPath(new URL("../migrations", import.meta.url))
  ),
  schemaDirectory: "src/migrations",
}).pipe(Layer.provide(TestSqlLive))

const TestMainLive = CommentServiceLive.pipe(
  Layer.provide(CommentRepoLive),
  Layer.provide(TestSqlLive),
)

const TestEnvLive = Layer.mergeAll(TestMainLive, TestMigratorLive).pipe(
  Layer.provide(NodeContext.layer),
)

describe("E2E", () => {
  const app = createApp(TestMainLive)
  let scope: Scope.CloseableScope

  beforeAll(async () => {
    // Build layers (runs migrations + creates connection pool)
    scope = Effect.runSync(Scope.make())
    await Effect.runPromise(
      Layer.buildWithScope(TestEnvLive, scope),
    )
  })

  afterAll(async () => {
    // Close connection pool
    await Effect.runPromise(Scope.close(scope, { _tag: "Success", value: undefined }))
  })

  afterEach(async () => {
    // Truncate between tests
    await Effect.runPromise(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        yield* sql`TRUNCATE TABLE comments`
      }).pipe(Effect.provide(TestSqlLive)),
    )
  })

  it("full comment lifecycle: create, list, filter, delete", async () => {
    // Create first comment
    const createRes1 = await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://a.com",
        content: "Comment A",
        anchor: { selector: "#a", xPercent: 10, yPercent: 20 },
        viewport: { width: 1024 },
      }),
    })
    expect(createRes1.status).toBe(201)
    const comment1 = await createRes1.json()

    // Create second comment on different URL
    const createRes2 = await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://b.com",
        content: "Comment B",
        anchor: { selector: "#b", xPercent: 30, yPercent: 40 },
        viewport: { width: 768 },
      }),
    })
    expect(createRes2.status).toBe(201)

    // List all — should be 2
    const listRes = await app.request("/comments")
    expect(listRes.status).toBe(200)
    const all = await listRes.json()
    expect(all.length).toBe(2)

    // Filter by URL — should be 1
    const filterRes = await app.request("/comments?url=https://a.com")
    expect(filterRes.status).toBe(200)
    const filtered = await filterRes.json()
    expect(filtered.length).toBe(1)
    expect(filtered[0].content).toBe("Comment A")

    // Delete first comment
    const deleteRes = await app.request(`/comments/${comment1.id}`, {
      method: "DELETE",
    })
    expect(deleteRes.status).toBe(204)

    // Verify deleted
    const afterDelete = await app.request("/comments")
    const remaining = await afterDelete.json()
    expect(remaining.length).toBe(1)
    expect(remaining[0].content).toBe("Comment B")

    // Delete non-existent returns 404
    const deleteAgain = await app.request(`/comments/${comment1.id}`, {
      method: "DELETE",
    })
    expect(deleteAgain.status).toBe(404)
  })
})
```

- [ ] **Step 3: Run E2E test**

```bash
cd packages/pin-point-server && npx vitest run src/__tests__/e2e.test.ts
```

Expected: PASS

- [ ] **Step 4: Run all tests together**

```bash
cd packages/pin-point-server && npx vitest run
```

Expected: all tests PASS (schema, service, routes, e2e)

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point-server/src/__tests__/e2e.test.ts
git commit -m "test(server): add e2e tests with real postgres"
```

---

### Task 11: Smoke Test the Dev Server

- [ ] **Step 1: Ensure Postgres is running**

```bash
cd packages/pin-point-server && docker compose up -d
```

- [ ] **Step 2: Start the dev server**

```bash
cd packages/pin-point-server && PG_DATABASE=pinpoint PG_PASSWORD=pinpoint pnpm dev
```

Expected: `Server listening on 0.0.0.0:3000`

- [ ] **Step 3: Test the API manually (in a separate terminal)**

```bash
# Create
curl -s -X POST http://localhost:3000/comments \
  -H "Content-Type: application/json" \
  -d '{"url":"https://test.com","content":"hello","anchor":{"selector":"#x","xPercent":1,"yPercent":2},"viewport":{"width":800}}' | jq .

# List
curl -s http://localhost:3000/comments | jq .

# Delete (use id from create response)
curl -s -X DELETE http://localhost:3000/comments/<id> -w "\n%{http_code}"
```

Expected: 201 with comment JSON, 200 with array, 204 on delete.

- [ ] **Step 4: Stop the dev server (Ctrl+C) and verify clean shutdown**

Expected: process exits cleanly, no error output.

- [ ] **Step 5: Verify build works**

```bash
cd packages/pin-point-server && pnpm build
```

Expected: `dist/` output with no errors.

- [ ] **Step 6: Run lint**

```bash
cd packages/pin-point-server && pnpm lint
```

Expected: no type errors.

- [ ] **Step 7: Commit any fixes needed, then final commit**

```bash
git add -A packages/pin-point-server
git commit -m "chore(server): verify build, lint, smoke test pass"
```

---

### Task 12: Update Dockerfile

**Files:**
- Modify: `packages/pin-point-server/Dockerfile`

- [ ] **Step 1: Update the Dockerfile**

Replace the runtime stage's SQLite-specific lines. The current Dockerfile (line 17-18) has:
```dockerfile
ENV DATABASE_URL=/data/pin-point.db
VOLUME /data
```

Replace with Postgres env vars. Full updated Dockerfile:

```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/pin-point-server/package.json packages/pin-point-server/
RUN pnpm install --frozen-lockfile --filter pin-point-server
COPY packages/pin-point-server packages/pin-point-server
RUN pnpm --filter pin-point-server build

FROM node:20-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=builder /app/packages/pin-point-server/dist ./dist
COPY --from=builder /app/packages/pin-point-server/package.json .
COPY --from=builder /app/pnpm-lock.yaml .
RUN pnpm install --prod
ENV PG_HOST=localhost
ENV PG_PORT=5432
ENV PG_DATABASE=pinpoint
ENV PG_USERNAME=pinpoint
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

Note: `PG_PASSWORD` is intentionally omitted — it should be provided at runtime via secrets/env injection, not baked into the image.

- [ ] **Step 2: Verify build**

```bash
cd packages/pin-point-server && docker build -f Dockerfile ../..
```

Expected: successful image build

- [ ] **Step 3: Commit**

```bash
git add packages/pin-point-server/Dockerfile
git commit -m "chore(server): update dockerfile for postgres env vars"
```
