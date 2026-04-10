import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { assert, describe } from "vitest";
import type { Token } from "../models/token.js";
import { TokenRepository } from "../repositories/token-repo.js";
import { TokenService, TokenServiceLive } from "../services/token-service.js";

const makeMockRepo = () => {
	const stored = new Map<string, Token>();
	return Layer.succeed(TokenRepository, {
		create: (token: Token) => {
			stored.set(token.id, token);
			return Effect.succeed(token);
		},
		findActive: (id: string) => {
			const t = stored.get(id);
			if (!t || t.revokedAt) return Effect.succeed(null);
			if (t.expiresAt && new Date(t.expiresAt) < new Date())
				return Effect.succeed(null);
			return Effect.succeed(t);
		},
		findAll: () => Effect.succeed(Array.from(stored.values())),
		revoke: (id: string) => {
			const t = stored.get(id);
			if (!t) return Effect.succeed(false);
			stored.set(id, { ...t, revokedAt: new Date().toISOString() });
			return Effect.succeed(true);
		},
	});
};

describe("TokenService", () => {
	it.effect("create generates id with ft_ prefix", () =>
		Effect.gen(function* () {
			const service = yield* TokenService;
			const result = yield* service.create({ label: "test" });
			assert(result.id.startsWith("ft_"));
			assert(result.label === "test");
			assert(result.revokedAt === null);
		}).pipe(
			Effect.provide(TokenServiceLive.pipe(Layer.provide(makeMockRepo()))),
		),
	);

	it.effect("create with expiresInHours sets expiresAt to ~now+hours", () =>
		Effect.gen(function* () {
			const service = yield* TokenService;
			const before = Date.now();
			const result = yield* service.create({ expiresInHours: 24 });
			const after = Date.now();
			assert(result.expiresAt !== null);
			const expiresMs = new Date(result.expiresAt as string).getTime();
			const expectedLow = before + 24 * 3600 * 1000;
			const expectedHigh = after + 24 * 3600 * 1000;
			assert(expiresMs >= expectedLow);
			assert(expiresMs <= expectedHigh);
		}).pipe(
			Effect.provide(TokenServiceLive.pipe(Layer.provide(makeMockRepo()))),
		),
	);

	it.effect("create without expiresInHours leaves expiresAt null", () =>
		Effect.gen(function* () {
			const service = yield* TokenService;
			const result = yield* service.create({ label: "no-expiry" });
			assert(result.expiresAt === null);
		}).pipe(
			Effect.provide(TokenServiceLive.pipe(Layer.provide(makeMockRepo()))),
		),
	);

	it.effect("revoke marks the token revoked", () =>
		Effect.gen(function* () {
			const service = yield* TokenService;
			const created = yield* service.create({ label: "to-revoke" });
			const result = yield* service.revoke(created.id);
			assert(result === true);
			const found = yield* service.findActive(created.id);
			assert(found === null);
		}).pipe(
			Effect.provide(TokenServiceLive.pipe(Layer.provide(makeMockRepo()))),
		),
	);
});
