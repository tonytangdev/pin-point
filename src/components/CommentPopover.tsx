import { useState } from "react";

type ReadProps = {
  mode: "read";
  content: string;
  createdAt: string;
  viewportWidth: number;
  top: number;
  left: number;
  onSubmit?: never;
  onCancel?: never;
};

type CreateProps = {
  mode: "create";
  top: number;
  left: number;
  onSubmit: (content: string) => Promise<void>;
  onCancel: () => void;
  content?: never;
  createdAt?: never;
  viewportWidth?: never;
};

type CommentPopoverProps = ReadProps | CreateProps;

export function CommentPopover(props: CommentPopoverProps) {
  const { mode, top, left } = props;

  return (
    <div
      className="pp-popover"
      style={{ top: `${top + 14}px`, left: `${left}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="pp-popover-arrow" />
      {mode === "read" ? (
        <ReadContent
          content={props.content}
          createdAt={props.createdAt}
          viewportWidth={props.viewportWidth}
        />
      ) : (
        <CreateContent onSubmit={props.onSubmit} onCancel={props.onCancel} />
      )}
    </div>
  );
}

function ReadContent({
  content,
  createdAt,
  viewportWidth,
}: {
  content: string;
  createdAt: string;
  viewportWidth: number;
}) {
  const date = new Date(createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <div className="pp-popover-content">{content}</div>
      <div className="pp-popover-meta">
        {date} · {viewportWidth}px viewport
      </div>
    </>
  );
}

function CreateContent({
  onSubmit,
  onCancel,
}: {
  onSubmit: (content: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(text);
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <textarea
        className="pp-popover-textarea"
        placeholder="Leave your feedback..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <div className="pp-popover-actions">
        <button className="pp-btn pp-btn--cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="pp-btn pp-btn--submit"
          onClick={handleSubmit}
          disabled={text.trim().length === 0 || submitting}
        >
          Submit
        </button>
      </div>
      {error && <div className="pp-popover-error">{error}</div>}
    </>
  );
}
