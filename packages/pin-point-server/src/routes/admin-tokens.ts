import { Effect, type Layer, Option, Schema } from "effect";
import { Hono } from "hono";
import { AppConfig } from "../config.js";
import { authFailureResponse, requireAdmin } from "../middleware/auth.js";
import { CreateTokenSchema } from "../models/token.js";
import type { TokenRepository } from "../repositories/token-repo.js";
import { TokenService } from "../services/token-service.js";

export const makeAdminTokenRoutes = (
	layer: Layer.Layer<TokenService | TokenRepository>,
) => {
	const app = new Hono();

	const runEffect = <A>(
		effect: Effect.Effect<A, never, TokenService | TokenRepository>,
	) => Effect.runPromise(effect.pipe(Effect.provide(layer)));

	app.post("/admin/tokens", async (c) => {
		const body = await c.req.json().catch(() => ({}));
		const decoded = Schema.decodeUnknownEither(CreateTokenSchema)(body);
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
				const config = yield* AppConfig;
				const fallback = Option.getOrUndefined(config.defaultTokenTtlHours);
				const expiresInHours = decoded.right.expiresInHours ?? fallback;
				const svc = yield* TokenService;
				const token = yield* svc.create({
					label: decoded.right.label,
					expiresInHours,
				});
				return { _tag: "ok" as const, data: token };
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

	app.get("/admin/tokens", async (c) => {
		const result = await runEffect(
			Effect.gen(function* () {
				const guard = yield* requireAdmin(c);
				if (guard._tag === "fail") {
					return { _tag: "authFail" as const, reason: guard.reason };
				}
				const svc = yield* TokenService;
				const tokens = yield* svc.findAll();
				return { _tag: "ok" as const, data: tokens };
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
		return c.json(result.data);
	});

	app.delete("/admin/tokens/:id", async (c) => {
		const id = c.req.param("id");
		const result = await runEffect(
			Effect.gen(function* () {
				const guard = yield* requireAdmin(c);
				if (guard._tag === "fail") {
					return { _tag: "authFail" as const, reason: guard.reason };
				}
				const svc = yield* TokenService;
				yield* svc.revoke(id);
				return { _tag: "ok" as const };
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
		return c.body(null, 204);
	});

	return app;
};
