import { Config } from "effect";

export const AppConfig = Config.all({
	port: Config.number("PORT").pipe(Config.withDefault(3000)),
	host: Config.string("HOST").pipe(Config.withDefault("0.0.0.0")),
	corsOrigin: Config.string("CORS_ORIGIN").pipe(Config.withDefault("*")),
});

export type AppConfig = Config.Config.Success<typeof AppConfig>;
