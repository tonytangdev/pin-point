# pin-point

Visual feedback overlay for React. Drop pins on any page, leave comments.

## Install

```bash
npm install pin-point
```

## Usage

```tsx
import { FeedbackOverlay } from 'pin-point';
import 'pin-point/styles.css';

function App() {
  return (
    <FeedbackOverlay
      onCommentCreate={async (comment) => {
        // Send to your backend
      }}
      onCommentsFetch={async () => {
        // Fetch from your backend
        return [];
      }}
    >
      <YourApp />
    </FeedbackOverlay>
  );
}
```

Activate feedback mode by adding `?feedback=true` to the URL. Share this link with reviewers.

### With pin-point-server

If you don't want to build your own backend, use [pin-point-server](https://www.npmjs.com/package/pin-point-server):

```bash
npx pin-point-server
```

```tsx
const API = 'http://localhost:3000';

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
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onCommentCreate` | `(comment: PinComment) => Promise<void>` | Yes | Called when user submits a comment |
| `onCommentsFetch` | `() => Promise<PinComment[]>` | Yes | Called on mount to load existing comments |
| `queryParam` | `string` | No | Query param name. Default: `"feedback"` |

## PinComment

```ts
type PinComment = {
  id: string;
  url: string;
  content: string;
  anchor: {
    selector: string;
    xPercent: number;
    yPercent: number;
  };
  viewport: { width: number };
  createdAt: string;
};
```

## License

MIT
