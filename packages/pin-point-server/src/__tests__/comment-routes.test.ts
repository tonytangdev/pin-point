import { describe, it, expect, beforeEach } from "vitest"
import { Effect, Layer } from "effect"
import { CommentRepository } from "../repositories/comment-repo.js"
import { CommentServiceLive } from "../services/comment-service.js"
import { createApp } from "../app.js"
import type { PinComment } from "../models/comment.js"

const stored: PinComment[] = []

const CommentRepoTest = Layer.succeed(CommentRepository, {
  create: (comment) => {
    stored.push(comment)
    return Effect.succeed(comment)
  },
  findByUrl: (url) =>
    Effect.succeed(stored.filter((c) => c.url === url)),
  findAll: () => Effect.succeed([...stored]),
  deleteById: (id) => {
    const idx = stored.findIndex((c) => c.id === id)
    if (idx === -1) return Effect.succeed(false)
    stored.splice(idx, 1)
    return Effect.succeed(true)
  },
  updateById: (id, content) => {
    const idx = stored.findIndex((c) => c.id === id)
    if (idx === -1) return Effect.succeed(null)
    stored[idx] = { ...stored[idx], content }
    return Effect.succeed(stored[idx])
  },
})

const TestLive = CommentServiceLive.pipe(Layer.provide(CommentRepoTest))

describe("Comment Routes", () => {
  const app = createApp(TestLive)

  beforeEach(() => {
    stored.length = 0
  })

  it("POST /comments creates a comment and returns 201", async () => {
    const res = await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com",
        content: "Test comment",
        anchor: { selector: "#main", xPercent: 50, yPercent: 25 },
        viewport: { width: 1024 },
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.url).toBe("https://example.com")
    expect(body.id).toBeDefined()
    expect(body.createdAt).toBeDefined()
  })

  it("POST /comments with invalid body returns 400", async () => {
    const res = await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    })
    expect(res.status).toBe(400)
  })

  it("GET /comments returns all comments", async () => {
    stored.push({
      id: "1",
      url: "https://example.com",
      content: "A",
      anchor: { selector: "#a", xPercent: 0, yPercent: 0 },
      viewport: { width: 1024 },
      createdAt: "2026-01-01T00:00:00.000Z",
    })
    const res = await app.request("/comments")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.length).toBe(1)
  })

  it("GET /comments?url= filters by url", async () => {
    stored.push(
      {
        id: "1", url: "https://a.com", content: "A",
        anchor: { selector: "#a", xPercent: 0, yPercent: 0 },
        viewport: { width: 1024 }, createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "2", url: "https://b.com", content: "B",
        anchor: { selector: "#b", xPercent: 0, yPercent: 0 },
        viewport: { width: 1024 }, createdAt: "2026-01-01T00:00:00.000Z",
      },
    )
    const res = await app.request("/comments?url=https://a.com")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.length).toBe(1)
    expect(body[0].url).toBe("https://a.com")
  })

  it("DELETE /comments/:id returns 204 on success", async () => {
    stored.push({
      id: "del-me", url: "https://example.com", content: "Delete me",
      anchor: { selector: "#a", xPercent: 0, yPercent: 0 },
      viewport: { width: 1024 }, createdAt: "2026-01-01T00:00:00.000Z",
    })
    const res = await app.request("/comments/del-me", { method: "DELETE" })
    expect(res.status).toBe(204)
  })

  it("DELETE /comments/:id returns 404 for unknown id", async () => {
    const res = await app.request("/comments/nope", { method: "DELETE" })
    expect(res.status).toBe(404)
  })

  it("PATCH /comments/:id updates content and returns 200", async () => {
    stored.push({
      id: "upd-me", url: "https://example.com", content: "Original",
      anchor: { selector: "#a", xPercent: 0, yPercent: 0 },
      viewport: { width: 1024 }, createdAt: "2026-01-01T00:00:00.000Z",
    })
    const res = await app.request("/comments/upd-me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Updated" }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.content).toBe("Updated")
    expect(body.id).toBe("upd-me")
  })

  it("PATCH /comments/:id returns 404 for unknown id", async () => {
    const res = await app.request("/comments/nope", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Updated" }),
    })
    expect(res.status).toBe(404)
  })

  it("PATCH /comments/:id returns 400 for invalid body", async () => {
    const res = await app.request("/comments/upd-me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it("PATCH /comments/:id returns 400 for empty content", async () => {
    const res = await app.request("/comments/upd-me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "" }),
    })
    expect(res.status).toBe(400)
  })
})
