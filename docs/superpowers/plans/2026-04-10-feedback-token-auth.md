# Feedback Token Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three-role auth (anonymous, token holder, admin) to pin-point so the server can be hosted publicly. Reviewers get zero-friction access via shareable links.

**Architecture:** Single-tenant server. `ADMIN_SECRET` env var = admin. Feedback tokens stored in DB with expiry/revocation. Auth resolved by middleware before routes run. Frontend toolbar reads token from URL and admin secret from localStorage; passes auth headers to consumer callbacks.

**Tech Stack:** Hono + Effect (backend), React + TypeScript (frontend), PostgreSQL via @effect/sql-pg, Vitest for tests.

**Spec:** `docs/superpowers/specs/2026-04-10-feedback-token-auth-design.md`

---

## File Structure

### Backend: `packages/pin-point-server/`

**New files:**
- `src/migrations/0002_add_auth.ts` — alters comments + creates tokens table
- `src/models/token.ts` — Token schema, CreateToken schema
- `src/repositories/token-repo.ts` — abstract TokenRepository tag
- `src/repositories/token-repo-pg.ts` — PG implementation
- `src/services/token-service.ts` — TokenService (create, list, revoke, findActive)
- `src/middleware/auth.ts` — auth context resolver function
- `src/routes/admin-tokens.ts` — POST/GET/DELETE /admin/tokens
- `src/__tests__/token-service.test.ts`
- `src/__tests__/token-routes.test.ts`
- `src/__tests__/auth-middleware.test.ts`

**Modified files:**
- `src/config.ts` — add `ADMIN_SECRET`, `defaultTokenTtlHours`, `commentRetentionDays`
- `src/errors.ts` — add `TokenNotFound`, `Unauthorized`, `Forbidden`, `InvalidAdminSecret`
- `src/models/comment.ts` — add `tokenId`, `authorName`, `authorId` (nullable) to PinComment schema
- `src/repositories/comment-repo.ts` — `create` accepts `tokenId`
- `src/repositories/comment-repo-pg.ts` — INSERT new columns; update row schema
- `src/services/comment-service.ts` — `create` accepts `tokenId`
- `src/routes/comments.ts` — wire up auth middleware, guard routes by role
- `src/app.ts` — mount admin-tokens routes
- `src/index.ts` — wire up TokenRepoLive, TokenServiceLive
- `src/__tests__/comment-routes.test.ts` — update for auth headers
- `src/__tests__/e2e.test.ts` — update for auth headers

### Frontend: `packages/pin-point/`

**New files:**
- `src/hooks/useAuth.ts` — resolves auth from URL + localStorage
- `src/hooks/useAuth.test.ts`
- `src/components/AdminKeyModal.tsx` — paste admin secret
- `src/components/AdminKeyModal.test.tsx`
- `src/components/ShareLinkButton.tsx` — generates + copies share link
- `src/components/ShareLinkButton.test.tsx`

**Modified files:**
- `src/types.ts` — add `PinAuth`, `AuthHeaders`; update callback signatures
- `src/components/FeedbackToolbar.tsx` — add comment button, share button, key icon
- `src/components/FeedbackToolbar.test.tsx` — update tests
- `src/FeedbackOverlay.tsx` — use `useAuth`, gate by pin mode (not query param), pass auth headers
- `src/FeedbackOverlay.test.tsx` — update tests for new auth-based gating
- `src/styles/pin-point.css` — toolbar buttons, modal styles
- `demo/main.tsx` — pass auth headers in fetch calls; provide new callbacks

---

## Phase 1: Backend Foundation

### Task 1: Add config env vars

**Files:**
- Modify: `packages/pin-point-server/src/config.ts`

- [ ] **Step 1: Update AppConfig**

```typescript
import { Config, Redacted } from "effect";

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
```

`Config.option` makes the value `Option<number>` — `None` = unlimited.

- [ ] **Step 2: Verify build still passes**

Run: `cd packages/pin-point-server && pnpm lint`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/pin-point-server/src/config.ts
git commit -m "feat(server): add ADMIN_SECRET and TTL config"
```

---

### Task 2: Add error types

**Files:**
- Modify: `packages/pin-point-server/src/errors.ts`

- [ ] **Step 1: Add new tagged errors**

Append to `errors.ts`:

```typescript
export class TokenNotFound extends Data.TaggedError("TokenNotFound")<{
  readonly id: string;
}> {}

export class Unauthorized extends Data.TaggedError("Unauthorized")<{
  readonly reason: string;
}> {}

export class Forbidden extends Data.TaggedError("Forbidden")<{
  readonly reason: string;
}> {}
```

- [ ] **Step 2: Verify build**

Run: `cd packages/pin-point-server && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/pin-point-server/src/errors.ts
git commit -m "feat(server): add auth error types"
```

---

### Task 3: Migration for tokens table + comment columns

**Files:**
- Create: `packages/pin-point-server/src/migrations/0002_add_auth.ts`
- Modify: `packages/pin-point-server/src/migrations/_schema.sql` (snapshot — regenerated by Effect on next run, but commit hand-updated for diffs)

- [ ] **Step 1: Write migration file**

```typescript
import { SqlClient } from "@effect/sql";
import { Effect } from "effect";

export default Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`
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
```

- [ ] **Step 2: Run migration locally**

Run: `cd packages/pin-point-server && pnpm dev`
Expected: server starts, migration applies cleanly. Stop with Ctrl+C after seeing `Server listening`.

- [ ] **Step 3: Verify schema**

Run via psql or a one-shot script:
```bash
docker compose exec postgres psql -U pinpoint -d pinpoint -c "\d tokens"
docker compose exec postgres psql -U pinpoint -d pinpoint -c "\d comments"
```
Expected: `tokens` table exists; `comments` has new nullable columns.

- [ ] **Step 4: Commit**

```bash
git add packages/pin-point-server/src/migrations/0002_add_auth.ts
git commit -m "feat(server): add tokens table and auth columns on comments"
```

---

### Task 4: Token model

**Files:**
- Create: `packages/pin-point-server/src/models/token.ts`

- [ ] **Step 1: Define schemas**

```typescript
import { Schema } from "effect";

export const TokenSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  expiresAt: Schema.NullOr(Schema.String),
  revokedAt: Schema.NullOr(Schema.String),
});

export type Token = typeof TokenSchema.Type;

export const CreateTokenSchema = Schema.Struct({
  label: Schema.optional(Schema.String),
  expiresInHours: Schema.optional(Schema.Number),
});

export type CreateToken = typeof CreateTokenSchema.Type;
```

- [ ] **Step 2: Verify build**

Run: `cd packages/pin-point-server && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/pin-point-server/src/models/token.ts
git commit -m "feat(server): add Token model and schemas"
```

---

## Phase 2: Token Repository & Service

### Task 5: TokenRepository interface

**Files:**
- Create: `packages/pin-point-server/src/repositories/token-repo.ts`

- [ ] **Step 1: Define abstract repository**

```typescript
import { Context, Effect } from "effect";
import { DatabaseError } from "../errors.js";
import type { Token } from "../models/token.js";

export class TokenRepository extends Context.Tag("TokenRepository")<
  TokenRepository,
  {
    readonly create: (token: Token) => Effect.Effect<Token, DatabaseError>;
    readonly findActive: (id: string) => Effect.Effect<Token | null, DatabaseError>;
    readonly findAll: () => Effect.Effect<Token[], DatabaseError>;
    readonly revoke: (id: string) => Effect.Effect<boolean, DatabaseError>;
  }
>() {}
```

- [ ] **Step 2: Verify build**

Run: `cd packages/pin-point-server && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/pin-point-server/src/repositories/token-repo.ts
git commit -m "feat(server): add TokenRepository interface"
```

---

### Task 6: TokenRepository PG implementation

**Files:**
- Create: `packages/pin-point-server/src/repositories/token-repo-pg.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/pin-point-server/src/__tests__/token-repo-pg.test.ts`:

```typescript
import { it, expect, describe } from "@effect/vitest";
import { Effect, Layer, Redacted, Scope } from "effect";
import { PgClient } from "@effect/sql-pg";
import { SqlClient } from "@effect/sql";
import { TokenRepository } from "../repositories/token-repo.js";
import { TokenRepoLive } from "../repositories/token-repo-pg.js";

const TestSqlLive = PgClient.layer({
  database: "pinpoint_test",
  host: "localhost",
  port: 5432,
  username: "pinpoint",
  password: Redacted.make("pinpoint"),
});

const TestLive = TokenRepoLive.pipe(Layer.provide(TestSqlLive));

describe("TokenRepoPg", () => {
  it.effect("create + findActive returns the token", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`TRUNCATE TABLE tokens`;

      const repo = yield* TokenRepository;
      const token = {
        id: "ft_test_1",
        label: "alice",
        createdAt: new Date().toISOString(),
        expiresAt: null,
        revokedAt: null,
      };
      yield* repo.create(token);
      const found = yield* repo.findActive("ft_test_1");
      expect(found?.id).toBe("ft_test_1");
    }).pipe(Effect.provide(TestLive)),
  );

  it.effect("findActive returns null for revoked token", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`TRUNCATE TABLE tokens`;

      const repo = yield* TokenRepository;
      yield* repo.create({
        id: "ft_revoked",
        label: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
        revokedAt: null,
      });
      yield* repo.revoke("ft_revoked");
      const found = yield* repo.findActive("ft_revoked");
      expect(found).toBeNull();
    }).pipe(Effect.provide(TestLive)),
  );

  it.effect("findActive returns null for expired token", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`TRUNCATE TABLE tokens`;

      const repo = yield* TokenRepository;
      yield* repo.create({
        id: "ft_expired",
        label: null,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        revokedAt: null,
      });
      const found = yield* repo.findActive("ft_expired");
      expect(found).toBeNull();
    }).pipe(Effect.provide(TestLive)),
  );
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `cd packages/pin-point-server && pnpm vitest run src/__tests__/token-repo-pg.test.ts`
Expected: FAIL — `TokenRepoLive` not exported.

- [ ] **Step 3: Implement TokenRepoLive**

Create `packages/pin-point-server/src/repositories/token-repo-pg.ts`:

```typescript
import { SqlClient } from "@effect/sql";
import { Effect, Layer, Schema } from "effect";
import { DatabaseError } from "../errors.js";
import type { Token } from "../models/token.js";
import { TokenRepository } from "./token-repo.js";

const DateToString = Schema.transform(Schema.Unknown, Schema.NullOr(Schema.String), {
  decode: (v) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v)),
  encode: (s) => s,
});

const TokenRowSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.NullOr(Schema.String),
  createdAt: Schema.transform(Schema.Unknown, Schema.String, {
    decode: (v) => (v instanceof Date ? v.toISOString() : String(v)),
    encode: (s) => s,
  }).pipe(Schema.propertySignature, Schema.fromKey("created_at")),
  expiresAt: DateToString.pipe(
    Schema.propertySignature,
    Schema.fromKey("expires_at"),
  ),
  revokedAt: DateToString.pipe(
    Schema.propertySignature,
    Schema.fromKey("revoked_at"),
  ),
});

const decodeRow = (row: unknown) => Schema.decodeUnknownSync(TokenRowSchema)(row);

export const TokenRepoLive = Layer.effect(
  TokenRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return {
      create: (token: Token) =>
        Effect.gen(function* () {
          yield* sql`
            INSERT INTO tokens (id, label, created_at, expires_at, revoked_at)
            VALUES (${token.id}, ${token.label}, ${token.createdAt}, ${token.expiresAt}, ${token.revokedAt})
          `;
          return token;
        }).pipe(
          Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e }))),
        ),

      findActive: (id: string) =>
        Effect.gen(function* () {
          const rows = yield* sql`
            SELECT * FROM tokens
            WHERE id = ${id}
              AND revoked_at IS NULL
              AND (expires_at IS NULL OR expires_at > NOW())
          `;
          return rows.length > 0 ? decodeRow(rows[0]) : null;
        }).pipe(
          Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e }))),
        ),

      findAll: () =>
        sql`SELECT * FROM tokens ORDER BY created_at DESC`.pipe(
          Effect.map((rows) => rows.map(decodeRow)),
          Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e }))),
        ),

      revoke: (id: string) =>
        Effect.gen(function* () {
          const result = yield* sql`
            UPDATE tokens SET revoked_at = NOW()
            WHERE id = ${id} AND revoked_at IS NULL
            RETURNING id
          `;
          return result.length > 0;
        }).pipe(
          Effect.catchAll((e) => Effect.fail(new DatabaseError({ cause: e }))),
        ),
    };
  }),
);
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd packages/pin-point-server && pnpm vitest run src/__tests__/token-repo-pg.test.ts`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point-server/src/repositories/token-repo-pg.ts \
        packages/pin-point-server/src/__tests__/token-repo-pg.test.ts
git commit -m "feat(server): add TokenRepoLive PG implementation with tests"
```

---

### Task 7: TokenService

**Files:**
- Create: `packages/pin-point-server/src/services/token-service.ts`
- Create: `packages/pin-point-server/src/__tests__/token-service.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { it, expect, describe } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { TokenRepository } from "../repositories/token-repo.js";
import { TokenService, TokenServiceLive } from "../services/token-service.js";
import type { Token } from "../models/token.js";

const makeMockRepo = () => {
  const stored = new Map<string, Token>();
  return {
    repo: Layer.succeed(TokenRepository, {
      create: (token: Token) => {
        stored.set(token.id, token);
        return Effect.succeed(token);
      },
      findActive: (id: string) => {
        const t = stored.get(id);
        if (!t || t.revokedAt) return Effect.succeed(null);
        if (t.expiresAt && new Date(t.expiresAt) < new Date())
          return Effect.succeed(null);
        return Effect.succeed(t);
      },
      findAll: () => Effect.succeed(Array.from(stored.values())),
      revoke: (id: string) => {
        const t = stored.get(id);
        if (!t) return Effect.succeed(false);
        stored.set(id, { ...t, revokedAt: new Date().toISOString() });
        return Effect.succeed(true);
      },
    }),
    stored,
  };
};

describe("TokenService", () => {
  it.effect("create generates id with ft_ prefix", () =>
    Effect.gen(function* () {
      const svc = yield* TokenService;
      const token = yield* svc.create({ label: "alice", expiresInHours: 24 });
      expect(token.id.startsWith("ft_")).toBe(true);
    }).pipe(Effect.provide(TokenServiceLive.pipe(Layer.provide(makeMockRepo().repo)))),
  );

  it.effect("create with expiresInHours sets expiresAt", () =>
    Effect.gen(function* () {
      const svc = yield* TokenService;
      const before = Date.now();
      const token = yield* svc.create({ expiresInHours: 24 });
      expect(token.expiresAt).not.toBeNull();
      const expMs = new Date(token.expiresAt!).getTime();
      expect(expMs).toBeGreaterThanOrEqual(before + 24 * 3600 * 1000 - 1000);
    }).pipe(Effect.provide(TokenServiceLive.pipe(Layer.provide(makeMockRepo().repo)))),
  );

  it.effect("create without expiresInHours leaves expiresAt null", () =>
    Effect.gen(function* () {
      const svc = yield* TokenService;
      const token = yield* svc.create({});
      expect(token.expiresAt).toBeNull();
    }).pipe(Effect.provide(TokenServiceLive.pipe(Layer.provide(makeMockRepo().repo)))),
  );

  it.effect("revoke marks the token revoked", () =>
    Effect.gen(function* () {
      const svc = yield* TokenService;
      const token = yield* svc.create({ label: "bob" });
      const ok = yield* svc.revoke(token.id);
      expect(ok).toBe(true);
    }).pipe(Effect.provide(TokenServiceLive.pipe(Layer.provide(makeMockRepo().repo)))),
  );
});
```

- [ ] **Step 2: Run, verify failure**

Run: `cd packages/pin-point-server && pnpm vitest run src/__tests__/token-service.test.ts`
Expected: FAIL — `TokenService` not exported.

- [ ] **Step 3: Implement TokenService**

```typescript
import { Context, Effect, Layer } from "effect";
import type { DatabaseError } from "../errors.js";
import { TokenRepository } from "../repositories/token-repo.js";
import type { CreateToken, Token } from "../models/token.js";

const generateId = () => {
  const random = crypto.randomUUID().replace(/-/g, "");
  return `ft_${random}`;
};

export class TokenService extends Context.Tag("TokenService")<
  TokenService,
  {
    readonly create: (input: CreateToken) => Effect.Effect<Token, DatabaseError>;
    readonly findActive: (id: string) => Effect.Effect<Token | null, DatabaseError>;
    readonly findAll: () => Effect.Effect<Token[], DatabaseError>;
    readonly revoke: (id: string) => Effect.Effect<boolean, DatabaseError>;
  }
>() {}

export const TokenServiceLive = Layer.effect(
  TokenService,
  Effect.gen(function* () {
    const repo = yield* TokenRepository;

    return {
      create: (input: CreateToken) =>
        Effect.gen(function* () {
          const now = new Date();
          const expiresAt =
            input.expiresInHours != null
              ? new Date(now.getTime() + input.expiresInHours * 3600 * 1000).toISOString()
              : null;

          const token: Token = {
            id: generateId(),
            label: input.label ?? null,
            createdAt: now.toISOString(),
            expiresAt,
            revokedAt: null,
          };
          return yield* repo.create(token);
        }),

      findActive: (id: string) => repo.findActive(id),
      findAll: () => repo.findAll(),
      revoke: (id: string) => repo.revoke(id),
    };
  }),
);
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd packages/pin-point-server && pnpm vitest run src/__tests__/token-service.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point-server/src/services/token-service.ts \
        packages/pin-point-server/src/__tests__/token-service.test.ts
git commit -m "feat(server): add TokenService with create/revoke/findActive"
```

---

## Phase 3: Auth Middleware

### Task 8: Auth context type and resolver

**Files:**
- Create: `packages/pin-point-server/src/middleware/auth.ts`
- Create: `packages/pin-point-server/src/__tests__/auth-middleware.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { it, expect, describe } from "@effect/vitest";
import { Effect, Layer, Redacted } from "effect";
import { TokenRepository } from "../repositories/token-repo.js";
import { resolveAuth } from "../middleware/auth.js";

const tokenRepoStub = (token: { id: string; revoked?: boolean; expired?: boolean } | null) =>
  Layer.succeed(TokenRepository, {
    create: () => Effect.succeed({} as never),
    findAll: () => Effect.succeed([]),
    revoke: () => Effect.succeed(false),
    findActive: (id: string) => {
      if (!token || token.id !== id || token.revoked || token.expired)
        return Effect.succeed(null);
      return Effect.succeed({
        id,
        label: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
        revokedAt: null,
      });
    },
  });

describe("resolveAuth", () => {
  const adminSecret = Redacted.make("super-secret");

  it.effect("admin secret valid → role admin", () =>
    Effect.gen(function* () {
      const ctx = yield* resolveAuth({
        adminHeader: "super-secret",
        tokenHeader: undefined,
        adminSecret,
      });
      expect(ctx.role).toBe("admin");
    }).pipe(Effect.provide(tokenRepoStub(null))),
  );

  it.effect("admin secret invalid → role anonymous", () =>
    Effect.gen(function* () {
      const ctx = yield* resolveAuth({
        adminHeader: "wrong",
        tokenHeader: undefined,
        adminSecret,
      });
      expect(ctx.role).toBe("anonymous");
    }).pipe(Effect.provide(tokenRepoStub(null))),
  );

  it.effect("valid active token → role tokenHolder", () =>
    Effect.gen(function* () {
      const ctx = yield* resolveAuth({
        adminHeader: undefined,
        tokenHeader: "ft_abc",
        adminSecret,
      });
      expect(ctx.role).toBe("tokenHolder");
      if (ctx.role === "tokenHolder") expect(ctx.tokenId).toBe("ft_abc");
    }).pipe(Effect.provide(tokenRepoStub({ id: "ft_abc" }))),
  );

  it.effect("revoked token → role anonymous", () =>
    Effect.gen(function* () {
      const ctx = yield* resolveAuth({
        adminHeader: undefined,
        tokenHeader: "ft_abc",
        adminSecret,
      });
      expect(ctx.role).toBe("anonymous");
    }).pipe(Effect.provide(tokenRepoStub({ id: "ft_abc", revoked: true }))),
  );

  it.effect("no headers → role anonymous", () =>
    Effect.gen(function* () {
      const ctx = yield* resolveAuth({
        adminHeader: undefined,
        tokenHeader: undefined,
        adminSecret,
      });
      expect(ctx.role).toBe("anonymous");
    }).pipe(Effect.provide(tokenRepoStub(null))),
  );
});
```

- [ ] **Step 2: Run, verify failure**

Run: `cd packages/pin-point-server && pnpm vitest run src/__tests__/auth-middleware.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement resolveAuth**

```typescript
import { Effect, Redacted } from "effect";
import { TokenRepository } from "../repositories/token-repo.js";
import type { DatabaseError } from "../errors.js";

export type AuthContext =
  | { readonly role: "anonymous" }
  | { readonly role: "tokenHolder"; readonly tokenId: string }
  | { readonly role: "admin" };

const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export type ResolveAuthInput = {
  adminHeader: string | undefined;
  tokenHeader: string | undefined;
  adminSecret: Redacted.Redacted<string>;
};

export const resolveAuth = (
  input: ResolveAuthInput,
): Effect.Effect<AuthContext, DatabaseError, TokenRepository> =>
  Effect.gen(function* () {
    if (input.adminHeader) {
      const secret = Redacted.value(input.adminSecret);
      if (constantTimeEqual(input.adminHeader, secret)) {
        return { role: "admin" } as const;
      }
    }

    if (input.tokenHeader) {
      const repo = yield* TokenRepository;
      const token = yield* repo.findActive(input.tokenHeader);
      if (token) return { role: "tokenHolder", tokenId: token.id } as const;
    }

    return { role: "anonymous" } as const;
  });
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd packages/pin-point-server && pnpm vitest run src/__tests__/auth-middleware.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point-server/src/middleware/auth.ts \
        packages/pin-point-server/src/__tests__/auth-middleware.test.ts
git commit -m "feat(server): add auth context resolver with role detection"
```

---

## Phase 4: Update Comment Layer for Auth

### Task 9: Update comment model with new fields

**Files:**
- Modify: `packages/pin-point-server/src/models/comment.ts`

- [ ] **Step 1: Add nullable fields to PinComment schema**

```typescript
export const PinCommentSchema = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
  content: Schema.String,
  anchor: AnchorSchema,
  viewport: ViewportSchema,
  createdAt: Schema.String,
  tokenId: Schema.NullOr(Schema.String),
  authorName: Schema.NullOr(Schema.String),
  authorId: Schema.NullOr(Schema.String),
});

export type PinComment = typeof PinCommentSchema.Type;
```

`CreateCommentSchema` stays the same — `tokenId` etc. come from auth context, not the request body.

- [ ] **Step 2: Verify build (will fail in repo/service — that's expected)**

Run: `cd packages/pin-point-server && pnpm lint`
Expected: type errors in comment-repo-pg.ts and comment-service.ts. Will fix in next tasks.

- [ ] **Step 3: Commit (WIP — model only)**

Don't commit yet. Bundle with the next tasks since the build is broken.

---

### Task 10: Update CommentRepository to handle new fields

**Files:**
- Modify: `packages/pin-point-server/src/repositories/comment-repo.ts`
- Modify: `packages/pin-point-server/src/repositories/comment-repo-pg.ts`

- [ ] **Step 1: Update repo interface signature**

In `comment-repo.ts`, no signature change needed — `create` still takes a `PinComment` (which now includes the nullable fields).

- [ ] **Step 2: Update PG row schema**

In `comment-repo-pg.ts`:

```typescript
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
```

- [ ] **Step 3: Update INSERT statement**

```typescript
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
```

- [ ] **Step 4: Verify build**

Run: `cd packages/pin-point-server && pnpm lint`
Expected: comment-service.ts may still have errors — fix in next task.

---

### Task 11: Update CommentService to accept auth context

**Files:**
- Modify: `packages/pin-point-server/src/services/comment-service.ts`

- [ ] **Step 1: Update create signature**

```typescript
readonly create: (
  input: CreateComment,
  meta: { tokenId: string | null },
) => Effect.Effect<PinComment, DatabaseError>;
```

Implementation:

```typescript
create: (input: CreateComment, meta) =>
  Effect.gen(function* () {
    const comment: PinComment = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      tokenId: meta.tokenId,
      authorName: null,
      authorId: null,
      ...input,
    };
    return yield* repo.create(comment);
  }),
```

- [ ] **Step 2: Verify build**

Run: `cd packages/pin-point-server && pnpm lint`
Expected: routes/comments.ts now has type errors — fix in next task.

---

### Task 12: Update comment routes to use auth middleware

**Files:**
- Modify: `packages/pin-point-server/src/routes/comments.ts`

- [ ] **Step 1: Add helper to read auth from request**

At the top of the file, add a helper that extracts headers and runs `resolveAuth`:

```typescript
import { resolveAuth, type AuthContext } from "../middleware/auth.js";
import { TokenRepository } from "../repositories/token-repo.js";
import { AppConfig } from "../config.js";

const getAuth = (c: Context) =>
  Effect.gen(function* () {
    const config = yield* AppConfig;
    return yield* resolveAuth({
      adminHeader: c.req.header("X-Pin-Admin"),
      tokenHeader: c.req.header("X-Pin-Token"),
      adminSecret: config.adminSecret,
    });
  });
```

The route factory must accept the additional layer:

```typescript
export const makeCommentRoutes = (
  layer: Layer.Layer<CommentService | TokenRepository>,
) => { ... }
```

`runEffect` now needs `TokenRepository` and `Config` in scope. Update the layer composition to include them.

- [ ] **Step 2: Guard POST /comments**

```typescript
app.post("/comments", async (c) => {
  const body = await c.req.json();
  const decoded = Schema.decodeUnknownEither(CreateCommentSchema)(body);
  if (decoded._tag === "Left") {
    return c.json({ error: "Invalid request body", code: "BAD_REQUEST" }, 400);
  }

  const result = await runEffect(
    Effect.gen(function* () {
      const auth = yield* getAuth(c);
      if (auth.role === "anonymous") {
        return { _tag: "unauthorized" as const };
      }
      const tokenId = auth.role === "tokenHolder" ? auth.tokenId : null;
      const service = yield* CommentService;
      const created = yield* service.create(decoded.right, { tokenId });
      return { _tag: "ok" as const, data: created };
    }).pipe(
      Effect.catchTag("DatabaseError", () =>
        Effect.succeed({ _tag: "dbError" as const }),
      ),
    ),
  );

  if (result._tag === "unauthorized")
    return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  if (result._tag === "dbError")
    return c.json({ error: "Internal server error", code: "DB_ERROR" }, 500);
  return c.json(result.data, 201);
});
```

- [ ] **Step 3: Guard PATCH and DELETE with admin requirement**

```typescript
app.patch("/comments/:id", async (c) => {
  // ... validate body as before
  const result = await runEffect(
    Effect.gen(function* () {
      const auth = yield* getAuth(c);
      if (auth.role !== "admin") return { _tag: "forbidden" as const };
      const service = yield* CommentService;
      const updated = yield* service.update(id, decoded.right.content);
      return { _tag: "ok" as const, data: updated };
    }).pipe(/* existing catchTags */),
  );
  if (result._tag === "forbidden")
    return c.json({ error: "Admin required", code: "FORBIDDEN" }, 403);
  // ... rest as before
});

// Same pattern for DELETE
```

For PATCH/DELETE, distinguish anonymous (401) vs token-holder (403) by checking `auth.role === "anonymous"` first.

- [ ] **Step 4: GET /comments stays public, no change**

Verify the GET handler is untouched.

- [ ] **Step 5: Verify build**

Run: `cd packages/pin-point-server && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit (bundles tasks 9-12)**

```bash
git add packages/pin-point-server/src/models/comment.ts \
        packages/pin-point-server/src/repositories/comment-repo-pg.ts \
        packages/pin-point-server/src/services/comment-service.ts \
        packages/pin-point-server/src/routes/comments.ts
git commit -m "feat(server): wire auth into comment routes; add tokenId on create"
```

---

### Task 13: Update existing comment route tests

**Files:**
- Modify: `packages/pin-point-server/src/__tests__/comment-routes.test.ts`

- [ ] **Step 1: Update test layer to include AppConfig + TokenRepository**

The existing tests stub `CommentRepository`. They now need:
- A stub `TokenRepository` that returns null (no tokens) or a fixed valid token for tokenHolder cases
- A stub `AppConfig` with a known `adminSecret`

```typescript
import { ConfigProvider } from "effect";

const TestConfig = ConfigProvider.fromMap(
  new Map([
    ["ADMIN_SECRET", "test-admin-secret"],
  ]),
);

const TokenRepoStub = Layer.succeed(TokenRepository, {
  create: () => Effect.succeed({} as never),
  findAll: () => Effect.succeed([]),
  revoke: () => Effect.succeed(false),
  findActive: (id) =>
    Effect.succeed(
      id === "ft_valid"
        ? {
            id,
            label: null,
            createdAt: new Date().toISOString(),
            expiresAt: null,
            revokedAt: null,
          }
        : null,
    ),
});
```

Apply `Layer.setConfigProvider(TestConfig)` (or pass via app construction) so `AppConfig` resolves in tests.

- [ ] **Step 2: Update existing POST test to send valid token header**

```typescript
it("POST /comments with valid token returns 201", async () => {
  const res = await app.request("/comments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Pin-Token": "ft_valid",
    },
    body: JSON.stringify({...}),
  });
  expect(res.status).toBe(201);
});
```

- [ ] **Step 3: Add new behavioral tests**

```typescript
it("POST /comments without auth returns 401", async () => {
  const res = await app.request("/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({...}),
  });
  expect(res.status).toBe(401);
});

it("POST /comments with admin secret returns 201", async () => {
  const res = await app.request("/comments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Pin-Admin": "test-admin-secret",
    },
    body: JSON.stringify({...}),
  });
  expect(res.status).toBe(201);
});

it("PATCH /comments/:id with token returns 403", async () => {
  // create comment first via admin or token, then try to patch with token
  const res = await app.request("/comments/some-id", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Pin-Token": "ft_valid",
    },
    body: JSON.stringify({ content: "updated" }),
  });
  expect(res.status).toBe(403);
});

it("PATCH /comments/:id with admin returns 200", async () => {
  // ... admin header + valid id
  expect(res.status).toBe(200);
});

it("DELETE /comments/:id with token returns 403", async () => { ... });
it("DELETE /comments/:id with admin returns 204", async () => { ... });

it("GET /comments without auth returns 200 (public)", async () => { ... });
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd packages/pin-point-server && pnpm vitest run src/__tests__/comment-routes.test.ts`
Expected: PASS (all old + new).

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point-server/src/__tests__/comment-routes.test.ts
git commit -m "test(server): add auth coverage to comment route tests"
```

---

## Phase 5: Admin Token Routes

### Task 14: Admin token routes

**Files:**
- Create: `packages/pin-point-server/src/routes/admin-tokens.ts`
- Create: `packages/pin-point-server/src/__tests__/token-routes.test.ts`
- Modify: `packages/pin-point-server/src/app.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
describe("Admin token routes", () => {
  it("POST /admin/tokens without admin header returns 401", async () => {
    const res = await app.request("/admin/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it("POST /admin/tokens with admin header returns 201 and a token", async () => {
    const res = await app.request("/admin/tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pin-Admin": "test-admin-secret",
      },
      body: JSON.stringify({ label: "alice", expiresInHours: 24 }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/^ft_/);
    expect(body.label).toBe("alice");
    expect(body.expiresAt).not.toBeNull();
  });

  it("POST /admin/tokens with no expiresInHours and no env default → expiresAt null", async () => {
    const res = await app.request("/admin/tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pin-Admin": "test-admin-secret",
      },
      body: JSON.stringify({}),
    });
    const body = await res.json();
    expect(body.expiresAt).toBeNull();
  });

  it("GET /admin/tokens with admin returns list", async () => {
    // create 2 tokens, then GET, expect length 2
  });

  it("DELETE /admin/tokens/:id with admin returns 204 and revokes", async () => {
    // create, then delete, then verify findActive returns null
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `cd packages/pin-point-server && pnpm vitest run src/__tests__/token-routes.test.ts`
Expected: FAIL — admin-tokens.ts not exported.

- [ ] **Step 3: Implement routes**

```typescript
import { Effect, Layer, Schema } from "effect";
import { Hono, type Context } from "hono";
import { AppConfig } from "../config.js";
import { CreateTokenSchema } from "../models/token.js";
import { resolveAuth } from "../middleware/auth.js";
import { TokenRepository } from "../repositories/token-repo.js";
import { TokenService } from "../services/token-service.js";

export const makeAdminTokenRoutes = (
  layer: Layer.Layer<TokenService | TokenRepository>,
) => {
  const app = new Hono();

  const runEffect = <A>(effect: Effect.Effect<A, never, TokenService | TokenRepository>) =>
    Effect.runPromise(effect.pipe(Effect.provide(layer)));

  const requireAdmin = (c: Context) =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const auth = yield* resolveAuth({
        adminHeader: c.req.header("X-Pin-Admin"),
        tokenHeader: c.req.header("X-Pin-Token"),
        adminSecret: config.adminSecret,
      });
      return auth.role === "admin";
    });

  app.post("/admin/tokens", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const decoded = Schema.decodeUnknownEither(CreateTokenSchema)(body);
    if (decoded._tag === "Left") {
      return c.json({ error: "Invalid request body", code: "BAD_REQUEST" }, 400);
    }

    const result = await runEffect(
      Effect.gen(function* () {
        const isAdmin = yield* requireAdmin(c);
        if (!isAdmin) return { _tag: "unauthorized" as const };
        const config = yield* AppConfig;
        const fallbackTtl = decoded.right.expiresInHours ?? config.defaultTokenTtlHours._tag === "Some"
          ? config.defaultTokenTtlHours.value
          : undefined;
        const svc = yield* TokenService;
        const token = yield* svc.create({
          label: decoded.right.label,
          expiresInHours: fallbackTtl,
        });
        return { _tag: "ok" as const, data: token };
      }).pipe(
        Effect.catchTag("DatabaseError", () =>
          Effect.succeed({ _tag: "dbError" as const }),
        ),
      ),
    );

    if (result._tag === "unauthorized")
      return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    if (result._tag === "dbError")
      return c.json({ error: "Internal server error", code: "DB_ERROR" }, 500);
    return c.json(result.data, 201);
  });

  app.get("/admin/tokens", async (c) => {
    const result = await runEffect(
      Effect.gen(function* () {
        const isAdmin = yield* requireAdmin(c);
        if (!isAdmin) return { _tag: "unauthorized" as const };
        const svc = yield* TokenService;
        const tokens = yield* svc.findAll();
        return { _tag: "ok" as const, data: tokens };
      }).pipe(
        Effect.catchTag("DatabaseError", () =>
          Effect.succeed({ _tag: "dbError" as const }),
        ),
      ),
    );
    if (result._tag === "unauthorized")
      return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    if (result._tag === "dbError")
      return c.json({ error: "Internal server error", code: "DB_ERROR" }, 500);
    return c.json(result.data);
  });

  app.delete("/admin/tokens/:id", async (c) => {
    const id = c.req.param("id");
    const result = await runEffect(
      Effect.gen(function* () {
        const isAdmin = yield* requireAdmin(c);
        if (!isAdmin) return { _tag: "unauthorized" as const };
        const svc = yield* TokenService;
        yield* svc.revoke(id);
        return { _tag: "ok" as const };
      }).pipe(
        Effect.catchTag("DatabaseError", () =>
          Effect.succeed({ _tag: "dbError" as const }),
        ),
      ),
    );
    if (result._tag === "unauthorized")
      return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    if (result._tag === "dbError")
      return c.json({ error: "Internal server error", code: "DB_ERROR" }, 500);
    return c.body(null, 204);
  });

  return app;
};
```

- [ ] **Step 4: Mount routes in app.ts**

```typescript
import { makeAdminTokenRoutes } from "./routes/admin-tokens.js";

export const createApp = (
  layer: Layer.Layer<CommentService | TokenService | TokenRepository>,
) => {
  const app = new Hono();
  app.use("*", cors());
  app.route("/", makeCommentRoutes(layer));
  app.route("/", makeAdminTokenRoutes(layer));
  app.onError(/* ... */);
  return app;
};
```

- [ ] **Step 5: Run tests**

Run: `cd packages/pin-point-server && pnpm vitest run src/__tests__/token-routes.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/pin-point-server/src/routes/admin-tokens.ts \
        packages/pin-point-server/src/app.ts \
        packages/pin-point-server/src/__tests__/token-routes.test.ts
git commit -m "feat(server): add admin token routes (create/list/revoke)"
```

---

### Task 15: Wire TokenService into index.ts

**Files:**
- Modify: `packages/pin-point-server/src/index.ts`

- [ ] **Step 1: Add TokenRepoLive and TokenServiceLive to layer composition**

```typescript
import { TokenRepoLive } from "./repositories/token-repo-pg.js";
import { TokenServiceLive } from "./services/token-service.js";

const MainLive = Layer.mergeAll(
  CommentServiceLive,
  TokenServiceLive,
  TokenRepoLive,
).pipe(
  Layer.provide(CommentRepoLive),
  Layer.provide(SqlLive),
);
```

(Adjust existing composition to include TokenRepo + TokenService.)

- [ ] **Step 2: Run server, sanity check**

Run: `cd packages/pin-point-server && pnpm dev`
Expected: server starts, no errors.

```bash
# In another terminal:
curl -X POST http://localhost:3000/admin/tokens \
  -H "Content-Type: application/json" \
  -H "X-Pin-Admin: $ADMIN_SECRET" \
  -d '{"label":"smoke test"}'
# Expected: 201 + JSON token
```

Stop server with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add packages/pin-point-server/src/index.ts
git commit -m "feat(server): wire TokenService into runtime layers"
```

---

### Task 16: Update e2e test for auth

**Files:**
- Modify: `packages/pin-point-server/src/__tests__/e2e.test.ts`

- [ ] **Step 1: Set ADMIN_SECRET via process.env at top of file**

```typescript
process.env.ADMIN_SECRET = "e2e-admin-secret";
```

(Or use a test ConfigProvider.)

- [ ] **Step 2: Update existing tests to send admin or token headers**

All POST/PATCH/DELETE in the existing lifecycle test should send `X-Pin-Admin: e2e-admin-secret`.

- [ ] **Step 3: Add new e2e tests**

```typescript
it("create token via admin → use token to create comment → succeed", async () => {
  // POST /admin/tokens with admin header
  // POST /comments with returned token in X-Pin-Token header
  // expect 201
});

it("revoke token → subsequent POST /comments with that token → 401", async () => {
  // ...
});
```

- [ ] **Step 4: Add tokens TRUNCATE to afterEach**

```typescript
afterEach(async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`TRUNCATE TABLE comments`;
      yield* sql`TRUNCATE TABLE tokens`;
    }).pipe(Effect.provide(TestSqlLive)),
  );
});
```

- [ ] **Step 5: Run e2e tests**

Run: `cd packages/pin-point-server && pnpm vitest run src/__tests__/e2e.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/pin-point-server/src/__tests__/e2e.test.ts
git commit -m "test(server): cover auth flow end-to-end"
```

---

## Phase 6: Frontend — Auth & Toolbar

### Task 17: Add types for auth

**Files:**
- Modify: `packages/pin-point/src/types.ts`

- [ ] **Step 1: Add auth types and update callbacks**

```typescript
export type AuthHeaders = Record<string, string>;

export type PinAuth =
  | { role: "anonymous" }
  | { role: "tokenHolder"; token: string }
  | { role: "admin"; secret: string };

export type FeedbackOverlayProps = {
  serverUrl?: string; // optional, only used internally for direct API calls (admin validate, share link)
  onCommentCreate: (comment: PinComment, authHeaders: AuthHeaders) => Promise<void>;
  onCommentsFetch: (authHeaders: AuthHeaders) => Promise<PinComment[]>;
  onCommentDelete?: (id: string, authHeaders: AuthHeaders) => Promise<void>;
  onCommentUpdate?: (
    id: string,
    content: string,
    authHeaders: AuthHeaders,
  ) => Promise<PinComment>;
  // New admin callbacks (optional — only invoked when admin role is active)
  onAdminValidate?: (secret: string) => Promise<boolean>;
  onShareLinkCreate?: (
    label: string | undefined,
    expiresInHours: number | undefined,
    authHeaders: AuthHeaders,
  ) => Promise<{ tokenId: string }>;
  children: React.ReactNode;
};
```

Note: removing `queryParam`. Auth is now fully header-driven, not URL-mode-driven.

- [ ] **Step 2: Verify build (will fail in FeedbackOverlay)**

Run: `cd packages/pin-point && pnpm lint`
Expected: type errors in FeedbackOverlay.tsx — fixed in next tasks.

- [ ] **Step 3: Don't commit yet — bundle with FeedbackOverlay update**

---

### Task 18: useAuth hook

**Files:**
- Create: `packages/pin-point/src/hooks/useAuth.ts`
- Create: `packages/pin-point/src/hooks/useAuth.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useAuth } from "./useAuth";

describe("useAuth", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("returns anonymous when no token in URL and no admin in storage", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.auth.role).toBe("anonymous");
  });

  it("returns tokenHolder when ?pin-token=ft_xxx in URL", () => {
    window.history.replaceState({}, "", "/?pin-token=ft_test");
    const { result } = renderHook(() => useAuth());
    expect(result.current.auth.role).toBe("tokenHolder");
    if (result.current.auth.role === "tokenHolder") {
      expect(result.current.auth.token).toBe("ft_test");
    }
  });

  it("returns admin when localStorage has pin-admin-key", () => {
    localStorage.setItem("pin-admin-key", "secret");
    const { result } = renderHook(() => useAuth());
    expect(result.current.auth.role).toBe("admin");
  });

  it("URL token takes precedence over admin localStorage", () => {
    localStorage.setItem("pin-admin-key", "secret");
    window.history.replaceState({}, "", "/?pin-token=ft_test");
    const { result } = renderHook(() => useAuth());
    expect(result.current.auth.role).toBe("tokenHolder");
  });

  it("setAdminKey persists and updates auth", () => {
    const { result } = renderHook(() => useAuth());
    act(() => result.current.setAdminKey("new-secret"));
    expect(result.current.auth.role).toBe("admin");
    expect(localStorage.getItem("pin-admin-key")).toBe("new-secret");
  });

  it("clearAdminKey removes from storage and reverts", () => {
    localStorage.setItem("pin-admin-key", "secret");
    const { result } = renderHook(() => useAuth());
    act(() => result.current.clearAdminKey());
    expect(result.current.auth.role).toBe("anonymous");
    expect(localStorage.getItem("pin-admin-key")).toBeNull();
  });

  it("authHeaders returns correct headers for tokenHolder", () => {
    window.history.replaceState({}, "", "/?pin-token=ft_test");
    const { result } = renderHook(() => useAuth());
    expect(result.current.authHeaders).toEqual({ "X-Pin-Token": "ft_test" });
  });

  it("authHeaders returns admin header for admin", () => {
    localStorage.setItem("pin-admin-key", "secret");
    const { result } = renderHook(() => useAuth());
    expect(result.current.authHeaders).toEqual({ "X-Pin-Admin": "secret" });
  });

  it("authHeaders returns empty for anonymous", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.authHeaders).toEqual({});
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `cd packages/pin-point && pnpm vitest run src/hooks/useAuth.test.ts`
Expected: FAIL — useAuth not exported.

- [ ] **Step 3: Implement useAuth**

```typescript
import { useCallback, useState, useEffect } from "react";
import type { PinAuth, AuthHeaders } from "../types";

const ADMIN_KEY_STORAGE = "pin-admin-key";
const TOKEN_QUERY_PARAM = "pin-token";

const resolveAuth = (): PinAuth => {
  if (typeof window === "undefined") return { role: "anonymous" };

  const params = new URLSearchParams(window.location.search);
  const token = params.get(TOKEN_QUERY_PARAM);
  if (token) return { role: "tokenHolder", token };

  const adminKey = localStorage.getItem(ADMIN_KEY_STORAGE);
  if (adminKey) return { role: "admin", secret: adminKey };

  return { role: "anonymous" };
};

const computeHeaders = (auth: PinAuth): AuthHeaders => {
  switch (auth.role) {
    case "tokenHolder":
      return { "X-Pin-Token": auth.token };
    case "admin":
      return { "X-Pin-Admin": auth.secret };
    case "anonymous":
      return {};
  }
};

export const useAuth = () => {
  const [auth, setAuth] = useState<PinAuth>(resolveAuth);

  useEffect(() => {
    const onPopState = () => setAuth(resolveAuth());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const setAdminKey = useCallback((secret: string) => {
    localStorage.setItem(ADMIN_KEY_STORAGE, secret);
    setAuth(resolveAuth());
  }, []);

  const clearAdminKey = useCallback(() => {
    localStorage.removeItem(ADMIN_KEY_STORAGE);
    setAuth(resolveAuth());
  }, []);

  return {
    auth,
    authHeaders: computeHeaders(auth),
    setAdminKey,
    clearAdminKey,
  };
};
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd packages/pin-point && pnpm vitest run src/hooks/useAuth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point/src/hooks/useAuth.ts \
        packages/pin-point/src/hooks/useAuth.test.ts \
        packages/pin-point/src/types.ts
git commit -m "feat(frontend): add useAuth hook with URL + localStorage resolution"
```

---

### Task 19: AdminKeyModal component

**Files:**
- Create: `packages/pin-point/src/components/AdminKeyModal.tsx`
- Create: `packages/pin-point/src/components/AdminKeyModal.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AdminKeyModal } from "./AdminKeyModal";

describe("AdminKeyModal", () => {
  it("renders input and submit button", () => {
    render(
      <AdminKeyModal
        onValidate={async () => true}
        onSuccess={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByPlaceholderText(/admin key/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });

  it("calls onValidate then onSuccess on valid key", async () => {
    const onValidate = vi.fn(async () => true);
    const onSuccess = vi.fn();
    render(
      <AdminKeyModal
        onValidate={onValidate}
        onSuccess={onSuccess}
        onClose={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/admin key/i), {
      target: { value: "test-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(onValidate).toHaveBeenCalledWith("test-secret");
      expect(onSuccess).toHaveBeenCalledWith("test-secret");
    });
  });

  it("shows error and does NOT call onSuccess when validation fails", async () => {
    const onSuccess = vi.fn();
    render(
      <AdminKeyModal
        onValidate={async () => false}
        onSuccess={onSuccess}
        onClose={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/admin key/i), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid/i)).toBeInTheDocument();
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `cd packages/pin-point && pnpm vitest run src/components/AdminKeyModal.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement modal**

```typescript
import { useState } from "react";

type Props = {
  onValidate: (secret: string) => Promise<boolean>;
  onSuccess: (secret: string) => void;
  onClose: () => void;
};

export function AdminKeyModal({ onValidate, onSuccess, onClose }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      const ok = await onValidate(value);
      if (ok) {
        onSuccess(value);
      } else {
        setError("Invalid admin key");
      }
    } catch {
      setError("Could not reach server");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pp-modal-backdrop" onClick={onClose}>
      <div className="pp-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Enter admin key</h3>
        <input
          type="password"
          placeholder="Admin key"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={busy}
        />
        {error && <div className="pp-modal-error">{error}</div>}
        <div className="pp-modal-actions">
          <button onClick={onClose} disabled={busy}>Cancel</button>
          <button onClick={handleSubmit} disabled={busy || !value}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd packages/pin-point && pnpm vitest run src/components/AdminKeyModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point/src/components/AdminKeyModal.tsx \
        packages/pin-point/src/components/AdminKeyModal.test.tsx
git commit -m "feat(frontend): add AdminKeyModal for admin onboarding"
```

---

### Task 20: ShareLinkButton component

**Files:**
- Create: `packages/pin-point/src/components/ShareLinkButton.tsx`
- Create: `packages/pin-point/src/components/ShareLinkButton.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShareLinkButton } from "./ShareLinkButton";

describe("ShareLinkButton", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(async () => {}) },
    });
  });

  it("renders Share button", () => {
    render(<ShareLinkButton onCreate={async () => ({ tokenId: "ft_x" })} />);
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  });

  it("clicking Share calls onCreate and copies URL with token to clipboard", async () => {
    const onCreate = vi.fn(async () => ({ tokenId: "ft_abc" }));
    render(<ShareLinkButton onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalled();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("pin-token=ft_abc"),
      );
    });
  });

  it("shows confirmation toast after copy", async () => {
    render(<ShareLinkButton onCreate={async () => ({ tokenId: "ft_x" })} />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    await waitFor(() => {
      expect(screen.getByText(/copied/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `cd packages/pin-point && pnpm vitest run src/components/ShareLinkButton.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement component**

```typescript
import { useState } from "react";

type Props = {
  onCreate: (
    label?: string,
    expiresInHours?: number,
  ) => Promise<{ tokenId: string }>;
};

export function ShareLinkButton({ onCreate }: Props) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const { tokenId } = await onCreate();
      const url = new URL(window.location.href);
      url.searchParams.set("pin-token", tokenId);
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pp-share-wrapper">
      <button onClick={handleClick} disabled={busy}>
        Share for feedback
      </button>
      {copied && <span className="pp-share-toast">Link copied</span>}
    </div>
  );
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd packages/pin-point && pnpm vitest run src/components/ShareLinkButton.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point/src/components/ShareLinkButton.tsx \
        packages/pin-point/src/components/ShareLinkButton.test.tsx
git commit -m "feat(frontend): add ShareLinkButton for admins"
```

---

### Task 21: Update FeedbackToolbar with role-based buttons

**Files:**
- Modify: `packages/pin-point/src/components/FeedbackToolbar.tsx`
- Modify: `packages/pin-point/src/components/FeedbackToolbar.test.tsx`
- Modify: `packages/pin-point/src/styles/pin-point.css`

- [ ] **Step 1: Update FeedbackToolbar props and render**

```typescript
import type { PinAuth } from "../types";

type FeedbackToolbarProps = {
  auth: PinAuth;
  commentCount: number;
  pinModeActive: boolean;
  onPinModeToggle: () => void;
  onAdminKeyOpen: () => void;
  shareButton?: React.ReactNode; // injected ShareLinkButton when admin
  error?: string;
};

export function FeedbackToolbar({
  auth,
  commentCount,
  pinModeActive,
  onPinModeToggle,
  onAdminKeyOpen,
  shareButton,
  error,
}: FeedbackToolbarProps) {
  const canComment = auth.role !== "anonymous";
  return (
    <div className="pp-toolbar">
      <button
        className="pp-toolbar-comment-btn"
        onClick={onPinModeToggle}
        disabled={!canComment}
        aria-pressed={pinModeActive}
        title={canComment ? "Add a comment" : "Need a feedback link to comment"}
      >
        💬
      </button>

      {auth.role === "admin" && shareButton}

      <button
        className="pp-toolbar-key-btn"
        onClick={onAdminKeyOpen}
        title="Admin key"
      >
        🔑
      </button>

      {error ? (
        <span className="pp-toolbar-error">{error}</span>
      ) : (
        <span className="pp-toolbar-badge">
          {commentCount} {commentCount === 1 ? "comment" : "comments"}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update toolbar tests**

```typescript
describe("FeedbackToolbar", () => {
  const baseProps = {
    commentCount: 0,
    pinModeActive: false,
    onPinModeToggle: () => {},
    onAdminKeyOpen: () => {},
  };

  it("anonymous: comment button is disabled", () => {
    render(<FeedbackToolbar {...baseProps} auth={{ role: "anonymous" }} />);
    expect(screen.getByRole("button", { name: /add a comment/i })).toBeDisabled();
  });

  it("tokenHolder: comment button is enabled, no admin buttons", () => {
    render(
      <FeedbackToolbar
        {...baseProps}
        auth={{ role: "tokenHolder", token: "ft_x" }}
      />,
    );
    expect(screen.getByTitle(/add a comment/i)).not.toBeDisabled();
    expect(screen.queryByText(/share/i)).not.toBeInTheDocument();
  });

  it("admin: comment + key + share buttons present", () => {
    render(
      <FeedbackToolbar
        {...baseProps}
        auth={{ role: "admin", secret: "x" }}
        shareButton={<button>Share for feedback</button>}
      />,
    );
    expect(screen.getByTitle(/add a comment/i)).not.toBeDisabled();
    expect(screen.getByText(/share for feedback/i)).toBeInTheDocument();
  });

  it("clicking key icon calls onAdminKeyOpen", () => {
    const onAdminKeyOpen = vi.fn();
    render(
      <FeedbackToolbar
        {...baseProps}
        auth={{ role: "anonymous" }}
        onAdminKeyOpen={onAdminKeyOpen}
      />,
    );
    fireEvent.click(screen.getByTitle(/admin key/i));
    expect(onAdminKeyOpen).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Add CSS for new buttons**

In `pin-point.css`, add styles for `.pp-toolbar-comment-btn`, `.pp-toolbar-key-btn`, `.pp-modal-backdrop`, `.pp-modal`, `.pp-share-wrapper`, `.pp-share-toast`. Keep existing toolbar layout — just add buttons inside.

- [ ] **Step 4: Run tests**

Run: `cd packages/pin-point && pnpm vitest run src/components/FeedbackToolbar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point/src/components/FeedbackToolbar.tsx \
        packages/pin-point/src/components/FeedbackToolbar.test.tsx \
        packages/pin-point/src/styles/pin-point.css
git commit -m "feat(frontend): toolbar gains role-aware buttons"
```

---

### Task 22: Update FeedbackOverlay to use auth + pin mode

**Files:**
- Modify: `packages/pin-point/src/FeedbackOverlay.tsx`
- Modify: `packages/pin-point/src/FeedbackOverlay.test.tsx`

- [ ] **Step 1: Replace useQueryParamDetector with useAuth + pinMode state**

Key changes:
- Drop `useQueryParamDetector`
- Add `useAuth()`
- Add `const [pinMode, setPinMode] = useState(false)`
- ClickInterceptLayer only mounts when `pinMode === true`
- Toolbar always renders (no `if (!isActive) return children`)
- After successful pin placement & save, exit pin mode (`setPinMode(false)`)
- AdminKeyModal opens via toolbar key button
- ShareLinkButton injected into toolbar when `auth.role === "admin"`

- [ ] **Step 2: Update callbacks to pass authHeaders**

```typescript
const { auth, authHeaders, setAdminKey, clearAdminKey } = useAuth();

useEffect(() => {
  if (hasFetched.current) return;
  hasFetched.current = true;
  onCommentsFetch(authHeaders).then(setComments).catch(/* ... */);
}, [onCommentsFetch, authHeaders]);

const handleSubmit = async (content: string) => {
  // ... build comment
  await onCommentCreate(comment, authHeaders);
  // ...
  setPinMode(false);
};

const handleDelete = async (id: string) => {
  if (!onCommentDelete) return;
  await onCommentDelete(id, authHeaders);
  // ...
};

const handleUpdate = async (id: string, content: string) => {
  if (!onCommentUpdate) return;
  const updated = await onCommentUpdate(id, content, authHeaders);
  // ...
};
```

- [ ] **Step 3: Wire admin onboarding modal**

```typescript
const [adminModalOpen, setAdminModalOpen] = useState(false);

const handleAdminValidate = async (secret: string) => {
  if (!onAdminValidate) return false;
  return onAdminValidate(secret);
};

const handleAdminSuccess = (secret: string) => {
  setAdminKey(secret);
  setAdminModalOpen(false);
};
```

- [ ] **Step 4: Wire ShareLinkButton**

```typescript
const handleShareCreate = async (label?: string, ttl?: number) => {
  if (!onShareLinkCreate) {
    throw new Error("onShareLinkCreate not provided");
  }
  return onShareLinkCreate(label, ttl, authHeaders);
};

// Pass into toolbar:
<FeedbackToolbar
  auth={auth}
  commentCount={comments.length}
  pinModeActive={pinMode}
  onPinModeToggle={() => setPinMode((p) => !p)}
  onAdminKeyOpen={() => setAdminModalOpen(true)}
  shareButton={
    auth.role === "admin" && onShareLinkCreate ? (
      <ShareLinkButton onCreate={handleShareCreate} />
    ) : undefined
  }
  error={fetchError ?? undefined}
/>
```

- [ ] **Step 5: Update FeedbackOverlay tests**

Drop tests that depend on `?feedback=true`. Add:
- `auth=anonymous → toolbar visible, comment button disabled, no click intercept layer`
- `auth=tokenHolder via URL → comment button enabled, clicking it shows intercept layer`
- `auth=admin via localStorage → share button visible`
- `submit flow with pinMode → onCommentCreate called with comment + auth headers`
- `pinMode exits after successful submit`

```typescript
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

it("anonymous: toolbar visible but comment button disabled", () => {
  render(
    <FeedbackOverlay
      onCommentCreate={async () => {}}
      onCommentsFetch={async () => []}
    >
      <div>App</div>
    </FeedbackOverlay>,
  );
  expect(screen.getByTitle(/admin key/i)).toBeInTheDocument();
  expect(screen.getByTitle(/feedback link/i)).toBeDisabled();
});

it("tokenHolder via URL: clicking comment button enters pin mode", async () => {
  window.history.replaceState({}, "", "/?pin-token=ft_x");
  render(
    <FeedbackOverlay
      onCommentCreate={async () => {}}
      onCommentsFetch={async () => []}
    >
      <div>App</div>
    </FeedbackOverlay>,
  );
  fireEvent.click(screen.getByTitle(/add a comment/i));
  await waitFor(() => {
    expect(document.querySelector(".pp-intercept")).toBeInTheDocument();
  });
});

it("submit flow includes auth headers in callback", async () => {
  window.history.replaceState({}, "", "/?pin-token=ft_x");
  const onCommentCreate = vi.fn(async () => {});
  // ... render, click toolbar, click intercept, type, submit
  expect(onCommentCreate).toHaveBeenCalledWith(
    expect.any(Object),
    { "X-Pin-Token": "ft_x" },
  );
});
```

- [ ] **Step 6: Run all frontend tests**

Run: `cd packages/pin-point && pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/pin-point/src/FeedbackOverlay.tsx \
        packages/pin-point/src/FeedbackOverlay.test.tsx
git commit -m "feat(frontend): wire auth + pin mode into FeedbackOverlay"
```

---

### Task 23: Remove useQueryParamDetector

**Files:**
- Delete: `packages/pin-point/src/hooks/useQueryParamDetector.ts`
- Delete: `packages/pin-point/src/hooks/useQueryParamDetector.test.ts`
- Modify: `packages/pin-point/src/index.ts` (if it exports it)

- [ ] **Step 1: Verify no remaining imports**

Run: `cd packages/pin-point && grep -r useQueryParamDetector src/`
Expected: no results.

- [ ] **Step 2: Delete files**

```bash
rm packages/pin-point/src/hooks/useQueryParamDetector.ts
rm packages/pin-point/src/hooks/useQueryParamDetector.test.ts
```

Update `src/index.ts` to remove the export if present.

- [ ] **Step 3: Run all tests + lint**

Run: `cd packages/pin-point && pnpm test && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/pin-point/src/hooks/ packages/pin-point/src/index.ts
git commit -m "refactor(frontend): remove useQueryParamDetector (replaced by useAuth)"
```

---

## Phase 7: Demo App Integration

### Task 24: Update demo app to provide auth callbacks

**Files:**
- Modify: `packages/pin-point/demo/main.tsx`

- [ ] **Step 1: Update fetch calls to include auth headers**

```typescript
const API = "http://localhost:3000";

<FeedbackOverlay
  onCommentCreate={async (comment, headers) => {
    const res = await fetch(`${API}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(comment),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }}
  onCommentsFetch={async (headers) => {
    const res = await fetch(
      `${API}/comments?url=${encodeURIComponent(window.location.pathname)}`,
      { headers },
    );
    return res.json();
  }}
  onCommentDelete={async (id, headers) => {
    await fetch(`${API}/comments/${id}`, { method: "DELETE", headers });
  }}
  onCommentUpdate={async (id, content, headers) => {
    const res = await fetch(`${API}/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ content }),
    });
    return res.json();
  }}
  onAdminValidate={async (secret) => {
    const res = await fetch(`${API}/admin/tokens`, {
      headers: { "X-Pin-Admin": secret },
    });
    return res.ok;
  }}
  onShareLinkCreate={async (label, expiresInHours, headers) => {
    const res = await fetch(`${API}/admin/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ label, expiresInHours }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const token = await res.json();
    return { tokenId: token.id };
  }}
>
  {/* ... */}
</FeedbackOverlay>
```

- [ ] **Step 2: Smoke test the full flow**

```bash
# Terminal 1: start server
cd packages/pin-point-server
ADMIN_SECRET=test-admin pnpm dev

# Terminal 2: start demo
cd packages/pin-point
pnpm dev
```

Manual test checklist:
- [ ] Open demo in browser → toolbar at bottom, comment button disabled
- [ ] Click key icon → enter "test-admin" → toolbar now shows Share button + comment button enabled
- [ ] Click Share → URL with pin-token copied to clipboard
- [ ] Open clipboard URL in incognito → comment button enabled (token holder mode)
- [ ] Click comment button → click on page → place pin → write feedback → submit
- [ ] Verify pin appears
- [ ] Back in admin tab, click pin → admin can edit + delete
- [ ] In incognito, click pin → no edit/delete buttons (token holder)

- [ ] **Step 3: Commit**

```bash
git add packages/pin-point/demo/main.tsx
git commit -m "feat(demo): wire auth callbacks for token + admin flow"
```

---

## Phase 8: Final Verification

### Task 25: Full test + lint pass

- [ ] **Step 1: Run everything**

```bash
pnpm -r lint
pnpm -r test
```

Expected: ALL PASS, no type errors, no lint errors.

- [ ] **Step 2: Update CLAUDE.md / README if needed**

Document the new env vars (`ADMIN_SECRET`, `PIN_DEFAULT_TOKEN_TTL_HOURS`, `PIN_COMMENT_RETENTION_DAYS`) in the server README.

- [ ] **Step 3: Final commit if README changed**

```bash
git add packages/pin-point-server/README.md
git commit -m "docs(server): document auth env vars"
```

---

## Summary

**Total tasks:** 25
**Backend:** 16 tasks (tasks 1-16)
**Frontend:** 7 tasks (tasks 17-23)
**Demo + verification:** 2 tasks (tasks 24-25)

**Commit count target:** ~20 (some tasks bundle related changes)

**Out of scope (per spec):**
- Multi-tenancy / cloud version
- OAuth / user accounts
- Replies on pinpoints
- Rate limiting, CSRF, audit logs
- Token management UI in frontend
