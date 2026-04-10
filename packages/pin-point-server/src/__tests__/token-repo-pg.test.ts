import { fileURLToPath } from "node:url";
import { NodeContext } from "@effect/platform-node";
import { SqlClient } from "@effect/sql";
import { PgClient, PgMigrator } from "@effect/sql-pg";
import { it } from "@effect/vitest";
import { Effect, Layer, Redacted, Scope } from "effect";
import { afterAll, afterEach, assert, beforeAll, describe } from "vitest";
import type { Token } from "../models/token.js";
import { TokenRepository } from "../repositories/token-repo.js";
import { TokenRepoLive } from "../repositories/token-repo-pg.js";

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

const TestRepoLive = TokenRepoLive.pipe(Layer.provide(TestSqlLive));

const TestEnvLive = Layer.mergeAll(TestRepoLive, TestMigratorLive).pipe(
	Layer.provide(NodeContext.layer),
);

describe("TokenRepoLive", () => {
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
				yield* sql`TRUNCATE TABLE tokens`;
			}).pipe(Effect.provide(TestSqlLive)),
		);
	});

	it.effect("create + findActive returns the token", () =>
		Effect.gen(function* () {
			const repo = yield* TokenRepository;
			const token: Token = {
				id: "ft_test_active",
				label: "integration-test",
				createdAt: new Date().toISOString(),
				expiresAt: null,
				revokedAt: null,
			};
			yield* repo.create(token);
			const found = yield* repo.findActive("ft_test_active");
			assert(found !== null);
			assert(found?.id === "ft_test_active");
			assert(found?.label === "integration-test");
			assert(found?.revokedAt === null);
			assert(found?.expiresAt === null);
		}).pipe(Effect.provide(TestRepoLive)),
	);

	it.effect("findActive returns null for revoked token", () =>
		Effect.gen(function* () {
			const repo = yield* TokenRepository;
			const token: Token = {
				id: "ft_test_revoked",
				label: null,
				createdAt: new Date().toISOString(),
				expiresAt: null,
				revokedAt: null,
			};
			yield* repo.create(token);
			const revoked = yield* repo.revoke("ft_test_revoked");
			assert(revoked === true);
			const found = yield* repo.findActive("ft_test_revoked");
			assert(found === null);
		}).pipe(Effect.provide(TestRepoLive)),
	);

	it.effect("findActive returns null for expired token", () =>
		Effect.gen(function* () {
			const repo = yield* TokenRepository;
			const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
			const token: Token = {
				id: "ft_test_expired",
				label: null,
				createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
				expiresAt: past,
				revokedAt: null,
			};
			yield* repo.create(token);
			const found = yield* repo.findActive("ft_test_expired");
			assert(found === null);
		}).pipe(Effect.provide(TestRepoLive)),
	);
});
