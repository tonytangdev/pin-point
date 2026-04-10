import { fileURLToPath } from "node:url";
import { NodeContext } from "@effect/platform-node";
import { SqlClient } from "@effect/sql";
import { PgClient, PgMigrator } from "@effect/sql-pg";
import { it } from "@effect/vitest";
import { Effect, Layer, Redacted, Scope } from "effect";
import { afterAll, afterEach, assert, beforeAll, describe } from "vitest";
import { CommentRepository } from "../repositories/comment-repo.js";
import { CommentRepoLive } from "../repositories/comment-repo-pg.js";

const TestSqlLive = PgClient.layer({
	database: "pinpoint_test",
	host: "localhost",
	port: 5432,
	username: "pinpoint",
	password: Redacted.make("pinpoint"),
});

const TestMigratorLive = PgMigrator.layer({
	loader: PgMigrator.fromFileSystem(
		fileURLToPath(new URL("../migrations", import.meta.url)),
	),
	schemaDirectory: "src/migrations",
}).pipe(Layer.provide(TestSqlLive));

const TestRepoLive = Layer.mergeAll(
	CommentRepoLive.pipe(Layer.provide(TestSqlLive)),
	TestSqlLive,
);

const TestEnvLive = Layer.mergeAll(TestRepoLive, TestMigratorLive).pipe(
	Layer.provide(NodeContext.layer),
);

describe("CommentRepoLive", () => {
	let scope: Scope.CloseableScope;

	beforeAll(async () => {
		scope = Effect.runSync(Scope.make());
		await Effect.runPromise(Layer.buildWithScope(TestEnvLive, scope));
	});

	afterAll(async () => {
		await Effect.runPromise(
			Scope.close(scope, { _tag: "Success", value: undefined }),
		);
	});

	afterEach(async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`TRUNCATE TABLE comments`;
			}).pipe(Effect.provide(TestSqlLive)),
		);
	});

	it.effect("deleteOlderThan removes comments older than N days", () =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;

			yield* sql`
				INSERT INTO comments (id, url, content, anchor, viewport, created_at, token_id, author_name, author_id)
				VALUES (
					'old_comment',
					'/test',
					'old',
					${JSON.stringify({ selector: "#x", xPercent: 0, yPercent: 0 })}::jsonb,
					${JSON.stringify({ width: 100 })}::jsonb,
					NOW() - INTERVAL '10 days',
					null, null, null
				)
			`;
			yield* sql`
				INSERT INTO comments (id, url, content, anchor, viewport, created_at, token_id, author_name, author_id)
				VALUES (
					'new_comment',
					'/test',
					'new',
					${JSON.stringify({ selector: "#x", xPercent: 0, yPercent: 0 })}::jsonb,
					${JSON.stringify({ width: 100 })}::jsonb,
					NOW(),
					null, null, null
				)
			`;

			const repo = yield* CommentRepository;
			const deletedCount = yield* repo.deleteOlderThan(7);

			assert(deletedCount === 1);

			const remaining = yield* repo.findAll();
			assert(remaining.length === 1);
			assert(remaining[0]?.id === "new_comment");
		}).pipe(Effect.provide(TestRepoLive)),
	);

	it.effect("deleteOlderThan returns 0 when nothing qualifies", () =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;

			yield* sql`
				INSERT INTO comments (id, url, content, anchor, viewport, created_at, token_id, author_name, author_id)
				VALUES (
					'fresh_comment',
					'/test',
					'fresh',
					${JSON.stringify({ selector: "#x", xPercent: 0, yPercent: 0 })}::jsonb,
					${JSON.stringify({ width: 100 })}::jsonb,
					NOW(),
					null, null, null
				)
			`;

			const repo = yield* CommentRepository;
			const deletedCount = yield* repo.deleteOlderThan(7);
			assert(deletedCount === 0);

			const remaining = yield* repo.findAll();
			assert(remaining.length === 1);
		}).pipe(Effect.provide(TestRepoLive)),
	);
});
