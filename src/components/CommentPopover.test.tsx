import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommentPopover } from "./CommentPopover";

describe("CommentPopover — read mode", () => {
  it("renders comment content", () => {
    render(
      <CommentPopover
        mode="read"
        content="Fix the heading"
        createdAt="2026-04-08T12:00:00Z"
        viewportWidth={1440}
        top={100}
        left={200}
      />
    );
    expect(screen.getByText("Fix the heading")).toBeInTheDocument();
  });

  it("shows viewport width", () => {
    render(
      <CommentPopover
        mode="read"
        content="Fix it"
        createdAt="2026-04-08T12:00:00Z"
        viewportWidth={1440}
        top={100}
        left={200}
      />
    );
    expect(screen.getByText(/1440px/)).toBeInTheDocument();
  });
});

describe("CommentPopover — create mode", () => {
  it("renders a textarea", () => {
    render(
      <CommentPopover
        mode="create"
        top={100}
        left={200}
        onSubmit={async () => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByPlaceholderText("Leave your feedback...")).toBeInTheDocument();
  });

  it("calls onSubmit with text content", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CommentPopover
        mode="create"
        top={100}
        left={200}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );

    const textarea = screen.getByPlaceholderText("Leave your feedback...");
    fireEvent.change(textarea, { target: { value: "Needs more contrast" } });
    fireEvent.click(screen.getByText("Submit"));

    expect(onSubmit).toHaveBeenCalledWith("Needs more contrast");
  });

  it("calls onCancel when cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <CommentPopover
        mode="create"
        top={100}
        left={200}
        onSubmit={async () => {}}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("disables submit when textarea is empty", () => {
    render(
      <CommentPopover
        mode="create"
        top={100}
        left={200}
        onSubmit={async () => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByText("Submit")).toBeDisabled();
  });

  it("shows error message on submit failure", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("fail"));
    render(
      <CommentPopover
        mode="create"
        top={100}
        left={200}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );

    const textarea = screen.getByPlaceholderText("Leave your feedback...");
    fireEvent.change(textarea, { target: { value: "test" } });
    fireEvent.click(screen.getByText("Submit"));

    expect(await screen.findByText("Couldn't save. Try again.")).toBeInTheDocument();
  });
});
