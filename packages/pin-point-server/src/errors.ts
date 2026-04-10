import { Data } from "effect";

export class CommentNotFound extends Data.TaggedError("CommentNotFound")<{
	readonly id: string;
}> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
	readonly cause: unknown;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
	readonly message: string;
}> {}

export class TokenNotFound extends Data.TaggedError("TokenNotFound")<{
	readonly id: string;
}> {}

export class Unauthorized extends Data.TaggedError("Unauthorized")<{
	readonly reason: string;
}> {}

export class Forbidden extends Data.TaggedError("Forbidden")<{
	readonly reason: string;
}> {}
