import { Effect, Redacted } from "effect";
import type { Context as HonoContext } from "hono";
import { AppConfig } from "../config.js";
import type { DatabaseError } from "../errors.js";
import { TokenRepository } from "../repositories/token-repo.js";

export type AuthContext =
	| { readonly role: "anonymous" }
	| { readonly role: "tokenHolder"; readonly tokenId: string }
	| { readonly role: "admin" };

const constantTimeEqual = (a: string, b: string): boolean => {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
};

export type ResolveAuthInput = {
	readonly adminHeader: string | undefined;
	readonly tokenHeader: string | undefined;
	readonly adminSecret: Redacted.Redacted<string>;
};

export const resolveAuth = (
	input: ResolveAuthInput,
): Effect.Effect<AuthContext, DatabaseError, TokenRepository> =>
	Effect.gen(function* () {
		if (input.adminHeader) {
			const secret = Redacted.value(input.adminSecret);
			if (constantTimeEqual(input.adminHeader, secret)) {
				return { role: "admin" } as const;
			}
		}

		if (input.tokenHeader) {
			const repo = yield* TokenRepository;
			const token = yield* repo.findActive(input.tokenHeader);
			if (token) return { role: "tokenHolder", tokenId: token.id } as const;
		}

		return { role: "anonymous" } as const;
	});

export type AuthFailureReason = "unauthorized" | "forbidden";

export const getAuth = (c: HonoContext) =>
	Effect.gen(function* () {
		const config = yield* AppConfig;
		return yield* resolveAuth({
			adminHeader: c.req.header("X-Pin-Admin"),
			tokenHeader: c.req.header("X-Pin-Token"),
			adminSecret: config.adminSecret,
		});
	});

export const requireAuthed = (c: HonoContext) =>
	Effect.gen(function* () {
		const auth = yield* getAuth(c);
		if (auth.role === "anonymous") {
			return { _tag: "fail" as const, reason: "unauthorized" as const };
		}
		return { _tag: "ok" as const, auth };
	});

export const requireAdmin = (c: HonoContext) =>
	Effect.gen(function* () {
		const auth = yield* getAuth(c);
		if (auth.role === "anonymous") {
			return { _tag: "fail" as const, reason: "unauthorized" as const };
		}
		if (auth.role !== "admin") {
			return { _tag: "fail" as const, reason: "forbidden" as const };
		}
		return { _tag: "ok" as const, auth };
	});

export const authFailureResponse = (
	c: HonoContext,
	reason: AuthFailureReason,
) => {
	if (reason === "unauthorized") {
		return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
	}
	return c.json({ error: "Admin required", code: "FORBIDDEN" }, 403);
};
