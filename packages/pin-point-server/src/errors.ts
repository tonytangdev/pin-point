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
