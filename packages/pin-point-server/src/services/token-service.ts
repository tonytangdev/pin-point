import { Context, Effect, Layer } from "effect";
import type { DatabaseError } from "../errors.js";
import type { CreateToken, Token } from "../models/token.js";
import { TokenRepository } from "../repositories/token-repo.js";

const generateId = () => {
	const random = crypto.randomUUID().replace(/-/g, "");
	return `ft_${random}`;
};

export class TokenService extends Context.Tag("TokenService")<
	TokenService,
	{
		readonly create: (
			input: CreateToken,
		) => Effect.Effect<Token, DatabaseError>;
		readonly findActive: (
			id: string,
		) => Effect.Effect<Token | null, DatabaseError>;
		readonly findAll: () => Effect.Effect<Token[], DatabaseError>;
		readonly revoke: (id: string) => Effect.Effect<boolean, DatabaseError>;
	}
>() {}

export const TokenServiceLive = Layer.effect(
	TokenService,
	Effect.gen(function* () {
		const repo = yield* TokenRepository;

		return {
			create: (input: CreateToken) =>
				Effect.gen(function* () {
					const now = new Date();
					const expiresAt =
						input.expiresInHours != null
							? new Date(
									now.getTime() + input.expiresInHours * 3600 * 1000,
								).toISOString()
							: null;

					const token: Token = {
						id: generateId(),
						label: input.label ?? null,
						createdAt: now.toISOString(),
						expiresAt,
						revokedAt: null,
					};
					return yield* repo.create(token);
				}),

			findActive: (id: string) => repo.findActive(id),
			findAll: () => repo.findAll(),
			revoke: (id: string) => repo.revoke(id),
		};
	}),
);
