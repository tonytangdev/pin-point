# pin-point-server

Backend server for [pin-point](https://www.npmjs.com/package/pin-point). Stores and serves feedback comments so they persist across sessions.

## Quick Start

```bash
npx pin-point-server
```

Server starts on `http://localhost:3000`. Comments are stored in a local SQLite file (`./pin-point.db`).

### Docker

```bash
docker run -p 3000:3000 -v pin-point-data:/data pin-point-server
```

## Connect to pin-point

```tsx
import { FeedbackOverlay } from 'pin-point';
import 'pin-point/styles.css';

const API = 'http://localhost:3000';

function App() {
  return (
    <FeedbackOverlay
      onCommentCreate={async (comment, authHeaders) => {
        await fetch(`${API}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(comment),
        });
      }}
      onCommentsFetch={async (authHeaders) => {
        const res = await fetch(
          `${API}/comments?url=${location.pathname}`,
          { headers: authHeaders },
        );
        return res.json();
      }}
    >
      <YourApp />
    </FeedbackOverlay>
  );
}
```

The toolbar is always visible. To leave feedback, users need a feedback link (`?pin-token=<id>`) or an admin key. See the pin-point README for the full callback list.

## API

### Auth headers

| Header | Description |
|--------|-------------|
| `X-Pin-Admin: <secret>` | Admin authentication (matches `ADMIN_SECRET` env var) |
| `X-Pin-Token: <ft_...>` | Feedback token (minted via `POST /admin/tokens`) |

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/comments` | public | List all comments |
| `GET` | `/comments?url=/page` | public | List comments for a specific page |
| `POST` | `/comments` | token or admin | Create a comment |
| `PATCH` | `/comments/:id` | admin | Update a comment's content |
| `DELETE` | `/comments/:id` | admin | Delete a comment |
| `POST` | `/admin/tokens` | admin | Mint a feedback-link token |
| `GET` | `/admin/tokens` | admin | List active feedback-link tokens |
| `DELETE` | `/admin/tokens/:id` | admin | Revoke a feedback-link token |

### POST /comments

Request body matches the `PinComment` type from pin-point. `id` and `createdAt` are auto-generated if omitted.

```json
{
  "url": "/dashboard",
  "content": "Button is misaligned",
  "anchor": { "selector": "#hero", "xPercent": 50, "yPercent": 30 },
  "viewport": { "width": 1440 }
}
```

Returns `201` with the full comment object.

### GET /comments

Returns an array of comments. Use `?url=/path` to filter by page.

### DELETE /comments/:id

Returns `204` on success, `404` if not found.

## Configuration

All via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATABASE_URL` | `./pin-point.db` | SQLite file path |
| `CORS_ORIGIN` | `*` | Allowed CORS origin(s) |
| `ADMIN_SECRET` | _(required)_ | Shared secret for admin endpoints. Sent via `X-Pin-Admin` header to mint share-link tokens and perform admin operations. |
| `PIN_DEFAULT_TOKEN_TTL_HOURS` | _(unlimited)_ | Default TTL (in hours) applied to newly minted share-link tokens when the caller omits `expiresInHours`. Unset = tokens never expire by default. |
| `PIN_COMMENT_RETENTION_DAYS` | _(unlimited)_ | Reserved for future use: intended retention window (in days) for comments. Not yet enforced by the server. |

## License

MIT
