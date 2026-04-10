process.env.ADMIN_SECRET = "test-admin-secret";

import { Effect, Layer } from "effect";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import type { Token } from "../models/token.js";
import { CommentRepository } from "../repositories/comment-repo.js";
import { TokenRepository } from "../repositories/token-repo.js";
import { CommentServiceLive } from "../services/comment-service.js";
import { TokenServiceLive } from "../services/token-service.js";

let stored: Map<string, Token>;

const makeTokenRepo = () =>
	Layer.succeed(TokenRepository, {
		create: (t: Token) => {
			stored.set(t.id, t);
			return Effect.succeed(t);
		},
		findAll: () =>
			Effect.succeed(
				Array.from(stored.values()).sort((a, b) =>
					b.createdAt.localeCompare(a.createdAt),
				),
			),
		findActive: (id: string) => {
			const t = stored.get(id);
			if (!t || t.revokedAt) return Effect.succeed(null);
			if (t.expiresAt && new Date(t.expiresAt) < new Date())
				return Effect.succeed(null);
			return Effect.succeed(t);
		},
		revoke: (id: string) => {
			const t = stored.get(id);
			if (!t || t.revokedAt) return Effect.succeed(false);
			stored.set(id, { ...t, revokedAt: new Date().toISOString() });
			return Effect.succeed(true);
		},
	});

const CommentRepoStub = Layer.succeed(CommentRepository, {
	create: (c) => Effect.succeed(c),
	findAll: () => Effect.succeed([]),
	findByUrl: () => Effect.succeed([]),
	deleteById: () => Effect.succeed(false),
	updateById: () => Effect.succeed(null),
});

const ADMIN = { "X-Pin-Admin": "test-admin-secret" };

describe("admin token routes", () => {
	let app: ReturnType<typeof createApp>;

	beforeEach(() => {
		stored = new Map();
		const TokenRepoLayer = makeTokenRepo();
		const TestLive = Layer.mergeAll(
			CommentServiceLive.pipe(Layer.provide(CommentRepoStub)),
			TokenServiceLive.pipe(Layer.provide(TokenRepoLayer)),
			TokenRepoLayer,
		);
		app = createApp(TestLive);
	});

	it("POST /admin/tokens without admin header returns 401", async () => {
		const res = await app.request("/admin/tokens", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(401);
	});

	it("POST /admin/tokens with admin returns 201 + token", async () => {
		const res = await app.request("/admin/tokens", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...ADMIN },
			body: JSON.stringify({ label: "alice", expiresInHours: 24 }),
		});
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.id).toMatch(/^ft_/);
		expect(body.label).toBe("alice");
		expect(body.expiresAt).not.toBeNull();
	});

	it("POST /admin/tokens with no expiresInHours and no env default → expiresAt null", async () => {
		const res = await app.request("/admin/tokens", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...ADMIN },
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.expiresAt).toBeNull();
	});

	it("POST /admin/tokens invalid body returns 400", async () => {
		const res = await app.request("/admin/tokens", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...ADMIN },
			body: JSON.stringify({ expiresInHours: "not a number" }),
		});
		expect(res.status).toBe(400);
	});

	it("GET /admin/tokens without admin returns 401", async () => {
		const res = await app.request("/admin/tokens");
		expect(res.status).toBe(401);
	});

	it("GET /admin/tokens with admin returns list", async () => {
		await app.request("/admin/tokens", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...ADMIN },
			body: JSON.stringify({ label: "one" }),
		});
		await app.request("/admin/tokens", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...ADMIN },
			body: JSON.stringify({ label: "two" }),
		});
		const res = await app.request("/admin/tokens", { headers: ADMIN });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.length).toBe(2);
	});

	it("DELETE /admin/tokens/:id with admin returns 204 and revokes", async () => {
		const createRes = await app.request("/admin/tokens", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...ADMIN },
			body: JSON.stringify({}),
		});
		const { id } = await createRes.json();

		const delRes = await app.request(`/admin/tokens/${id}`, {
			method: "DELETE",
			headers: ADMIN,
		});
		expect(delRes.status).toBe(204);

		expect(stored.get(id)?.revokedAt).not.toBeNull();
	});

	it("DELETE /admin/tokens/:id without admin returns 401", async () => {
		const res = await app.request("/admin/tokens/ft_fake", {
			method: "DELETE",
		});
		expect(res.status).toBe(401);
	});
});
