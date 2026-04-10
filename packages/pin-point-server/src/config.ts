import { Config } from "effect";

export const AppConfig = Config.all({
	port: Config.number("PORT").pipe(Config.withDefault(3000)),
	host: Config.string("HOST").pipe(Config.withDefault("0.0.0.0")),
	corsOrigin: Config.string("CORS_ORIGIN").pipe(Config.withDefault("*")),
	adminSecret: Config.redacted("ADMIN_SECRET"),
	defaultTokenTtlHours: Config.number("PIN_DEFAULT_TOKEN_TTL_HOURS").pipe(
		Config.option,
	),
	commentRetentionDays: Config.number("PIN_COMMENT_RETENTION_DAYS").pipe(
		Config.option,
	),
});

export type AppConfig = Config.Config.Success<typeof AppConfig>;
