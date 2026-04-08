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
  const app = createApp(Layer.orDie(TestMainLive))
  let scope: Scope.CloseableScope

  beforeAll(async () => {
    scope = Effect.runSync(Scope.make())
    await Effect.runPromise(
      Layer.buildWithScope(TestEnvLive, scope),
    )
  })

  afterAll(async () => {
    await Effect.runPromise(
      Scope.close(scope, { _tag: "Success", value: undefined }),
    )
  })

  afterEach(async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        yield* sql`TRUNCATE TABLE comments`
      }).pipe(Effect.provide(TestSqlLive)),
    )
  })

  it("full comment lifecycle: create, list, filter, delete", async () => {
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

    const listRes = await app.request("/comments")
    expect(listRes.status).toBe(200)
    const all = await listRes.json()
    expect(all.length).toBe(2)

    const filterRes = await app.request("/comments?url=https://a.com")
    expect(filterRes.status).toBe(200)
    const filtered = await filterRes.json()
    expect(filtered.length).toBe(1)
    expect(filtered[0].content).toBe("Comment A")

    const deleteRes = await app.request(`/comments/${comment1.id}`, {
      method: "DELETE",
    })
    expect(deleteRes.status).toBe(204)

    const afterDelete = await app.request("/comments")
    const remaining = await afterDelete.json()
    expect(remaining.length).toBe(1)
    expect(remaining[0].content).toBe("Comment B")

    const deleteAgain = await app.request(`/comments/${comment1.id}`, {
      method: "DELETE",
    })
    expect(deleteAgain.status).toBe(404)
  })
})
