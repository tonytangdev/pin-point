import { SqlClient } from "@effect/sql"
import { Effect } from "effect"

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  sql`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      content TEXT NOT NULL,
      anchor JSONB NOT NULL,
      viewport JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_comments_url ON comments(url);
  `
)
