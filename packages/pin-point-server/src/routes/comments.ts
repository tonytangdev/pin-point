import { Effect, type Layer, Schema } from "effect";
import { Hono } from "hono";
import {
	authFailureResponse,
	requireAdmin,
	requireAuthed,
} from "../middleware/auth.js";
import {
	CreateCommentSchema,
	type PinComment,
	UpdateCommentSchema,
} from "../models/comment.js";
import type { TokenRepository } from "../repositories/token-repo.js";
import { CommentService } from "../services/comment-service.js";

export const makeCommentRoutes = (
	layer: Layer.Layer<CommentService | TokenRepository>,
) => {
	const app = new Hono();

	const runEffect = <A>(
		effect: Effect.Effect<A, never, CommentService | TokenRepository>,
	) => Effect.runPromise(effect.pipe(Effect.provide(layer)));

	app.post("/comments", async (c) => {
		const body = await c.req.json();
		const decoded = Schema.decodeUnknownEither(CreateCommentSchema)(body);
		if (decoded._tag === "Left") {
			return c.json(
				{ error: "Invalid request body", code: "BAD_REQUEST" },
				400,
			);
		}

		const result = await runEffect(
			Effect.gen(function* () {
				const guard = yield* requireAuthed(c);
				if (guard._tag === "fail") {
					return { _tag: "authFail" as const, reason: guard.reason };
				}
				const tokenId =
					guard.auth.role === "tokenHolder" ? guard.auth.tokenId : null;
				const service = yield* CommentService;
				const created = yield* service.create(decoded.right, { tokenId });
				return { _tag: "ok" as const, data: created };
			}).pipe(
				Effect.catchTag("DatabaseError", () =>
					Effect.succeed({ _tag: "dbError" as const }),
				),
				Effect.catchAll(() => Effect.succeed({ _tag: "dbError" as const })),
			),
		);

		if (result._tag === "authFail")
			return authFailureResponse(c, result.reason);
		if (result._tag === "dbError")
			return c.json({ error: "Internal server error", code: "DB_ERROR" }, 500);
		return c.json(result.data, 201);
	});

	app.get("/comments", async (c) => {
		const url = c.req.query("url");
		const result = await runEffect(
			Effect.gen(function* () {
				const service = yield* CommentService;
				return url ? yield* service.findByUrl(url) : yield* service.findAll();
			}).pipe(
				Effect.catchTag("DatabaseError", () =>
					Effect.succeed([] as PinComment[]),
				),
			),
		);
		return c.json(result);
	});

	app.delete("/comments/:id", async (c) => {
		const id = c.req.param("id");
		const result = await runEffect(
			Effect.gen(function* () {
				const guard = yield* requireAdmin(c);
				if (guard._tag === "fail") {
					return { _tag: "authFail" as const, reason: guard.reason };
				}
				const service = yield* CommentService;
				yield* service.delete(id);
				return { _tag: "ok" as const };
			}).pipe(
				Effect.catchTag("CommentNotFound", () =>
					Effect.succeed({ _tag: "notFound" as const }),
				),
				Effect.catchTag("DatabaseError", () =>
					Effect.succeed({ _tag: "dbError" as const }),
				),
				Effect.catchAll(() => Effect.succeed({ _tag: "dbError" as const })),
			),
		);
		if (result._tag === "authFail")
			return authFailureResponse(c, result.reason);
		if (result._tag === "notFound")
			return c.json({ error: "Not found", code: "NOT_FOUND" }, 404);
		if (result._tag === "dbError")
			return c.json({ error: "Internal server error", code: "DB_ERROR" }, 500);
		return c.body(null, 204);
	});

	app.patch("/comments/:id", async (c) => {
		const id = c.req.param("id");
		const body = await c.req.json();
		const decoded = Schema.decodeUnknownEither(UpdateCommentSchema)(body);
		if (decoded._tag === "Left") {
			return c.json(
				{ error: "Invalid request body", code: "BAD_REQUEST" },
				400,
			);
		}

		const result = await runEffect(
			Effect.gen(function* () {
				const guard = yield* requireAdmin(c);
				if (guard._tag === "fail") {
					return { _tag: "authFail" as const, reason: guard.reason };
				}
				const service = yield* CommentService;
				const updated = yield* service.update(id, decoded.right.content);
				return { _tag: "ok" as const, data: updated };
			}).pipe(
				Effect.catchTag("CommentNotFound", () =>
					Effect.succeed({ _tag: "notFound" as const }),
				),
				Effect.catchTag("DatabaseError", () =>
					Effect.succeed({ _tag: "dbError" as const }),
				),
				Effect.catchAll(() => Effect.succeed({ _tag: "dbError" as const })),
			),
		);
		if (result._tag === "authFail")
			return authFailureResponse(c, result.reason);
		if (result._tag === "notFound")
			return c.json({ error: "Not found", code: "NOT_FOUND" }, 404);
		if (result._tag === "dbError")
			return c.json({ error: "Internal server error", code: "DB_ERROR" }, 500);
		return c.json(result.data, 200);
	});

	return app;
};
