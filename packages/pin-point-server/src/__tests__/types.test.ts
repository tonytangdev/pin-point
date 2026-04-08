import { describe, it, expect } from "vitest";
import { PinCommentSchema } from "../types";

describe("PinCommentSchema", () => {
  const validComment = {
    id: "abc-123",
    url: "/dashboard",
    content: "This button is misaligned",
    anchor: { selector: "#hero", xPercent: 50, yPercent: 30 },
    viewport: { width: 1440 },
    createdAt: "2026-04-08T10:00:00.000Z",
  };

  it("accepts a valid PinComment", () => {
    const result = PinCommentSchema.safeParse(validComment);
    expect(result.success).toBe(true);
  });

  it("generates id and createdAt when missing", () => {
    const { id, createdAt, ...partial } = validComment;
    const result = PinCommentSchema.safeParse(partial);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBeDefined();
      expect(result.data.createdAt).toBeDefined();
    }
  });

  it("rejects missing content", () => {
    const { content, ...partial } = validComment;
    const result = PinCommentSchema.safeParse(partial);
    expect(result.success).toBe(false);
  });

  it("rejects missing anchor fields", () => {
    const broken = { ...validComment, anchor: { selector: "#x" } };
    const result = PinCommentSchema.safeParse(broken);
    expect(result.success).toBe(false);
  });

  it("rejects missing url", () => {
    const { url, ...partial } = validComment;
    const result = PinCommentSchema.safeParse(partial);
    expect(result.success).toBe(false);
  });
});
