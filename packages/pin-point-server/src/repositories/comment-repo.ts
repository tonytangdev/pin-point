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
