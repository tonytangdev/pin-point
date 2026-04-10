import { Schema } from "effect";

export const TokenSchema = Schema.Struct({
	id: Schema.String,
	label: Schema.NullOr(Schema.String),
	createdAt: Schema.String,
	expiresAt: Schema.NullOr(Schema.String),
	revokedAt: Schema.NullOr(Schema.String),
});

export type Token = typeof TokenSchema.Type;

export const CreateTokenSchema = Schema.Struct({
	label: Schema.optional(Schema.String),
	expiresInHours: Schema.optional(Schema.Number),
});

export type CreateToken = typeof CreateTokenSchema.Type;
