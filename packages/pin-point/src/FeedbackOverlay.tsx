import { useState, useEffect, useCallback, useRef } from "react";
import type { FeedbackOverlayProps, PinComment, PendingPin } from "./types";
import { useQueryParamDetector } from "./hooks/useQueryParamDetector";
import { resolveAnchor } from "./utils/resolveAnchor";
import { restorePosition } from "./utils/restorePosition";
import { ClickInterceptLayer } from "./components/ClickInterceptLayer";
import { PinMarker } from "./components/PinMarker";
import { CommentPopover } from "./components/CommentPopover";
import { FeedbackToolbar } from "./components/FeedbackToolbar";

export function FeedbackOverlay({
  onCommentCreate,
  onCommentsFetch,
  onCommentDelete,
  onCommentUpdate,
  queryParam = "feedback",
  children,
}: FeedbackOverlayProps) {
  const isActive = useQueryParamDetector(queryParam);
  const [comments, setComments] = useState<PinComment[]>([]);
  const [pendingPin, setPendingPin] = useState<PendingPin | null>(null);
  const [expandedPinId, setExpandedPinId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!isActive || hasFetched.current) return;
    hasFetched.current = true;

    onCommentsFetch()
      .then((data) => setComments([...data]))
      .catch(() => setFetchError("Couldn't load comments."));
  }, [isActive, onCommentsFetch]);

  const handleClick = useCallback(
    (clientX: number, clientY: number) => {
      setExpandedPinId(null);

      const interceptLayer = document.querySelector(".pp-intercept") as HTMLElement;
      if (interceptLayer) interceptLayer.style.pointerEvents = "none";
      const elementBelow = document.elementFromPoint(clientX, clientY);
      if (interceptLayer) interceptLayer.style.pointerEvents = "";

      if (!elementBelow) return;

      const anchor = resolveAnchor(elementBelow, clientX, clientY);
      setPendingPin({
        x: clientX + window.scrollX,
        y: clientY + window.scrollY,
        anchor,
      });
    },
    []
  );

  const handleSubmit = useCallback(
    async (content: string) => {
      if (!pendingPin) return;

      const comment: PinComment = {
        id: crypto.randomUUID(),
        url: window.location.pathname,
        content,
        anchor: pendingPin.anchor,
        viewport: { width: window.innerWidth },
        createdAt: new Date().toISOString(),
      };

      await onCommentCreate(comment);
      setComments((prev) => [...prev, comment]);
      setPendingPin(null);
    },
    [pendingPin, onCommentCreate]
  );

  const handleCancel = useCallback(() => {
    setPendingPin(null);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!onCommentDelete) return;
      await onCommentDelete(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
      setExpandedPinId(null);
    },
    [onCommentDelete]
  );

  const handleUpdate = useCallback(
    async (id: string, content: string) => {
      if (!onCommentUpdate) return;
      const updated = await onCommentUpdate(id, content);
      setComments((prev) =>
        prev.map((c) => (c.id === id ? updated : c))
      );
    },
    [onCommentUpdate]
  );

  if (!isActive) {
    return <>{children}</>;
  }

  return (
    <div data-pin-point="">
      {children}
      <ClickInterceptLayer onClick={handleClick} />

      {comments.map((comment, index) => {
        const pos = restorePosition(comment.anchor);
        if (!pos) return null;

        return (
          <PinMarker
            key={comment.id}
            number={index + 1}
            top={pos.top}
            left={pos.left}
            onClick={() =>
              setExpandedPinId(
                expandedPinId === comment.id ? null : comment.id
              )
            }
          />
        );
      })}

      {expandedPinId &&
        (() => {
          const comment = comments.find((c) => c.id === expandedPinId);
          if (!comment) return null;
          const pos = restorePosition(comment.anchor);
          if (!pos) return null;

          return (
            <CommentPopover
              mode="read"
              content={comment.content}
              createdAt={comment.createdAt}
              viewportWidth={comment.viewport.width}
              top={pos.top}
              left={pos.left}
              onDelete={onCommentDelete ? () => handleDelete(comment.id) : undefined}
              onUpdate={
                onCommentUpdate
                  ? async (content: string) => {
                      await handleUpdate(comment.id, content);
                    }
                  : undefined
              }
            />
          );
        })()}

      {pendingPin && (
        <>
          <PinMarker
            number={comments.length + 1}
            top={pendingPin.y}
            left={pendingPin.x}
            onClick={() => {}}
          />
          <CommentPopover
            mode="create"
            top={pendingPin.y}
            left={pendingPin.x}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </>
      )}

      <FeedbackToolbar
        commentCount={comments.length}
        error={fetchError ?? undefined}
      />
    </div>
  );
}
