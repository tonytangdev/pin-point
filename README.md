# pin-point

Visual feedback overlay for web apps. Drop pins on any page, leave comments, persist them.

## Packages

| Package | Description |
|---------|-------------|
| [pin-point](./packages/pin-point) | React component — feedback overlay with pins and comments |
| [pin-point-server](./packages/pin-point-server) | Standalone backend — Postgres-backed comment store |

## Quick Start

```bash
# 1. Add the React component
npm install pin-point

# 2. Start the backend (Postgres via docker compose)
docker compose up -d
ADMIN_SECRET=dev-secret PG_DATABASE=pinpoint PG_PASSWORD=pinpoint npx pin-point-server
```

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

The toolbar is always visible. Anonymous users can view comments; to leave feedback they need a **feedback link** (`?pin-token=<id>`, minted by an admin) or the **admin key** pasted into the toolbar. See each package README for the full callback list.

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT
