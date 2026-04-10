import { Effect, Redacted } from "effect";
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
