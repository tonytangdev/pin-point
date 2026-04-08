import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FeedbackOverlay } from "./FeedbackOverlay";
import type { PinComment } from "./types";

const mockComment: PinComment = {
  id: "1",
  url: "/",
  content: "Fix this heading",
  anchor: { selector: "#test", xPercent: 50, yPercent: 50 },
  viewport: { width: 1440 },
  createdAt: "2026-04-08T12:00:00Z",
};

describe("FeedbackOverlay", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("renders children when feedback mode is off", () => {
    render(
      <FeedbackOverlay
        onCommentCreate={async () => {}}
        onCommentsFetch={async () => []}
      >
        <div>My App</div>
      </FeedbackOverlay>
    );

    expect(screen.getByText("My App")).toBeInTheDocument();
    expect(screen.queryByText("Click anywhere to leave feedback")).not.toBeInTheDocument();
  });

  it("renders overlay when feedback mode is on", async () => {
    window.history.replaceState({}, "", "/?feedback=true");

    render(
      <FeedbackOverlay
        onCommentCreate={async () => {}}
        onCommentsFetch={async () => []}
      >
        <div>My App</div>
      </FeedbackOverlay>
    );

    expect(screen.getByText("My App")).toBeInTheDocument();
    expect(screen.getByText("Click anywhere to leave feedback")).toBeInTheDocument();
  });

  it("loads and displays existing comments", async () => {
    window.history.replaceState({}, "", "/?feedback=true");

    const target = document.createElement("div");
    target.id = "test";
    document.body.appendChild(target);

    render(
      <FeedbackOverlay
        onCommentCreate={async () => {}}
        onCommentsFetch={async () => [mockComment]}
      >
        <div>My App</div>
      </FeedbackOverlay>
    );

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    target.remove();
  });

  it("shows error in toolbar when fetch fails", async () => {
    window.history.replaceState({}, "", "/?feedback=true");

    render(
      <FeedbackOverlay
        onCommentCreate={async () => {}}
        onCommentsFetch={async () => { throw new Error("fail"); }}
      >
        <div>My App</div>
      </FeedbackOverlay>
    );

    await waitFor(() => {
      expect(screen.getByText("Couldn't load comments.")).toBeInTheDocument();
    });
  });

  it("uses custom query param", () => {
    window.history.replaceState({}, "", "/?review=true");

    render(
      <FeedbackOverlay
        onCommentCreate={async () => {}}
        onCommentsFetch={async () => []}
        queryParam="review"
      >
        <div>My App</div>
      </FeedbackOverlay>
    );

    expect(screen.getByText("Click anywhere to leave feedback")).toBeInTheDocument();
  });
});
