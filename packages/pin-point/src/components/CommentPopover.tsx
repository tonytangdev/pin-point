import { useState } from "react";

type ReadProps = {
  mode: "read";
  content: string;
  createdAt: string;
  viewportWidth: number;
  top: number;
  left: number;
  onDelete?: () => void;
  onUpdate?: (content: string) => Promise<void>;
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
          onDelete={props.onDelete}
          onUpdate={props.onUpdate}
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
  onDelete,
  onUpdate,
}: {
  content: string;
  createdAt: string;
  viewportWidth: number;
  onDelete?: () => void;
  onUpdate?: (content: string) => Promise<void>;
}) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [saving, setSaving] = useState(false);

  const date = new Date(createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (isEditing) {
    return (
      <>
        <textarea
          className="pp-popover-textarea"
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          autoFocus
        />
        <div className="pp-popover-actions">
          <button
            className="pp-btn pp-btn--cancel"
            onClick={() => {
              setIsEditing(false);
              setEditContent(content);
            }}
          >
            Cancel
          </button>
          <button
            className="pp-btn pp-btn--submit"
            disabled={editContent.trim().length === 0 || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onUpdate!(editContent);
                setIsEditing(false);
              } finally {
                setSaving(false);
              }
            }}
          >
            Save
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {(onDelete || onUpdate) && (
        <div className="pp-popover-toolbar">
          {onUpdate && (
            <button
              className="pp-icon-btn"
              aria-label="Edit"
              onClick={() => setIsEditing(true)}
            >
              &#9998;
            </button>
          )}
          {onDelete && !isConfirmingDelete && (
            <button
              className="pp-icon-btn pp-icon-btn--danger"
              aria-label="Delete"
              onClick={() => setIsConfirmingDelete(true)}
            >
              &#128465;
            </button>
          )}
          {isConfirmingDelete && (
            <span className="pp-confirm">
              Delete?{" "}
              <button className="pp-confirm-btn" onClick={onDelete}>
                Yes
              </button>
              {" / "}
              <button
                className="pp-confirm-btn"
                onClick={() => setIsConfirmingDelete(false)}
              >
                No
              </button>
            </span>
          )}
        </div>
      )}
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
