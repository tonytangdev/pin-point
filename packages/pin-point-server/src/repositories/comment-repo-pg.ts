import { Effect, Layer, Schema } from "effect"
import { SqlClient } from "@effect/sql"
import { CommentRepository } from "./comment-repo.js"
import { AnchorSchema, ViewportSchema, type PinComment } from "../models/comment.js"
import { DatabaseError } from "../errors.js"

const DateToString = Schema.transform(Schema.Unknown, Schema.String, {
  decode: (v) => (v instanceof Date ? v.toISOString() : String(v)),
  encode: (s) => s,
})

const PinCommentRowSchema = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
  content: Schema.String,
  anchor: AnchorSchema,
  viewport: ViewportSchema,
  createdAt: DateToString.pipe(Schema.propertySignature, Schema.fromKey("created_at")),
})

const decodeRow = (row: unknown) => Schema.decodeUnknownSync(PinCommentRowSchema)(row)

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
