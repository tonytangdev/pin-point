# pin-point

Visual feedback overlay for web apps. Drop pins on any page, leave comments, persist them.

## Packages

| Package | Description |
|---------|-------------|
| [pin-point](./packages/pin-point) | React component — feedback overlay with pins and comments |
| [pin-point-server](./packages/pin-point-server) | Standalone backend — stores comments in SQLite, zero config |

## Quick Start

```bash
# 1. Add the React component
npm install pin-point

# 2. Start the backend (no install needed)
npx pin-point-server
```

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

Add `?feedback=true` to any URL to activate feedback mode. Share the link with reviewers.

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT
