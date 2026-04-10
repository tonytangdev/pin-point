import { SqlClient } from "@effect/sql";
import { Effect } from "effect";

export default Effect.flatMap(
	SqlClient.SqlClient,
	(sql) =>
		sql`
    ALTER TABLE comments ADD COLUMN IF NOT EXISTS token_id TEXT;
    ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_name TEXT;
    ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_id TEXT;

    CREATE TABLE IF NOT EXISTS tokens (
      id TEXT PRIMARY KEY,
      label TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_tokens_active
      ON tokens(id) WHERE revoked_at IS NULL;
  `,
);
