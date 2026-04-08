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
