import { Context, type Effect } from "effect";
import type { DatabaseError } from "../errors.js";
import type { Token } from "../models/token.js";

export class TokenRepository extends Context.Tag("TokenRepository")<
	TokenRepository,
	{
		readonly create: (token: Token) => Effect.Effect<Token, DatabaseError>;
		readonly findActive: (
			id: string,
		) => Effect.Effect<Token | null, DatabaseError>;
		readonly findAll: () => Effect.Effect<Token[], DatabaseError>;
		readonly revoke: (id: string) => Effect.Effect<boolean, DatabaseError>;
	}
>() {}
