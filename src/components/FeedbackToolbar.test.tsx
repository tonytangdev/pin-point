import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeedbackToolbar } from "./FeedbackToolbar";

describe("FeedbackToolbar", () => {
  it("renders instruction text", () => {
    render(<FeedbackToolbar commentCount={0} />);
    expect(screen.getByText("Click anywhere to leave feedback")).toBeInTheDocument();
  });

  it("shows comment count", () => {
    render(<FeedbackToolbar commentCount={3} />);
    expect(screen.getByText("3 comments")).toBeInTheDocument();
  });

  it("shows singular for 1 comment", () => {
    render(<FeedbackToolbar commentCount={1} />);
    expect(screen.getByText("1 comment")).toBeInTheDocument();
  });

  it("shows error message when provided", () => {
    render(<FeedbackToolbar commentCount={0} error="Couldn't load comments." />);
    expect(screen.getByText("Couldn't load comments.")).toBeInTheDocument();
  });
});
