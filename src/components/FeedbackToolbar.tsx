type FeedbackToolbarProps = {
  commentCount: number;
  error?: string;
};

export function FeedbackToolbar({ commentCount, error }: FeedbackToolbarProps) {
  return (
    <div className="pp-toolbar">
      <div className="pp-toolbar-dot" />
      <span>Click anywhere to leave feedback</span>
      {error ? (
        <span className="pp-toolbar-error">{error}</span>
      ) : (
        <span className="pp-toolbar-badge">
          {commentCount} {commentCount === 1 ? "comment" : "comments"}
        </span>
      )}
    </div>
  );
}
