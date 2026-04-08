export type Config = {
  port: number;
  host: string;
  dbAdapter: "sqlite";
  databaseUrl: string;
  corsOrigin: string;
};

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST ?? "0.0.0.0",
    dbAdapter: "sqlite",
    databaseUrl: process.env.DATABASE_URL ?? "./pin-point.db",
    corsOrigin: process.env.CORS_ORIGIN ?? "*",
  };
}
