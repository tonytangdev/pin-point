import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../app";
import { SqliteCommentRepository } from "../repositories/sqlite-repository";
import { existsSync, unlinkSync } from "node:fs";

const DB_PATH = "./test-e2e.db";

describe("E2E", () => {
  let app: ReturnType<typeof createApp>;
  let repo: SqliteCommentRepository;

  beforeAll(() => {
    repo = new SqliteCommentRepository(DB_PATH);
    app = createApp({ repository: repo });
  });

  afterAll(() => {
    repo.close();
    if (existsSync(DB_PATH)) unlinkSync(DB_PATH);
  });

  it("full lifecycle: create, list, filter, delete", async () => {
    // Create two comments on different pages
    const c1 = await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "/home",
        content: "header too large",
        anchor: { selector: "#header", xPercent: 10, yPercent: 20 },
        viewport: { width: 1920 },
      }),
    });
    expect(c1.status).toBe(201);
    const comment1 = await c1.json();

    await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "/about",
        content: "typo in bio",
        anchor: { selector: ".bio", xPercent: 30, yPercent: 40 },
        viewport: { width: 1440 },
      }),
    });

    // List all
    const allRes = await app.request("/comments");
    const all = await allRes.json();
    expect(all).toHaveLength(2);

    // Filter by url
    const filtered = await app.request("/comments?url=/home");
    const filteredBody = await filtered.json();
    expect(filteredBody).toHaveLength(1);
    expect(filteredBody[0].content).toBe("header too large");

    // Delete
    const delRes = await app.request(`/comments/${comment1.id}`, {
      method: "DELETE",
    });
    expect(delRes.status).toBe(204);

    // Verify deleted
    const afterDelete = await app.request("/comments");
    const remaining = await afterDelete.json();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].content).toBe("typo in bio");
  });
});
