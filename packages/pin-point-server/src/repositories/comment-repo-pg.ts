import { SqlClient } from "@effect/sql";
import { Effect, Layer, Schema } from "effect";
import { DatabaseError } from "../errors.js";
import {
	AnchorSchema,
	type PinComment,
	ViewportSchema,
} from "../models/comment.js";
import { CommentRepository } from "./comment-repo.js";

const DateToString = Schema.transform(Schema.Unknown, Schema.String, {
	decode: (v) => (v instanceof Date ? v.toISOString() : String(v)),
	encode: (s) => s,
});

const PinCommentRowSchema = Schema.Struct({
	id: Schema.String,
	url: Schema.String,
	content: Schema.String,
	anchor: AnchorSchema,
	viewport: ViewportSchema,
	createdAt: DateToString.pipe(
		Schema.propertySignature,
		Schema.fromKey("created_at"),
	),
	tokenId: Schema.NullOr(Schema.String).pipe(
		Schema.propertySignature,
		Schema.fromKey("token_id"),
	),
	authorName: Schema.NullOr(Schema.String).pipe(
		Schema.propertySignature,
		Schema.fromKey("author_name"),
	),
	authorId: Schema.NullOr(Schema.String).pipe(
		Schema.propertySignature,
		Schema.fromKey("author_id"),
	),
});

const decodeRow = (row: unknown) =>
	Schema.decodeUnknownSync(PinCommentRowSchema)(row);

export const CommentRepoLive = Layer.effect(
	CommentRepository,
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		return {
			create: (comment: PinComment) =>
				Effect.gen(function* () {
					yield* sql`
            INSERT INTO comments (id, url, content, anchor, viewport, created_at, token_id, author_name, author_id)
            VALUES (${comment.id}, ${comment.url}, ${comment.content},
                    ${comment.anchor}, ${comment.viewport}, ${comment.createdAt},
                    ${comment.tokenId}, ${comment.authorName}, ${comment.authorId})
          `;
					return comment;
				}).pipe(
					Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e }))),
				),

			findByUrl: (url: string) =>
				sql`SELECT * FROM comments WHERE url = ${url}`.pipe(
					Effect.map((rows) => rows.map(decodeRow)),
					Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e }))),
				),

			findAll: () =>
				sql`SELECT * FROM comments`.pipe(
					Effect.map((rows) => rows.map(decodeRow)),
					Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e }))),
				),

			deleteById: (id: string) =>
				Effect.gen(function* () {
					const result =
						yield* sql`DELETE FROM comments WHERE id = ${id} RETURNING id`;
					return result.length > 0;
				}).pipe(
					Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e }))),
				),

			updateById: (id: string, content: string) =>
				Effect.gen(function* () {
					const result =
						yield* sql`UPDATE comments SET content = ${content} WHERE id = ${id} RETURNING *`;
					return result.length > 0 ? decodeRow(result[0]) : null;
				}).pipe(
					Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e }))),
				),

			deleteOlderThan: (days: number) =>
				Effect.gen(function* () {
					const result = yield* sql`
						DELETE FROM comments
						WHERE created_at < NOW() - INTERVAL '1 day' * ${days}
						RETURNING id
					`;
					return result.length;
				}).pipe(
					Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e }))),
				),
		};
	}),
);
