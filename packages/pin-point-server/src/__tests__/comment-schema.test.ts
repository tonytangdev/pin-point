import { describe, it, expect } from "vitest"
import { Schema } from "effect"
import {
  PinCommentSchema,
  CreateCommentSchema,
  type PinComment,
  type CreateComment,
} from "../models/comment.js"

describe("CreateCommentSchema", () => {
  it("decodes a valid create request", () => {
    const input = {
      url: "https://example.com",
      content: "Hello",
      anchor: { selector: "#main", xPercent: 50, yPercent: 25 },
      viewport: { width: 1024 },
    }
    const result = Schema.decodeUnknownEither(CreateCommentSchema)(input)
    expect(result._tag).toBe("Right")
  })

  it("rejects missing required fields", () => {
    const input = { url: "https://example.com" }
    const result = Schema.decodeUnknownEither(CreateCommentSchema)(input)
    expect(result._tag).toBe("Left")
  })
})

describe("PinCommentSchema", () => {
  it("decodes a full comment", () => {
    const input = {
      id: "abc-123",
      url: "https://example.com",
      content: "Hello",
      anchor: { selector: "#main", xPercent: 50, yPercent: 25 },
      viewport: { width: 1024 },
      createdAt: "2026-01-01T00:00:00.000Z",
    }
    const result = Schema.decodeUnknownEither(PinCommentSchema)(input)
    expect(result._tag).toBe("Right")
  })

  it("rejects invalid anchor (missing selector)", () => {
    const input = {
      id: "abc-123",
      url: "https://example.com",
      content: "Hello",
      anchor: { xPercent: 50, yPercent: 25 },
      viewport: { width: 1024 },
      createdAt: "2026-01-01T00:00:00.000Z",
    }
    const result = Schema.decodeUnknownEither(PinCommentSchema)(input)
    expect(result._tag).toBe("Left")
  })
})
