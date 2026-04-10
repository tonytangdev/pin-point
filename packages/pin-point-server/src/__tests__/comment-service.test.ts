import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { assert, describe } from "vitest";
import type { CommentNotFound } from "../errors.js";
import type { PinComment } from "../models/comment.js";
import { CommentRepository } from "../repositories/comment-repo.js";
import {
	CommentService,
	CommentServiceLive,
} from "../services/comment-service.js";

const testComment: PinComment = {
	id: "test-id",
	url: "https://example.com",
	content: "Hello",
	anchor: { selector: "#main", xPercent: 50, yPercent: 25 },
	viewport: { width: 1024 },
	createdAt: "2026-01-01T00:00:00.000Z",
	tokenId: null,
	authorName: null,
	authorId: null,
};

const CommentRepoTest = Layer.succeed(CommentRepository, {
	create: (comment) => Effect.succeed(comment),
	findByUrl: (url) =>
		Effect.succeed(url === testComment.url ? [testComment] : []),
	findAll: () => Effect.succeed([testComment]),
	deleteById: (id) => Effect.succeed(id === "test-id"),
	updateById: (id, content) =>
		Effect.succeed(id === "test-id" ? { ...testComment, content } : null),
});

const TestLive = CommentServiceLive.pipe(Layer.provide(CommentRepoTest));

describe("CommentService", () => {
	it.effect("create returns a comment with generated id and createdAt", () =>
		Effect.gen(function* () {
			const service = yield* CommentService;
			const result = yield* service.create(
				{
					url: "https://example.com",
					content: "Hello",
					anchor: { selector: "#main", xPercent: 50, yPercent: 25 },
					viewport: { width: 1024 },
				},
				{ tokenId: null },
			);
			assert(result.id !== undefined);
			assert(result.createdAt !== undefined);
			assert(result.url === "https://example.com");
			assert(result.tokenId === null);
		}).pipe(Effect.provide(TestLive)),
	);

	it.effect("create stores tokenId from meta", () =>
		Effect.gen(function* () {
			const service = yield* CommentService;
			const result = yield* service.create(
				{
					url: "https://example.com",
					content: "Hello",
					anchor: { selector: "#main", xPercent: 50, yPercent: 25 },
					viewport: { width: 1024 },
				},
				{ tokenId: "ft_test" },
			);
			assert(result.tokenId === "ft_test");
		}).pipe(Effect.provide(TestLive)),
	);

	it.effect("findAll returns comments", () =>
		Effect.gen(function* () {
			const service = yield* CommentService;
			const result = yield* service.findAll();
			assert(result.length === 1);
			assert(result[0].id === "test-id");
		}).pipe(Effect.provide(TestLive)),
	);

	it.effect("findByUrl returns filtered comments", () =>
		Effect.gen(function* () {
			const service = yield* CommentService;
			const found = yield* service.findByUrl("https://example.com");
			assert(found.length === 1);
			const notFound = yield* service.findByUrl("https://other.com");
			assert(notFound.length === 0);
		}).pipe(Effect.provide(TestLive)),
	);

	it.effect("delete succeeds for existing comment", () =>
		Effect.gen(function* () {
			const service = yield* CommentService;
			yield* service.delete("test-id");
		}).pipe(Effect.provide(TestLive)),
	);

	it.effect("delete fails with CommentNotFound for unknown id", () =>
		Effect.gen(function* () {
			const service = yield* CommentService;
			const result = yield* service.delete("unknown").pipe(Effect.flip);
			assert(result._tag === "CommentNotFound");
			assert((result as CommentNotFound).id === "unknown");
		}).pipe(Effect.provide(TestLive)),
	);

	it.effect("update returns updated comment", () =>
		Effect.gen(function* () {
			const service = yield* CommentService;
			const result = yield* service.update("test-id", "New content");
			assert(result.content === "New content");
			assert(result.id === "test-id");
		}).pipe(Effect.provide(TestLive)),
	);

	it.effect("update fails with CommentNotFound for unknown id", () =>
		Effect.gen(function* () {
			const service = yield* CommentService;
			const result = yield* service
				.update("unknown", "New content")
				.pipe(Effect.flip);
			assert(result._tag === "CommentNotFound");
			assert((result as CommentNotFound).id === "unknown");
		}).pipe(Effect.provide(TestLive)),
	);
});
