import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../app";
import { InMemoryCommentRepository } from "../repositories/in-memory-repository";

const validComment = {
  url: "/page",
  content: "looks off",
  anchor: { selector: "#hero", xPercent: 50, yPercent: 30 },
  viewport: { width: 1440 },
};

describe("Comment routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp({ repository: new InMemoryCommentRepository() });
  });

  it("POST /comments creates a comment and returns 201", async () => {
    const res = await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validComment),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.content).toBe("looks off");
    expect(body.createdAt).toBeDefined();
  });

  it("GET /comments returns all comments", async () => {
    await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validComment),
    });
    const res = await app.request("/comments");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });

  it("GET /comments?url=/page filters by url", async () => {
    await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validComment),
    });
    await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validComment, url: "/other" }),
    });

    const res = await app.request("/comments?url=/page");
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].url).toBe("/page");
  });

  it("DELETE /comments/:id removes a comment", async () => {
    const createRes = await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validComment),
    });
    const { id } = await createRes.json();

    const deleteRes = await app.request(`/comments/${id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const listRes = await app.request("/comments");
    const body = await listRes.json();
    expect(body).toHaveLength(0);
  });

  it("POST /comments returns 400 for invalid body", async () => {
    const res = await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "missing fields" }),
    });
    expect(res.status).toBe(400);
  });
});
