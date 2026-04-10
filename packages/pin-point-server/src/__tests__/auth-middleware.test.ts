import { it } from "@effect/vitest";
import { Effect, Layer, Redacted } from "effect";
import { describe, expect } from "vitest";
import { resolveAuth } from "../middleware/auth.js";
import { TokenRepository } from "../repositories/token-repo.js";

const tokenRepoStub = (
	token: { id: string; revoked?: boolean; expired?: boolean } | null,
) =>
	Layer.succeed(TokenRepository, {
		create: () => Effect.succeed({} as never),
		findAll: () => Effect.succeed([]),
		revoke: () => Effect.succeed(false),
		findActive: (id: string) => {
			if (!token || token.id !== id || token.revoked || token.expired)
				return Effect.succeed(null);
			return Effect.succeed({
				id,
				label: null,
				createdAt: new Date().toISOString(),
				expiresAt: null,
				revokedAt: null,
			});
		},
	});

describe("resolveAuth", () => {
	const adminSecret = Redacted.make("super-secret");

	it.effect("admin secret valid → role admin", () =>
		Effect.gen(function* () {
			const ctx = yield* resolveAuth({
				adminHeader: "super-secret",
				tokenHeader: undefined,
				adminSecret,
			});
			expect(ctx.role).toBe("admin");
		}).pipe(Effect.provide(tokenRepoStub(null))),
	);

	it.effect("admin secret invalid → role anonymous (when no token)", () =>
		Effect.gen(function* () {
			const ctx = yield* resolveAuth({
				adminHeader: "wrong",
				tokenHeader: undefined,
				adminSecret,
			});
			expect(ctx.role).toBe("anonymous");
		}).pipe(Effect.provide(tokenRepoStub(null))),
	);

	it.effect("valid active token → role tokenHolder", () =>
		Effect.gen(function* () {
			const ctx = yield* resolveAuth({
				adminHeader: undefined,
				tokenHeader: "ft_abc",
				adminSecret,
			});
			expect(ctx.role).toBe("tokenHolder");
			if (ctx.role === "tokenHolder") expect(ctx.tokenId).toBe("ft_abc");
		}).pipe(Effect.provide(tokenRepoStub({ id: "ft_abc" }))),
	);

	it.effect("revoked token → role anonymous", () =>
		Effect.gen(function* () {
			const ctx = yield* resolveAuth({
				adminHeader: undefined,
				tokenHeader: "ft_abc",
				adminSecret,
			});
			expect(ctx.role).toBe("anonymous");
		}).pipe(Effect.provide(tokenRepoStub({ id: "ft_abc", revoked: true }))),
	);

	it.effect("expired token → role anonymous", () =>
		Effect.gen(function* () {
			const ctx = yield* resolveAuth({
				adminHeader: undefined,
				tokenHeader: "ft_abc",
				adminSecret,
			});
			expect(ctx.role).toBe("anonymous");
		}).pipe(Effect.provide(tokenRepoStub({ id: "ft_abc", expired: true }))),
	);

	it.effect("no headers → role anonymous", () =>
		Effect.gen(function* () {
			const ctx = yield* resolveAuth({
				adminHeader: undefined,
				tokenHeader: undefined,
				adminSecret,
			});
			expect(ctx.role).toBe("anonymous");
		}).pipe(Effect.provide(tokenRepoStub(null))),
	);
});
