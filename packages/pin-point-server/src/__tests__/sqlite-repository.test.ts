import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync } from "node:fs";
import { SqliteCommentRepository } from "../repositories/sqlite-repository";
import type { PinComment } from "../types";

const DB_PATH = "./test-comments.db";

const makeComment = (overrides: Partial<PinComment> = {}): PinComment => ({
  id: "test-1",
  url: "/page",
  content: "test comment",
  anchor: { selector: "#el", xPercent: 50, yPercent: 50 },
  viewport: { width: 1440 },
  createdAt: "2026-04-08T00:00:00.000Z",
  ...overrides,
});

describe("SqliteCommentRepository", () => {
  let repo: SqliteCommentRepository;

  beforeEach(() => {
    repo = new SqliteCommentRepository(DB_PATH);
  });

  afterEach(() => {
    repo.close();
    if (existsSync(DB_PATH)) unlinkSync(DB_PATH);
  });

  it("creates table on construction", () => {
    expect(repo).toBeDefined();
  });

  it("creates and retrieves a comment", async () => {
    const comment = makeComment();
    const created = await repo.create(comment);
    expect(created).toEqual(comment);

    const all = await repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(comment);
  });

  it("finds comments by url", async () => {
    await repo.create(makeComment({ id: "1", url: "/a" }));
    await repo.create(makeComment({ id: "2", url: "/b" }));
    await repo.create(makeComment({ id: "3", url: "/a" }));

    const results = await repo.findByUrl("/a");
    expect(results).toHaveLength(2);
    expect(results.every((c) => c.url === "/a")).toBe(true);
  });

  it("deletes a comment by id", async () => {
    await repo.create(makeComment({ id: "1" }));
    await repo.create(makeComment({ id: "2" }));
    await repo.deleteById("1");

    const all = await repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("2");
  });

  it("preserves anchor and viewport as structured objects", async () => {
    const comment = makeComment({
      anchor: {
        selector: "div > p:nth-of-type(2)",
        xPercent: 12.5,
        yPercent: 88.3,
      },
      viewport: { width: 768 },
    });
    await repo.create(comment);

    const [retrieved] = await repo.findAll();
    expect(retrieved.anchor).toEqual(comment.anchor);
    expect(retrieved.viewport).toEqual(comment.viewport);
  });
});
