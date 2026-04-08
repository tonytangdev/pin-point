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
        await fetch('/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(comment),
        });
      }}
      onCommentsFetch={async () => {
        const res = await fetch(`/api/comments?url=${window.location.pathname}`);
        return res.json();
      }}
    >
      <YourApp />
    </FeedbackOverlay>
  );
}
```

Activate feedback mode by adding `?feedback=true` to the URL. Share this link with reviewers.

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
