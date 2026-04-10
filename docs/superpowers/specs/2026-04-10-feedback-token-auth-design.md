# Feedback Token Auth (MVP)

## Summary

Add authentication to pin-point so the server can be hosted publicly. Three roles:

- **Anonymous** — can read comments only
- **Token holder** — has a feedback link, can create comments
- **Admin** — has the admin secret, can manage tokens and moderate comments

Single-tenant MVP. `ADMIN_SECRET` env var = admin. Feedback tokens stored in DB. Designed so OAuth identity and multi-tenant cloud can slot in later without breaking changes.

## Goals

- Self-hostable server with simple auth
- Zero-friction reviewer experience: open link → comment
- Admin generates share links from toolbar (no curl)
- Schema ready for future identity (OAuth) without migration churn

## Non-goals (MVP)

- Multi-tenancy / cloud version
- OAuth / user accounts
- Replies on pinpoints
- Rate limiting, CSRF, audit logs
- Token management UI in frontend
- Frontend tests

## Architecture

```
┌──────────────────────────────────────────────────┐
│  Frontend (pin-point React component)            │
│  ─────────────────────────────────────           │
│  Bottom toolbar (always visible)                 │
│  Reads: ?pin-token=ft_xxx from URL               │
│  Reads: pin-admin-key from localStorage          │
│  Sends: token in `X-Pin-Token` header            │
│  Sends: admin in `X-Pin-Admin` header            │
└──────────────────────────────────────────────────┘
                    ↓ HTTPS
┌──────────────────────────────────────────────────┐
│  Backend (pin-point-server, Hono + Effect)       │
│  ─────────────────────────────────────           │
│  authMiddleware → resolves request to:           │
│     "anonymous" / "tokenHolder" / "admin"        │
│                                                  │
│  Routes:                                         │
│    GET    /comments         → public             │
│    POST   /comments         → tokenHolder+       │
│    PATCH  /comments/:id     → admin              │
│    DELETE /comments/:id     → admin              │
│    POST   /admin/tokens     → admin              │
│    GET    /admin/tokens     → admin              │
│    DELETE /admin/tokens/:id → admin              │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│  PostgreSQL                                      │
│  ─────────────                                   │
│  comments  (existing, + nullable author fields)  │
│  tokens    (new)                                 │
└──────────────────────────────────────────────────┘
```

## Configuration

Server env vars:

```bash
ADMIN_SECRET=as_long_random_string         # required
PIN_DEFAULT_TOKEN_TTL_HOURS=168            # optional, null/unset = unlimited
PIN_COMMENT_RETENTION_DAYS=90              # optional, null/unset = unlimited
```

`ADMIN_SECRET` is the only required addition. TTLs are deploy-time decisions. Restart to change.

## Data Model

### `comments` table — modify existing

```sql
ALTER TABLE comments ADD COLUMN author_name TEXT;
ALTER TABLE comments ADD COLUMN author_id   TEXT;
ALTER TABLE comments ADD COLUMN token_id    TEXT;
```

- `author_name` / `author_id` stay null in MVP. OAuth fills them later.
- `token_id` traces a comment back to the token that created it. Useful for cleanup, future identity.

### `tokens` table — new

```sql
CREATE TABLE tokens (
  id          TEXT PRIMARY KEY,           -- "ft_" + random (e.g. ft_a1b2c3...)
  label       TEXT,                       -- optional: "Alice", "client demo"
  created_at  TIMESTAMPTZ NOT NULL,
  expires_at  TIMESTAMPTZ,                -- null = unlimited
  revoked_at  TIMESTAMPTZ                 -- null = active
);

CREATE INDEX idx_tokens_active ON tokens(id) WHERE revoked_at IS NULL;
```

Token is **active** when:
```
revoked_at IS NULL
AND (expires_at IS NULL OR expires_at > NOW())
```

Soft delete (`revoked_at`) preserves `comments.token_id` references.

## Auth Middleware

Resolves request identity once, before routes run.

```typescript
type AuthContext =
  | { role: "anonymous" }
  | { role: "tokenHolder"; tokenId: string }
  | { role: "admin" }

const authMiddleware = (req) => Effect.gen(function* () {
  const adminHeader = req.header("X-Pin-Admin")
  const tokenHeader = req.header("X-Pin-Token")

  // 1. Admin?
  if (adminHeader && constantTimeEqual(adminHeader, env.ADMIN_SECRET)) {
    return { role: "admin" }
  }

  // 2. Token holder?
  if (tokenHeader) {
    const token = yield* tokenRepo.findActive(tokenHeader)
    if (token) return { role: "tokenHolder", tokenId: token.id }
  }

  // 3. Anonymous
  return { role: "anonymous" }
})
```

Use `crypto.timingSafeEqual` for the admin secret comparison to prevent timing attacks.

Routes guard themselves against the resolved role:

| Route | Required role |
|-------|---------------|
| `GET /comments` | any |
| `POST /comments` | tokenHolder, admin |
| `PATCH /comments/:id` | admin |
| `DELETE /comments/:id` | admin |
| `POST /admin/tokens` | admin |
| `GET /admin/tokens` | admin |
| `DELETE /admin/tokens/:id` | admin |

## API Endpoints

### Comments

```
GET    /comments?url=/page    → public
  Returns: PinComment[]

POST   /comments              → tokenHolder | admin
  Headers: X-Pin-Token: ft_xxx (or X-Pin-Admin: as_xxx)
  Body:    { url, content, anchor, viewport }
  Effect:  inserts row; sets token_id from auth context (null if admin)
  Returns: PinComment (201)

PATCH  /comments/:id          → admin
  Headers: X-Pin-Admin
  Body:    { content }
  Returns: PinComment (200)

DELETE /comments/:id          → admin
  Headers: X-Pin-Admin
  Returns: 204
```

### Tokens

```
POST   /admin/tokens          → admin
  Body:    { label?, expiresInHours? }
  Effect:  generates "ft_" + random id;
           if expiresInHours null, falls back to PIN_DEFAULT_TOKEN_TTL_HOURS;
           if both null, expires_at = NULL (unlimited)
  Returns: { id, label, createdAt, expiresAt } (201)

GET    /admin/tokens          → admin
  Returns: Token[] (active + revoked)

DELETE /admin/tokens/:id      → admin
  Effect:  sets revoked_at = NOW()
  Returns: 204
```

## Frontend Component Changes

Toolbar stays at the bottom (current placement).

### Auth context (new)

```typescript
type PinAuth =
  | { role: "anonymous" }
  | { role: "tokenHolder"; token: string }
  | { role: "admin"; secret: string }
```

Resolved on mount:
1. `?pin-token=` query param → `tokenHolder`
2. `localStorage["pin-admin-key"]` → `admin`
3. Else → `anonymous`

### Behavior by role

| Role | Can read | Can comment | Sees admin buttons |
|------|---------|-------------|-------------------|
| Anonymous | yes | no (button disabled, tooltip: "need a feedback link") | no |
| Token holder | yes | yes | no |
| Admin | yes | yes | yes |

### Admin onboarding

- Toolbar has small key icon
- Click → modal → paste admin secret
- Validates against server (`GET /admin/tokens` as ping)
- On success: stored in `localStorage["pin-admin-key"]`
- On failure: error, not stored

### Share for feedback (admin only)

- "Share" button on toolbar
- Click → optional label input → `POST /admin/tokens`
- Builds link: `window.location.href + "?pin-token=" + token.id`
- Copies to clipboard, toast: "link copied"

### API client

- Reads auth context from component state
- Sets `X-Pin-Token` or `X-Pin-Admin` header automatically based on role

### Cut from MVP

- Token management UI (list, revoke). Admin can revoke via API directly for now.

## Errors

```
401 Unauthorized   → missing or invalid auth where required
403 Forbidden      → valid auth, insufficient role
404 Not Found      → comment/token doesn't exist
400 Bad Request    → schema validation failure
500 Internal       → unexpected DB or server error
```

Body: `{ error: string, code: string }`

## Testing

Backend behavioral tests only.

### Auth middleware

- Admin secret valid → role admin
- Token valid + active → role tokenHolder
- Token expired → role anonymous
- Token revoked → role anonymous
- No headers → role anonymous

### Comment routes

- `POST /comments` anonymous → 401
- `POST /comments` with valid token → 201, `token_id` set
- `POST /comments` with admin → 201
- `PATCH /comments/:id` with token → 403
- `PATCH /comments/:id` with admin → 200
- `DELETE /comments/:id` with token → 403
- `DELETE /comments/:id` with admin → 204
- `GET /comments` anonymous → 200

### Token routes

- `POST /admin/tokens` non-admin → 401
- `POST /admin/tokens` admin → 201
- `POST /admin/tokens` with `expiresInHours` → expires_at correct
- `POST /admin/tokens` no TTL + no env default → expires_at null
- `DELETE /admin/tokens/:id` admin → 204, revoked_at set

## Future Considerations (out of scope)

- **OAuth identity** — slots into auth middleware as a fourth check before token. `comments.author_name` / `author_id` already exist.
- **Replies on pinpoints** — once identity exists (via token label or OAuth), threading is straightforward.
- **Multi-tenant cloud** — separate package (`pin-point-cloud`) wraps `pin-point-server`, adds tenant table, provisions per-tenant admin keys. OSS core stays single-tenant.
- **Rate limiting** — per-token, per-IP. Add when abuse appears.
- **Token management UI** — list, revoke, label edit.
