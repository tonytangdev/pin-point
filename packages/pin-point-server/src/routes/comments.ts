import { Hono } from "hono"
import { Effect, Layer, Schema } from "effect"
import { CommentService } from "../services/comment-service.js"
import { CreateCommentSchema, UpdateCommentSchema, type PinComment } from "../models/comment.js"

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
        const updated = yield* service.update(id, decoded.right.content)
        return { _tag: "ok" as const, data: updated }
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
    return c.json(result.data, 200)
  })

  return app
}
