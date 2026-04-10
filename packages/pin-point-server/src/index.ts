import { fileURLToPath } from "node:url";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { PgClient, PgMigrator } from "@effect/sql-pg";
import { serve } from "@hono/node-server";
import { Config, Effect, Layer, Option, Schedule } from "effect";
import { createApp } from "./app.js";
import { AppConfig } from "./config.js";
import { CommentRepoLive } from "./repositories/comment-repo-pg.js";
import { TokenRepoLive } from "./repositories/token-repo-pg.js";
import {
	CommentService,
	CommentServiceLive,
} from "./services/comment-service.js";
import { TokenServiceLive } from "./services/token-service.js";

const SqlLive = PgClient.layerConfig({
	database: Config.string("PG_DATABASE"),
	host: Config.string("PG_HOST").pipe(Config.withDefault("localhost")),
	port: Config.number("PG_PORT").pipe(Config.withDefault(5432)),
	username: Config.string("PG_USERNAME").pipe(Config.withDefault("pinpoint")),
	password: Config.redacted("PG_PASSWORD"),
});

const MigratorLive = PgMigrator.layer({
	loader: PgMigrator.fromFileSystem(
		fileURLToPath(new URL("migrations", import.meta.url)),
	),
	schemaDirectory: "src/migrations",
}).pipe(Layer.provide(SqlLive));

const MainLive = Layer.mergeAll(
	CommentServiceLive.pipe(Layer.provide(CommentRepoLive)),
	TokenServiceLive.pipe(Layer.provide(TokenRepoLive)),
	TokenRepoLive,
).pipe(Layer.provide(SqlLive));

const retentionCleanup = Effect.gen(function* () {
	const config = yield* AppConfig;
	const daysOpt = config.commentRetentionDays;
	if (Option.isNone(daysOpt)) return;
	const days = daysOpt.value;

	const service = yield* CommentService;
	const deleted = yield* service.deleteOlderThan(days);
	yield* Effect.log(
		`Comment retention: deleted ${deleted} comments older than ${days} days`,
	);
}).pipe(
	Effect.catchAll((e) =>
		Effect.logError("Comment retention cleanup failed", e),
	),
);

const program = Effect.gen(function* () {
	const config = yield* AppConfig;
	const app = createApp(Layer.orDie(MainLive));

	yield* retentionCleanup.pipe(
		Effect.repeat(Schedule.spaced("6 hours")),
		Effect.forkScoped,
	);

	const server = serve({
		fetch: app.fetch,
		port: config.port,
		hostname: config.host,
	});

	yield* Effect.log(`Server listening on ${config.host}:${config.port}`);

	yield* Effect.addFinalizer(() => Effect.sync(() => server.close()));

	yield* Effect.never;
});

program.pipe(
	Effect.scoped,
	Effect.provide(Layer.mergeAll(MainLive, MigratorLive)),
	Effect.provide(NodeContext.layer),
	NodeRuntime.runMain,
);
