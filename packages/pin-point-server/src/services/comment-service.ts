import { Context, Effect, Layer } from "effect";
import { CommentNotFound, type DatabaseError } from "../errors.js";
import type { CreateComment, PinComment } from "../models/comment.js";
import { CommentRepository } from "../repositories/comment-repo.js";

export class CommentService extends Context.Tag("CommentService")<
	CommentService,
	{
		readonly create: (
			input: CreateComment,
			meta: { tokenId: string | null },
		) => Effect.Effect<PinComment, DatabaseError>;
		readonly findAll: () => Effect.Effect<PinComment[], DatabaseError>;
		readonly findByUrl: (
			url: string,
		) => Effect.Effect<PinComment[], DatabaseError>;
		readonly delete: (
			id: string,
		) => Effect.Effect<void, CommentNotFound | DatabaseError>;
		readonly update: (
			id: string,
			content: string,
		) => Effect.Effect<PinComment, CommentNotFound | DatabaseError>;
	}
>() {}

export const CommentServiceLive = Layer.effect(
	CommentService,
	Effect.gen(function* () {
		const repo = yield* CommentRepository;

		return {
			create: (input: CreateComment, meta: { tokenId: string | null }) =>
				Effect.gen(function* () {
					const comment: PinComment = {
						id: crypto.randomUUID(),
						createdAt: new Date().toISOString(),
						tokenId: meta.tokenId,
						authorName: null,
						authorId: null,
						...input,
					};
					return yield* repo.create(comment);
				}),

			findAll: () => repo.findAll(),

			findByUrl: (url: string) => repo.findByUrl(url),

			delete: (id: string) =>
				Effect.gen(function* () {
					const deleted = yield* repo.deleteById(id);
					if (!deleted) yield* Effect.fail(new CommentNotFound({ id }));
				}),

			update: (id: string, content: string) =>
				Effect.gen(function* () {
					const updated = yield* repo.updateById(id, content);
					if (!updated) return yield* Effect.fail(new CommentNotFound({ id }));
					return updated;
				}),
		};
	}),
);
