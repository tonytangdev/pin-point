import { SqlClient } from "@effect/sql";
import { Effect, Layer, Schema } from "effect";
import { DatabaseError } from "../errors.js";
import type { Token } from "../models/token.js";
import { TokenRepository } from "./token-repo.js";

const NullableDateToString = Schema.transform(
	Schema.Unknown,
	Schema.NullOr(Schema.String),
	{
		decode: (v) =>
			v instanceof Date ? v.toISOString() : v == null ? null : String(v),
		encode: (s) => s,
	},
);

const DateToStringRequired = Schema.transform(Schema.Unknown, Schema.String, {
	decode: (v) => (v instanceof Date ? v.toISOString() : String(v)),
	encode: (s) => s,
});

const TokenRowSchema = Schema.Struct({
	id: Schema.String,
	label: Schema.NullOr(Schema.String),
	createdAt: DateToStringRequired.pipe(
		Schema.propertySignature,
		Schema.fromKey("created_at"),
	),
	expiresAt: NullableDateToString.pipe(
		Schema.propertySignature,
		Schema.fromKey("expires_at"),
	),
	revokedAt: NullableDateToString.pipe(
		Schema.propertySignature,
		Schema.fromKey("revoked_at"),
	),
});

const decodeRow = (row: unknown) =>
	Schema.decodeUnknownSync(TokenRowSchema)(row);

export const TokenRepoLive = Layer.effect(
	TokenRepository,
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		return {
			create: (token: Token) =>
				Effect.gen(function* () {
					yield* sql`
            INSERT INTO tokens (id, label, created_at, expires_at, revoked_at)
            VALUES (${token.id}, ${token.label}, ${token.createdAt}, ${token.expiresAt}, ${token.revokedAt})
          `;
					return token;
				}).pipe(
					Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e }))),
				),

			findActive: (id: string) =>
				Effect.gen(function* () {
					const rows = yield* sql`
            SELECT * FROM tokens
            WHERE id = ${id}
              AND revoked_at IS NULL
              AND (expires_at IS NULL OR expires_at > NOW())
          `;
					return rows.length > 0 ? decodeRow(rows[0]) : null;
				}).pipe(
					Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e }))),
				),

			findAll: () =>
				sql`SELECT * FROM tokens ORDER BY created_at DESC`.pipe(
					Effect.map((rows) => rows.map(decodeRow)),
					Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e }))),
				),

			revoke: (id: string) =>
				Effect.gen(function* () {
					const result = yield* sql`
            UPDATE tokens SET revoked_at = NOW()
            WHERE id = ${id} AND revoked_at IS NULL
            RETURNING id
          `;
					return result.length > 0;
				}).pipe(
					Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e }))),
				),
		};
	}),
);
