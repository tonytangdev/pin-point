import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { SqliteCommentRepository } from "./repositories/sqlite-repository";

const config = loadConfig();
const repository = new SqliteCommentRepository(config.databaseUrl);
const app = createApp({ repository, corsOrigin: config.corsOrigin });

serve(
  { fetch: app.fetch, port: config.port, hostname: config.host },
  (info) => {
    console.log(
      `pin-point-server listening on http://${config.host}:${info.port}`,
    );
  },
);
