# Effect TS + PostgreSQL Migration Design

## Overview

Rewrite `pin-point-server` (~600 LOC) from raw async/await + SQLite to Effect TS + PostgreSQL. Full rewrite (Approach A) — codebase is small enough that incremental migration adds unnecessary glue code.

## Goals

- Typed errors via `Data.TaggedError` in the Effect error channel
- DI via Effect's `Context.Tag` / `Layer` system
- Composable pipelines, retries, concurrency via Effect runtime
- PostgreSQL via `@effect/sql-pg`
- Learn Effect using this project as a vehicle

## File Structure

```
pin-point-server/
├── src/
│   ├── errors.ts                # Tagged error classes
│   ├── config.ts                # AppConfig via Effect.Config
│   ├── models/
│   │   └── comment.ts           # PinComment + CreateComment schemas (@effect/schema)
│   ├── repositories/
│   │   ├── comment-repo.ts      # CommentRepository service (Context.Tag)
│   │   └── comment-repo-pg.ts   # Postgres implementation (Layer)
│   ├── services/
│   │   └── comment-service.ts   # CommentService (Layer depending on CommentRepository)
│   ├── routes/
│   │   └── comments.ts          # Hono routes bridging to Effect
│   ├── migrations/
│   │   └── 0001_create_comments.ts
│   ├── app.ts                   # Hono app factory, CORS, error handler
│   └── index.ts                 # Entry point: layer composition, server start
├── src/__tests__/
│   ├── comment-service.test.ts  # Unit tests with stub layers
│   ├── comment-routes.test.ts   # Route tests with stub layers
│   └── e2e.test.ts              # E2E with real Postgres
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

## Error Model

```typescript
import { Data } from "effect"

class CommentNotFound extends Data.TaggedError("CommentNotFound")<{
  readonly id: string
}> {}

class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly cause: unknown
}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string
}> {}
```

Error-to-HTTP mapping:
- `CommentNotFound` → 404
- `ValidationError` → 400
- `DatabaseError` → 500

## Config

```typescript
import { Config } from "effect"

const AppConfig = Config.all({
  port: Config.number("PORT").pipe(Config.withDefault(3000)),
  host: Config.string("HOST").pipe(Config.withDefault("0.0.0.0")),
  databaseUrl: Config.string("DATABASE_URL"),  // required, no default
  corsOrigin: Config.string("CORS_ORIGIN").pipe(Config.withDefault("*")),
})
```

## Schema & Models

Replace Zod with `@effect/schema`:

```typescript
import { Schema } from "effect"

const AnchorSchema = Schema.Struct({
  selector: Schema.String,
  xPercent: Schema.Number,
  yPercent: Schema.Number,
})

const ViewportSchema = Schema.Struct({
  width: Schema.Number,
})

const PinCommentSchema = Schema.Struct({
  id: Schema.optionalWith(Schema.String, { default: () => crypto.randomUUID() }),
  url: Schema.String,
  content: Schema.String,
  anchor: AnchorSchema,
  viewport: ViewportSchema,
  createdAt: Schema.optionalWith(Schema.String, { default: () => new Date().toISOString() }),
})

type PinComment = typeof PinCommentSchema.Type

// Request body — id and createdAt are auto-generated
const CreateCommentSchema = Schema.Struct({
  url: Schema.String,
  content: Schema.String,
  anchor: AnchorSchema,
  viewport: ViewportSchema,
})

type CreateComment = typeof CreateCommentSchema.Type
```

## Repository Layer

```typescript
import { Context, Effect, Layer } from "effect"
import { SqlClient } from "@effect/sql"

class CommentRepository extends Context.Tag("CommentRepository")<
  CommentRepository,
  {
    readonly create: (comment: PinComment) => Effect.Effect<PinComment, DatabaseError>
    readonly findByUrl: (url: string) => Effect.Effect<PinComment[], DatabaseError>
    readonly findAll: () => Effect.Effect<PinComment[], DatabaseError>
    readonly deleteById: (id: string) => Effect.Effect<boolean, DatabaseError>
  }
>() {}

const CommentRepoLive = Layer.effect(
  CommentRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    return {
      create: (comment) =>
        Effect.gen(function* () {
          yield* sql`
            INSERT INTO comments (id, url, content, anchor, viewport, created_at)
            VALUES (${comment.id}, ${comment.url}, ${comment.content},
                    ${comment.anchor}, ${comment.viewport}, ${comment.createdAt})
          `
          return comment
        }).pipe(Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e })))),

      findByUrl: (url) =>
        sql`SELECT * FROM comments WHERE url = ${url}`
          .pipe(
            Effect.map((rows) => rows.map(rowToComment)),
            Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e }))),
          ),

      findAll: () =>
        sql`SELECT * FROM comments`
          .pipe(
            Effect.map((rows) => rows.map(rowToComment)),
            Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e }))),
          ),

      deleteById: (id) =>
        Effect.gen(function* () {
          const result = yield* sql`DELETE FROM comments WHERE id = ${id}`
          return result.length > 0
        }).pipe(Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e })))),
    }
  }),
)
```

`anchor` and `viewport` are `JSONB` columns — Postgres handles serialization natively, no manual `JSON.stringify`/`JSON.parse`.

## Service Layer

```typescript
class CommentService extends Context.Tag("CommentService")<
  CommentService,
  {
    readonly create: (input: CreateComment) => Effect.Effect<PinComment, DatabaseError | ValidationError>
    readonly findAll: () => Effect.Effect<PinComment[], DatabaseError>
    readonly findByUrl: (url: string) => Effect.Effect<PinComment[], DatabaseError>
    readonly delete: (id: string) => Effect.Effect<void, CommentNotFound | DatabaseError>
  }
>() {}

const CommentServiceLive = Layer.effect(
  CommentService,
  Effect.gen(function* () {
    const repo = yield* CommentRepository

    return {
      create: (input) =>
        Effect.gen(function* () {
          const comment: PinComment = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            ...input,
          }
          return yield* repo.create(comment)
        }),

      findAll: () => repo.findAll(),
      findByUrl: (url) => repo.findByUrl(url),

      delete: (id) =>
        Effect.gen(function* () {
          const deleted = yield* repo.deleteById(id)
          if (!deleted) yield* Effect.fail(new CommentNotFound({ id }))
        }),
    }
  }),
)
```

- Service owns ID/timestamp generation
- `delete` translates `false` → `CommentNotFound`

## Hono Routes (Bridging)

```typescript
const makeCommentRoutes = (layer: Layer.Layer<CommentService>) => {
  const app = new Hono()

  const runEffect = <A>(effect: Effect.Effect<A, never, CommentService>) =>
    Effect.runPromise(effect.pipe(Effect.provide(layer)))

  app.post("/comments", async (c) => {
    const body = await c.req.json()
    const result = await runEffect(
      Effect.gen(function* () {
        const service = yield* CommentService
        return yield* service.create(body)
      }).pipe(
        Effect.catchTag("ValidationError", (e) =>
          Effect.succeed(c.json({ error: e.message }, 400))
        ),
        Effect.catchTag("DatabaseError", () =>
          Effect.succeed(c.json({ error: "Internal server error" }, 500))
        )
      )
    )
    return typeof result === "Response" ? result : c.json(result, 201)
  })

  app.get("/comments", async (c) => {
    const url = c.req.query("url")
    const result = await runEffect(
      Effect.gen(function* () {
        const service = yield* CommentService
        return url ? yield* service.findByUrl(url) : yield* service.findAll()
      })
    )
    return c.json(result)
  })

  app.delete("/comments/:id", async (c) => {
    const id = c.req.param("id")
    await runEffect(
      Effect.gen(function* () {
        const service = yield* CommentService
        yield* service.delete(id)
      }).pipe(
        Effect.catchTag("CommentNotFound", () =>
          Effect.succeed(c.json({ error: "Not found" }, 404))
        )
      )
    )
    return c.body(null, 204)
  })

  return app
}
```

- `Effect.catchTag` maps typed errors → HTTP status codes
- `@hono/zod-validator` removed — validation done via `@effect/schema` in the service

## Migration

```typescript
// src/migrations/0001_create_comments.ts
import { SqlClient } from "@effect/sql"
import { Effect } from "effect"

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      content TEXT NOT NULL,
      anchor JSONB NOT NULL,
      viewport JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `
  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_comments_url ON comments(url)
  `
})
```

- `JSONB` for anchor/viewport (native JSON in Postgres)
- `TIMESTAMPTZ` for created_at
- Migrations run at startup before server listens

## Entry Point & Layer Composition

```typescript
const MainLive = CommentServiceLive.pipe(
  Layer.provide(CommentRepoLive),
  Layer.provide(PgClient.layer({
    url: Config.string("DATABASE_URL"),
  })),
)

const program = Effect.gen(function* () {
  yield* runMigrations

  const app = makeApp(MainLive)
  const config = yield* Effect.config(AppConfig)
  const server = NodeServer.serve({ fetch: app.fetch, port: config.port, hostname: config.host })

  yield* Effect.log(`Server listening on ${config.host}:${config.port}`)
  yield* Effect.addFinalizer(() => Effect.sync(() => server.close()))
  yield* Effect.never
})

program.pipe(
  Effect.scoped,
  Effect.provide(MainLive),
  Effect.runFork,
)
```

Layer dependency chain: `PgClient.layer → CommentRepoLive → CommentServiceLive`

## Docker Compose

```yaml
services:
  postgres:
    image: postgres:17
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

## Testing

### Unit Tests (stub layers, no DB)

```typescript
import { it, describe } from "@effect/vitest"

const CommentRepoTest = Layer.succeed(CommentRepository, {
  create: (comment) => Effect.succeed(comment),
  findByUrl: (_url) => Effect.succeed([]),
  findAll: () => Effect.succeed([]),
  deleteById: (id) => Effect.succeed(id === "exists"),
})

const TestLive = CommentServiceLive.pipe(
  Layer.provide(CommentRepoTest),
)

describe("CommentService", () => {
  it.effect("delete fails with CommentNotFound for unknown id", () =>
    Effect.gen(function* () {
      const service = yield* CommentService
      const result = yield* service.delete("unknown").pipe(Effect.flip)
      assert(result._tag === "CommentNotFound")
    }).pipe(Effect.provide(TestLive))
  )
})
```

### E2E Tests (real Postgres via Docker)

```typescript
const E2ELive = CommentServiceLive.pipe(
  Layer.provide(CommentRepoLive),
  Layer.provide(PgClient.layer({
    url: Config.succeed("postgresql://pinpoint:pinpoint@localhost:5432/pinpoint_test"),
  })),
)
```

- Unit tests: stub repos via `Layer.succeed`, fast, no Docker
- E2E tests: real Postgres, full HTTP lifecycle through Hono
- In-memory repository class removed — replaced by stub layers

## Dependency Changes

### Add
- `effect`
- `@effect/schema`
- `@effect/sql`
- `@effect/sql-pg`
- `@effect/vitest`
- `@effect/platform`
- `@effect/platform-node`

### Remove
- `better-sqlite3` + `@types/better-sqlite3`
- `zod`
- `@hono/zod-validator`

### Keep
- `hono` + `@hono/node-server`
- `vitest`
- `typescript`, `tsup`, `tsx`

## API Contract (Unchanged)

| Method | Endpoint | Status Codes |
|--------|----------|-------------|
| POST | /comments | 201, 400, 500 |
| GET | /comments(?url=) | 200, 500 |
| DELETE | /comments/:id | 204, 404, 500 |

The REST API surface remains identical — this is a backend-internal migration only.
