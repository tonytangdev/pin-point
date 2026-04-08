# pin-point-server Design Spec

Standalone backend server for the pin-point feedback overlay library. Stores and serves `PinComment` objects so frontend consumers don't need to build their own persistence layer.

## Decisions

- **Standalone self-hosted server** — not a framework adapter
- **Hono** framework (runs on Node, Bun, Deno)
- **Pluggable DB** — SQLite default, Postgres and MySQL as optional adapters
- **No auth** — users handle auth externally (reverse proxy, VPN, etc.)
- **Separate npm package** (`pin-point-server`) in the existing monorepo
- **Full layered architecture** — Routes → Service → Repository

## Architecture

```
React App + pin-point (frontend)
        ↓ HTTP
┌─────────────────────────────────┐
│  pin-point-server (Hono)        │
│  ┌──────┐  ┌───────┐  ┌──────┐ │
│  │Routes│→ │Service│→ │ Repo │ │
│  └──────┘  └───────┘  └──────┘ │
└─────────────────────────────────┘
        ↓ implements
  ┌────────┬──────────┬───────┐
  │ SQLite │ Postgres │ MySQL │
  └────────┴──────────┴───────┘
```

### Monorepo Structure

```
pin-point/
├── packages/
│   ├── pin-point/              ← existing frontend lib (moved here)
│   │   ├── src/
│   │   ├── package.json        (name: "pin-point")
│   │   └── tsconfig.json
│   └── pin-point-server/       ← new backend package
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── repositories/
│       │   └── index.ts
│       ├── package.json        (name: "pin-point-server")
│       ├── Dockerfile
│       └── tsconfig.json
├── demo/
├── package.json                (workspaces root)
└── pnpm-workspace.yaml
```

## API Endpoints

| Method   | Path              | Description                                      |
|----------|-------------------|--------------------------------------------------|
| `POST`   | `/comments`       | Create a comment (body = `PinComment`)           |
| `GET`    | `/comments?url=X` | Fetch comments, optionally filtered by page URL  |
| `DELETE`  | `/comments/:id`   | Delete a single comment                          |

- `GET /comments` without `?url` returns all comments
- Server accepts client-generated `id` and `createdAt` but generates them server-side if missing
- CORS enabled by default (configurable origin)

## Repository Interface

```typescript
interface CommentRepository {
  create(comment: PinComment): Promise<PinComment>;
  findByUrl(url: string): Promise<PinComment[]>;
  findAll(): Promise<PinComment[]>;
  deleteById(id: string): Promise<void>;
}
```

## Database Schema

Single `comments` table:

| Column         | Type            | Notes                                        |
|----------------|-----------------|----------------------------------------------|
| `id`           | TEXT / UUID      | PK                                           |
| `url`          | TEXT             | Page pathname, indexed                       |
| `content`      | TEXT             | Comment body                                 |
| `anchor`       | JSON / TEXT      | `{ selector, xPercent, yPercent }` as JSON   |
| `viewport_width` | INTEGER        | From `viewport.width`                        |
| `created_at`   | TEXT / TIMESTAMP | ISO string                                   |

- Index on `url` for filtered queries
- Each adapter handles JSON serialization for its DB engine
- Auto-migration on startup: creates table if not exists

## Configuration

All via environment variables:

| Env Var       | Default         | Description               |
|---------------|-----------------|---------------------------|
| `PORT`        | `3000`          | Server port               |
| `HOST`        | `0.0.0.0`      | Bind address              |
| `DB_ADAPTER`  | `sqlite`        | `sqlite`, `postgres`, `mysql` |
| `DATABASE_URL` | `./pin-point.db` | Connection string (file path for SQLite) |
| `CORS_ORIGIN` | `*`             | Allowed origin(s)         |

## Deployment

### Docker

```bash
docker run -p 3000:3000 -v pin-point-data:/data pin-point-server
```

SQLite DB file mountable as a volume at `/data/pin-point.db`.

### Direct

```bash
npx pin-point-server
# or
npm install -g pin-point-server && pin-point-server
```

## Frontend Integration

```tsx
<FeedbackOverlay
  onCommentCreate={(c) => fetch('http://localhost:3000/comments', {
    method: 'POST',
    body: JSON.stringify(c),
    headers: { 'Content-Type': 'application/json' }
  })}
  onCommentsFetch={() =>
    fetch('http://localhost:3000/comments?url=' + location.pathname)
      .then(r => r.json())
  }
>
  <App />
</FeedbackOverlay>
```

## Testing

- **Repository**: Integration tests per adapter (SQLite against temp file, Postgres/MySQL against test containers)
- **Service**: Unit tests with in-memory repository
- **Routes**: Integration tests using Hono's test client with in-memory repo
- **E2E**: Full server boot with SQLite + real HTTP calls

## Error Handling

- Validation errors → `400` with `{ error: "message" }`
- Not found → `404`
- DB errors → `500` with generic message (no internals leaked)

## Validation

- `POST /comments`: required fields — `content`, `anchor` (`selector`, `xPercent`, `yPercent`), `url`
- Zod schemas via `@hono/zod-validator`
