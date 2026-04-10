process.env.ADMIN_SECRET = "test-admin-secret";

import { Effect, Layer } from "effect";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import type { PinComment } from "../models/comment.js";
import { CommentRepository } from "../repositories/comment-repo.js";
import { TokenRepository } from "../repositories/token-repo.js";
import { CommentServiceLive } from "../services/comment-service.js";

const stored: PinComment[] = [];
const captured: { lastInsert: PinComment | null } = { lastInsert: null };

const CommentRepoTest = Layer.succeed(CommentRepository, {
	create: (comment) => {
		captured.lastInsert = comment;
		stored.push(comment);
		return Effect.succeed(comment);
	},
	findByUrl: (url) => Effect.succeed(stored.filter((c) => c.url === url)),
	findAll: () => Effect.succeed([...stored]),
	deleteById: (id) => {
		const idx = stored.findIndex((c) => c.id === id);
		if (idx === -1) return Effect.succeed(false);
		stored.splice(idx, 1);
		return Effect.succeed(true);
	},
	updateById: (id, content) => {
		const idx = stored.findIndex((c) => c.id === id);
		if (idx === -1) return Effect.succeed(null);
		stored[idx] = { ...stored[idx], content };
		return Effect.succeed(stored[idx]);
	},
	deleteOlderThan: () => Effect.succeed(0),
});

const TokenRepoTest = Layer.succeed(TokenRepository, {
	create: () => Effect.succeed({} as never),
	findAll: () => Effect.succeed([]),
	revoke: () => Effect.succeed(false),
	findActive: (id) =>
		Effect.succeed(
			id === "ft_valid"
				? {
						id,
						label: null,
						createdAt: new Date().toISOString(),
						expiresAt: null,
						revokedAt: null,
					}
				: null,
		),
});

const TestLive = Layer.merge(
	CommentServiceLive.pipe(Layer.provide(CommentRepoTest)),
	TokenRepoTest,
);

const ADMIN_HEADERS = {
	"Content-Type": "application/json",
	"X-Pin-Admin": "test-admin-secret",
};

const TOKEN_HEADERS = {
	"Content-Type": "application/json",
	"X-Pin-Token": "ft_valid",
};

const body = (data: unknown) => JSON.stringify(data);

const sampleCreateBody = {
	url: "https://example.com",
	content: "Test comment",
	anchor: { selector: "#main", xPercent: 50, yPercent: 25 },
	viewport: { width: 1024 },
};

const seedComment = (overrides: Partial<PinComment> = {}): PinComment => ({
	id: "seed-id",
	url: "https://example.com",
	content: "Seed",
	anchor: { selector: "#a", xPercent: 0, yPercent: 0 },
	viewport: { width: 1024 },
	createdAt: "2026-01-01T00:00:00.000Z",
	tokenId: null,
	authorName: null,
	authorId: null,
	...overrides,
});

describe("Comment Routes", () => {
	const app = createApp(TestLive);

	beforeEach(() => {
		stored.length = 0;
		captured.lastInsert = null;
	});

	it("POST /comments with admin auth creates comment and returns 201", async () => {
		const res = await app.request("/comments", {
			method: "POST",
			headers: ADMIN_HEADERS,
			body: body(sampleCreateBody),
		});
		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json.url).toBe("https://example.com");
		expect(json.id).toBeDefined();
		expect(json.createdAt).toBeDefined();
	});

	it("POST /comments with valid token returns 201 and stores tokenId", async () => {
		const res = await app.request("/comments", {
			method: "POST",
			headers: TOKEN_HEADERS,
			body: body(sampleCreateBody),
		});
		expect(res.status).toBe(201);
		expect(captured.lastInsert?.tokenId).toBe("ft_valid");
	});

	it("POST /comments with admin stores null tokenId", async () => {
		const res = await app.request("/comments", {
			method: "POST",
			headers: ADMIN_HEADERS,
			body: body(sampleCreateBody),
		});
		expect(res.status).toBe(201);
		expect(captured.lastInsert?.tokenId).toBeNull();
	});

	it("POST /comments without auth returns 401", async () => {
		const res = await app.request("/comments", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: body(sampleCreateBody),
		});
		expect(res.status).toBe(401);
	});

	it("POST /comments with invalid token returns 401", async () => {
		const res = await app.request("/comments", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Pin-Token": "ft_wrong",
			},
			body: body(sampleCreateBody),
		});
		expect(res.status).toBe(401);
	});

	it("POST /comments with invalid body returns 400", async () => {
		const res = await app.request("/comments", {
			method: "POST",
			headers: ADMIN_HEADERS,
			body: body({ url: "https://example.com" }),
		});
		expect(res.status).toBe(400);
	});

	it("GET /comments without auth returns 200 (public)", async () => {
		stored.push(seedComment({ id: "1" }));
		const res = await app.request("/comments");
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.length).toBe(1);
	});

	it("GET /comments?url= filters by url", async () => {
		stored.push(
			seedComment({ id: "1", url: "https://a.com" }),
			seedComment({ id: "2", url: "https://b.com" }),
		);
		const res = await app.request("/comments?url=https://a.com");
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.length).toBe(1);
		expect(json[0].url).toBe("https://a.com");
	});

	it("DELETE /comments/:id without auth returns 401", async () => {
		stored.push(seedComment({ id: "del-me" }));
		const res = await app.request("/comments/del-me", { method: "DELETE" });
		expect(res.status).toBe(401);
	});

	it("DELETE /comments/:id with token returns 403", async () => {
		stored.push(seedComment({ id: "del-me" }));
		const res = await app.request("/comments/del-me", {
			method: "DELETE",
			headers: TOKEN_HEADERS,
		});
		expect(res.status).toBe(403);
	});

	it("DELETE /comments/:id with admin returns 204", async () => {
		stored.push(seedComment({ id: "del-me" }));
		const res = await app.request("/comments/del-me", {
			method: "DELETE",
			headers: ADMIN_HEADERS,
		});
		expect(res.status).toBe(204);
	});

	it("DELETE /comments/:id with admin returns 404 for unknown id", async () => {
		const res = await app.request("/comments/nope", {
			method: "DELETE",
			headers: ADMIN_HEADERS,
		});
		expect(res.status).toBe(404);
	});

	it("PATCH /comments/:id without auth returns 401", async () => {
		stored.push(seedComment({ id: "upd-me" }));
		const res = await app.request("/comments/upd-me", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: body({ content: "Updated" }),
		});
		expect(res.status).toBe(401);
	});

	it("PATCH /comments/:id with token returns 403", async () => {
		stored.push(seedComment({ id: "upd-me" }));
		const res = await app.request("/comments/upd-me", {
			method: "PATCH",
			headers: TOKEN_HEADERS,
			body: body({ content: "Updated" }),
		});
		expect(res.status).toBe(403);
	});

	it("PATCH /comments/:id with admin updates content and returns 200", async () => {
		stored.push(seedComment({ id: "upd-me", content: "Original" }));
		const res = await app.request("/comments/upd-me", {
			method: "PATCH",
			headers: ADMIN_HEADERS,
			body: body({ content: "Updated" }),
		});
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.content).toBe("Updated");
		expect(json.id).toBe("upd-me");
	});

	it("PATCH /comments/:id returns 404 for unknown id", async () => {
		const res = await app.request("/comments/nope", {
			method: "PATCH",
			headers: ADMIN_HEADERS,
			body: body({ content: "Updated" }),
		});
		expect(res.status).toBe(404);
	});

	it("PATCH /comments/:id returns 400 for invalid body", async () => {
		const res = await app.request("/comments/upd-me", {
			method: "PATCH",
			headers: ADMIN_HEADERS,
			body: body({}),
		});
		expect(res.status).toBe(400);
	});

	it("PATCH /comments/:id returns 400 for empty content", async () => {
		const res = await app.request("/comments/upd-me", {
			method: "PATCH",
			headers: ADMIN_HEADERS,
			body: body({ content: "" }),
		});
		expect(res.status).toBe(400);
	});
});
