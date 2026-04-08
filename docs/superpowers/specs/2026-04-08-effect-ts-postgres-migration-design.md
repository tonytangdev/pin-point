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
│   │   └── comment.ts           # PinComment + CreateComment schemas (effect/Schema)
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

// Server config
const AppConfig = Config.all({
  port: Config.number("PORT").pipe(Config.withDefault(3000)),
  host: Config.string("HOST").pipe(Config.withDefault("0.0.0.0")),
  corsOrigin: Config.string("CORS_ORIGIN").pipe(Config.withDefault("*")),
})

// Database config is handled by PgClient.layerConfig (see Entry Point section)
// using individual PG_DATABASE, PG_HOST, PG_PORT, PG_USERNAME, PG_PASSWORD env vars
```

## Schema & Models

Replace Zod with Effect's built-in `Schema` module (included in the `effect` package since v3):

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
          const result = yield* sql`DELETE FROM comments WHERE id = ${id} RETURNING id`
          return result.length > 0
        }).pipe(Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e })))),
    }
  }),
)
```

`anchor` and `viewport` are `JSONB` columns — Postgres handles serialization natively, no manual `JSON.stringify`/`JSON.parse`.

`rowToComment` maps DB column names to model fields:

```typescript
const rowToComment = (row: any): PinComment => ({
  id: row.id,
  url: row.url,
  content: row.content,
  anchor: row.anchor,       // JSONB — already parsed by pg driver
  viewport: row.viewport,   // JSONB — already parsed by pg driver
  createdAt: row.created_at, // snake_case → camelCase
})
```

## Service Layer

```typescript
class CommentService extends Context.Tag("CommentService")<
  CommentService,
  {
    readonly create: (input: CreateComment) => Effect.Effect<PinComment, DatabaseError>
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
import { Schema } from "effect"

const makeCommentRoutes = (layer: Layer.Layer<CommentService>) => {
  const app = new Hono()

  const runEffect = <A>(effect: Effect.Effect<A, never, CommentService>) =>
    Effect.runPromise(effect.pipe(Effect.provide(layer)))

  app.post("/comments", async (c) => {
    const body = await c.req.json()

    // Validate request body with @effect/schema
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
          Effect.succeed({ _error: true as const, status: 500 })
        )
      )
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
        )
      )
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
        )
      )
    )
    if (result._tag === "notFound") return c.json({ error: "Not found" }, 404)
    if (result._tag === "dbError") return c.json({ error: "Internal server error" }, 500)
    return c.body(null, 204)
  })

  return app
}
```

- `Schema.decodeUnknownEither` validates request body before entering Effect pipeline
- Error handlers return discriminated objects (not Response) to avoid `typeof` issues
- DELETE captures result to decide between 204 and 404
- `@hono/zod-validator` removed — validation via `effect/Schema`

## Migration

Uses `PgMigrator` from `@effect/sql-pg` — the canonical migration system for Effect SQL.

Migration files use `Effect.flatMap` format (required by `PgMigrator.fromFileSystem`):

```typescript
// src/migrations/0001_create_comments.ts
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

Migrator layer setup:

```typescript
import { PgMigrator } from "@effect/sql-pg"
import { fileURLToPath } from "node:url"

const MigratorLive = PgMigrator.layer({
  loader: PgMigrator.fromFileSystem(
    fileURLToPath(new URL("migrations", import.meta.url))
  ),
  schemaDirectory: "src/migrations",
}).pipe(Layer.provide(SqlLive))
```

- `JSONB` for anchor/viewport (native JSON in Postgres)
- `TIMESTAMPTZ` for created_at
- Migrations run at startup via `PgMigrator` layer before server listens
- Migration state tracked automatically by `PgMigrator`

## Entry Point & Layer Composition

```typescript
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { PgClient, PgMigrator } from "@effect/sql-pg"
import { fileURLToPath } from "node:url"

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
  const app = makeApp(MainLive)
  const config = yield* Effect.config(AppConfig)
  const server = NodeServer.serve({ fetch: app.fetch, port: config.port, hostname: config.host })

  yield* Effect.log(`Server listening on ${config.host}:${config.port}`)
  yield* Effect.addFinalizer(() => Effect.sync(() => server.close()))
  yield* Effect.never
})

program.pipe(
  Effect.scoped,
  Effect.provide(Layer.mergeAll(MainLive, MigratorLive)),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain,
)
```

- `PgClient.layerConfig` accepts individual `Config` fields for type-safe env loading
- `Config.redacted` for password — prevents accidental logging
- `NodeRuntime.runMain` replaces `Effect.runFork` — handles SIGTERM/SIGINT signals and triggers finalizers
- `MigratorLive` runs migrations automatically when the layer is provided (before `program` body executes)

Layer dependency chain: `PgClient.layerConfig → CommentRepoLive → CommentServiceLive`

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
const TestSqlLive = PgClient.layer({
  database: "pinpoint_test",
  host: "localhost",
  port: 5432,
  username: "pinpoint",
  password: Redacted.make("pinpoint"),  // import { Redacted } from "effect"
})

const E2ELive = CommentServiceLive.pipe(
  Layer.provide(CommentRepoLive),
  Layer.provide(TestSqlLive),
)
```

- Unit tests: stub repos via `Layer.succeed`, fast, no Docker
- E2E tests: real Postgres, full HTTP lifecycle through Hono
- In-memory repository class removed — replaced by stub layers

## Dependency Changes

### Add
- `effect` (includes Schema module since v3)
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
