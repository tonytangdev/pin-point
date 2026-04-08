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
      onCommentCreate={async (comment) => {
        await fetch(`${API}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(comment),
        });
      }}
      onCommentsFetch={async () => {
        const res = await fetch(`${API}/comments?url=${location.pathname}`);
        return res.json();
      }}
    >
      <YourApp />
    </FeedbackOverlay>
  );
}
```

Activate feedback mode by adding `?feedback=true` to the URL.

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/comments` | Create a comment |
| `GET` | `/comments` | List all comments |
| `GET` | `/comments?url=/page` | List comments for a specific page |
| `DELETE` | `/comments/:id` | Delete a comment |

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

## License

MIT
