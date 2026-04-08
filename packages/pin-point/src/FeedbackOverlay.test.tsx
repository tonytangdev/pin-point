import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

  describe("interaction", () => {
    beforeEach(() => {
      window.history.replaceState({}, "", "/?feedback=true");
      // Make elementFromPoint return a real element so handleClick doesn't bail
      document.elementFromPoint = vi.fn().mockReturnValue(document.body);
      // Deterministic UUID
      vi.spyOn(crypto, "randomUUID").mockReturnValue(
        "test-uuid-0000-0000-0000-000000000000"
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
      // @ts-expect-error reset jsdom stub
      delete document.elementFromPoint;
    });

    it("click-to-pin: clicking intercept layer creates pending pin", async () => {
      render(
        <FeedbackOverlay
          onCommentCreate={async () => {}}
          onCommentsFetch={async () => []}
        >
          <div>My App</div>
        </FeedbackOverlay>
      );

      const intercept = document.querySelector(".pp-intercept") as HTMLElement;
      fireEvent.click(intercept, { clientX: 100, clientY: 200 });

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Leave your feedback...")
        ).toBeInTheDocument();
      });
    });

    it("submit flow: typing and clicking Submit calls onCommentCreate and adds pin", async () => {
      const onCommentCreate = vi.fn(async () => {});

      render(
        <FeedbackOverlay
          onCommentCreate={onCommentCreate}
          onCommentsFetch={async () => []}
        >
          <div>My App</div>
        </FeedbackOverlay>
      );

      const intercept = document.querySelector(".pp-intercept") as HTMLElement;
      fireEvent.click(intercept, { clientX: 100, clientY: 200 });

      await waitFor(() =>
        expect(
          screen.getByPlaceholderText("Leave your feedback...")
        ).toBeInTheDocument()
      );

      const textarea = screen.getByPlaceholderText("Leave your feedback...");
      fireEvent.change(textarea, { target: { value: "Great work!" } });

      fireEvent.click(screen.getByText("Submit"));

      await waitFor(() => {
        expect(onCommentCreate).toHaveBeenCalledOnce();
        expect(onCommentCreate).toHaveBeenCalledWith(
          expect.objectContaining({ content: "Great work!" })
        );
        // Popover dismissed after submit
        expect(
          screen.queryByPlaceholderText("Leave your feedback...")
        ).not.toBeInTheDocument();
      });
    });

    it("cancel flow: clicking Cancel removes pending pin", async () => {
      render(
        <FeedbackOverlay
          onCommentCreate={async () => {}}
          onCommentsFetch={async () => []}
        >
          <div>My App</div>
        </FeedbackOverlay>
      );

      const intercept = document.querySelector(".pp-intercept") as HTMLElement;
      fireEvent.click(intercept, { clientX: 100, clientY: 200 });

      await waitFor(() =>
        expect(
          screen.getByPlaceholderText("Leave your feedback...")
        ).toBeInTheDocument()
      );

      fireEvent.click(screen.getByText("Cancel"));

      await waitFor(() => {
        expect(
          screen.queryByPlaceholderText("Leave your feedback...")
        ).not.toBeInTheDocument();
      });
    });

    it("pin toggle: clicking existing pin shows read popover, clicking again hides it", async () => {
      const target = document.createElement("div");
      target.id = "test";
      document.body.appendChild(target);

      // Give the anchor element a non-zero bounding rect so restorePosition resolves it
      vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
        top: 100,
        left: 100,
        width: 200,
        height: 50,
        bottom: 150,
        right: 300,
        x: 100,
        y: 100,
        toJSON: () => {},
      } as DOMRect);

      render(
        <FeedbackOverlay
          onCommentCreate={async () => {}}
          onCommentsFetch={async () => [mockComment]}
        >
          <div>My App</div>
        </FeedbackOverlay>
      );

      // Wait for existing pin marker to render
      let pinMarker: HTMLElement;
      await waitFor(() => {
        pinMarker = document.querySelector(".pp-pin") as HTMLElement;
        expect(pinMarker).toBeInTheDocument();
      });

      // Click pin marker to open read popover
      fireEvent.click(pinMarker!);

      await waitFor(() => {
        expect(screen.getByText("Fix this heading")).toBeInTheDocument();
      });

      // Click pin marker again to close
      fireEvent.click(pinMarker!);

      await waitFor(() => {
        expect(
          screen.queryByText("Fix this heading")
        ).not.toBeInTheDocument();
      });

      target.remove();
    });

    it("delete flow: clicking delete removes comment from state", async () => {
      const target = document.createElement("div");
      target.id = "test";
      document.body.appendChild(target);

      vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
        top: 100, left: 100, width: 200, height: 50,
        bottom: 150, right: 300, x: 100, y: 100, toJSON: () => {},
      } as DOMRect);

      const onCommentDelete = vi.fn(async () => {});
      render(
        <FeedbackOverlay
          onCommentCreate={async () => {}}
          onCommentsFetch={async () => [mockComment]}
          onCommentDelete={onCommentDelete}
        >
          <div>My App</div>
        </FeedbackOverlay>
      );

      // Wait for pin
      let pinMarker: HTMLElement;
      await waitFor(() => {
        pinMarker = document.querySelector(".pp-pin") as HTMLElement;
        expect(pinMarker).toBeInTheDocument();
      });

      // Open popover
      fireEvent.click(pinMarker!);
      await waitFor(() => {
        expect(screen.getByText("Fix this heading")).toBeInTheDocument();
      });

      // Click delete
      fireEvent.click(screen.getByLabelText("Delete"));
      // Confirm
      fireEvent.click(screen.getByText("Yes"));

      await waitFor(() => {
        // Pin and popover gone from the page
        expect(document.querySelector(".pp-pin")).not.toBeInTheDocument();
        expect(screen.queryByText("Fix this heading")).not.toBeInTheDocument();
      });

      target.remove();
    });

    it("update flow: editing updates comment in state", async () => {
      const target = document.createElement("div");
      target.id = "test";
      document.body.appendChild(target);

      vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
        top: 100, left: 100, width: 200, height: 50,
        bottom: 150, right: 300, x: 100, y: 100, toJSON: () => {},
      } as DOMRect);

      const updatedComment = { ...mockComment, content: "Updated heading" };
      const onCommentUpdate = vi.fn(async () => updatedComment);
      render(
        <FeedbackOverlay
          onCommentCreate={async () => {}}
          onCommentsFetch={async () => [mockComment]}
          onCommentUpdate={onCommentUpdate}
        >
          <div>My App</div>
        </FeedbackOverlay>
      );

      let pinMarker: HTMLElement;
      await waitFor(() => {
        pinMarker = document.querySelector(".pp-pin") as HTMLElement;
        expect(pinMarker).toBeInTheDocument();
      });

      fireEvent.click(pinMarker!);
      await waitFor(() => {
        expect(screen.getByText("Fix this heading")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText("Edit"));
      const textarea = screen.getByDisplayValue("Fix this heading");
      fireEvent.change(textarea, { target: { value: "Updated heading" } });
      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        // Updated content visible, edit mode dismissed
        expect(screen.getByText("Updated heading")).toBeInTheDocument();
        expect(screen.queryByDisplayValue("Updated heading")).not.toBeInTheDocument();
      });

      target.remove();
    });
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
