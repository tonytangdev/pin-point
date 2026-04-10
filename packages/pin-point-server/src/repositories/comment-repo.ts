import { Context, type Effect } from "effect";
import type { DatabaseError } from "../errors.js";
import type { PinComment } from "../models/comment.js";

export class CommentRepository extends Context.Tag("CommentRepository")<
	CommentRepository,
	{
		readonly create: (
			comment: PinComment,
		) => Effect.Effect<PinComment, DatabaseError>;
		readonly findByUrl: (
			url: string,
		) => Effect.Effect<PinComment[], DatabaseError>;
		readonly findAll: () => Effect.Effect<PinComment[], DatabaseError>;
		readonly deleteById: (id: string) => Effect.Effect<boolean, DatabaseError>;
		readonly updateById: (
			id: string,
			content: string,
		) => Effect.Effect<PinComment | null, DatabaseError>;
		readonly deleteOlderThan: (
			days: number,
		) => Effect.Effect<number, DatabaseError>;
	}
>() {}
