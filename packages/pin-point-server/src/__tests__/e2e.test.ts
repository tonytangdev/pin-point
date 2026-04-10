process.env.ADMIN_SECRET = "e2e-admin-secret";

import { fileURLToPath } from "node:url";
import { NodeContext } from "@effect/platform-node";
import { SqlClient } from "@effect/sql";
import { PgClient, PgMigrator } from "@effect/sql-pg";
import { Effect, Layer, Redacted, Scope } from "effect";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { CommentRepoLive } from "../repositories/comment-repo-pg.js";
import { TokenRepoLive } from "../repositories/token-repo-pg.js";
import { CommentServiceLive } from "../services/comment-service.js";
import { TokenServiceLive } from "../services/token-service.js";

const TestSqlLive = PgClient.layer({
	database: "pinpoint_test",
	host: "localhost",
	port: 5432,
	username: "pinpoint",
	password: Redacted.make("pinpoint"),
});

const TestMigratorLive = PgMigrator.layer({
	loader: PgMigrator.fromFileSystem(
		fileURLToPath(new URL("../migrations", import.meta.url)),
	),
	schemaDirectory: "src/migrations",
}).pipe(Layer.provide(TestSqlLive));

const TestMainLive = Layer.mergeAll(
	CommentServiceLive.pipe(Layer.provide(CommentRepoLive)),
	TokenServiceLive.pipe(Layer.provide(TokenRepoLive)),
	TokenRepoLive,
).pipe(Layer.provide(TestSqlLive));

const TestEnvLive = Layer.mergeAll(TestMainLive, TestMigratorLive).pipe(
	Layer.provide(NodeContext.layer),
);

const ADMIN_HEADERS = {
	"Content-Type": "application/json",
	"X-Pin-Admin": "e2e-admin-secret",
} as const;

const sampleCommentBody = (
	overrides: Partial<{ url: string; content: string }> = {},
) => ({
	url: overrides.url ?? "https://example.com",
	content: overrides.content ?? "Hello",
	anchor: { selector: "#x", xPercent: 50, yPercent: 50 },
	viewport: { width: 1024 },
});

describe("E2E", () => {
	const app = createApp(Layer.orDie(TestMainLive));
	let scope: Scope.CloseableScope;

	beforeAll(async () => {
		scope = Effect.runSync(Scope.make());
		await Effect.runPromise(Layer.buildWithScope(TestEnvLive, scope));
	});

	afterAll(async () => {
		await Effect.runPromise(
			Scope.close(scope, { _tag: "Success", value: undefined }),
		);
	});

	afterEach(async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`TRUNCATE TABLE comments, tokens`;
			}).pipe(Effect.provide(TestSqlLive)),
		);
	});

	it("full comment lifecycle: create, list, filter, update, delete", async () => {
		const createRes1 = await app.request("/comments", {
			method: "POST",
			headers: ADMIN_HEADERS,
			body: JSON.stringify({
				url: "https://a.com",
				content: "Comment A",
				anchor: { selector: "#a", xPercent: 10, yPercent: 20 },
				viewport: { width: 1024 },
			}),
		});
		expect(createRes1.status).toBe(201);
		const comment1 = await createRes1.json();

		const createRes2 = await app.request("/comments", {
			method: "POST",
			headers: ADMIN_HEADERS,
			body: JSON.stringify({
				url: "https://b.com",
				content: "Comment B",
				anchor: { selector: "#b", xPercent: 30, yPercent: 40 },
				viewport: { width: 768 },
			}),
		});
		expect(createRes2.status).toBe(201);

		const listRes = await app.request("/comments");
		expect(listRes.status).toBe(200);
		const all = await listRes.json();
		expect(all.length).toBe(2);

		const filterRes = await app.request("/comments?url=https://a.com");
		expect(filterRes.status).toBe(200);
		const filtered = await filterRes.json();
		expect(filtered.length).toBe(1);
		expect(filtered[0].content).toBe("Comment A");

		// Update
		const patchRes = await app.request(`/comments/${comment1.id}`, {
			method: "PATCH",
			headers: ADMIN_HEADERS,
			body: JSON.stringify({ content: "Comment A Updated" }),
		});
		expect(patchRes.status).toBe(200);
		const patched = await patchRes.json();
		expect(patched.content).toBe("Comment A Updated");
		expect(patched.id).toBe(comment1.id);

		// Update non-existent
		const patchNotFound = await app.request("/comments/non-existent", {
			method: "PATCH",
			headers: ADMIN_HEADERS,
			body: JSON.stringify({ content: "nope" }),
		});
		expect(patchNotFound.status).toBe(404);

		const deleteRes = await app.request(`/comments/${comment1.id}`, {
			method: "DELETE",
			headers: { "X-Pin-Admin": "e2e-admin-secret" },
		});
		expect(deleteRes.status).toBe(204);

		const afterDelete = await app.request("/comments");
		const remaining = await afterDelete.json();
		expect(remaining.length).toBe(1);
		expect(remaining[0].content).toBe("Comment B");

		const deleteAgain = await app.request(`/comments/${comment1.id}`, {
			method: "DELETE",
			headers: { "X-Pin-Admin": "e2e-admin-secret" },
		});
		expect(deleteAgain.status).toBe(404);
	});

	it("admin creates token, token posts comment, comment row carries tokenId", async () => {
		const createTokenRes = await app.request("/admin/tokens", {
			method: "POST",
			headers: ADMIN_HEADERS,
			body: JSON.stringify({ label: "e2e-token" }),
		});
		expect(createTokenRes.status).toBe(201);
		const token = await createTokenRes.json();
		expect(typeof token.id).toBe("string");

		const createCommentRes = await app.request("/comments", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Pin-Token": token.id,
			},
			body: JSON.stringify(
				sampleCommentBody({ url: "https://token.com", content: "via token" }),
			),
		});
		expect(createCommentRes.status).toBe(201);
		const created = await createCommentRes.json();

		const listRes = await app.request("/comments?url=https://token.com");
		expect(listRes.status).toBe(200);
		const list = await listRes.json();
		expect(list.length).toBe(1);
		expect(list[0].id).toBe(created.id);
		expect(list[0].tokenId).toBe(token.id);
	});

	it("revoked token cannot create comments", async () => {
		const createTokenRes = await app.request("/admin/tokens", {
			method: "POST",
			headers: ADMIN_HEADERS,
			body: JSON.stringify({}),
		});
		expect(createTokenRes.status).toBe(201);
		const token = await createTokenRes.json();

		const firstPost = await app.request("/comments", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Pin-Token": token.id,
			},
			body: JSON.stringify(sampleCommentBody({ url: "https://revoke.com" })),
		});
		expect(firstPost.status).toBe(201);

		const revokeRes = await app.request(`/admin/tokens/${token.id}`, {
			method: "DELETE",
			headers: { "X-Pin-Admin": "e2e-admin-secret" },
		});
		expect(revokeRes.status).toBe(204);

		const blockedPost = await app.request("/comments", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Pin-Token": token.id,
			},
			body: JSON.stringify(sampleCommentBody({ url: "https://revoke.com" })),
		});
		expect(blockedPost.status).toBe(401);
	});

	it("expired token cannot create comments", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`
					INSERT INTO tokens (id, label, created_at, expires_at, revoked_at)
					VALUES ('ft_expired', null, NOW(), NOW() - INTERVAL '1 minute', null)
				`;
			}).pipe(Effect.provide(TestSqlLive)),
		);

		const res = await app.request("/comments", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Pin-Token": "ft_expired",
			},
			body: JSON.stringify(sampleCommentBody({ url: "https://expired.com" })),
		});
		expect(res.status).toBe(401);
	});

	it("admin can delete a comment created by a token holder", async () => {
		const createTokenRes = await app.request("/admin/tokens", {
			method: "POST",
			headers: ADMIN_HEADERS,
			body: JSON.stringify({}),
		});
		expect(createTokenRes.status).toBe(201);
		const token = await createTokenRes.json();

		const createCommentRes = await app.request("/comments", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Pin-Token": token.id,
			},
			body: JSON.stringify(sampleCommentBody({ url: "https://admindel.com" })),
		});
		expect(createCommentRes.status).toBe(201);
		const comment = await createCommentRes.json();

		const deleteRes = await app.request(`/comments/${comment.id}`, {
			method: "DELETE",
			headers: { "X-Pin-Admin": "e2e-admin-secret" },
		});
		expect(deleteRes.status).toBe(204);

		const listRes = await app.request("/comments?url=https://admindel.com");
		const list = await listRes.json();
		expect(list.length).toBe(0);
	});

	it("token holder cannot delete comments (admin-only route)", async () => {
		const createTokenRes = await app.request("/admin/tokens", {
			method: "POST",
			headers: ADMIN_HEADERS,
			body: JSON.stringify({}),
		});
		expect(createTokenRes.status).toBe(201);
		const token = await createTokenRes.json();

		const createCommentRes = await app.request("/comments", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Pin-Token": token.id,
			},
			body: JSON.stringify(sampleCommentBody({ url: "https://tokendel.com" })),
		});
		expect(createCommentRes.status).toBe(201);
		const comment = await createCommentRes.json();

		const deleteRes = await app.request(`/comments/${comment.id}`, {
			method: "DELETE",
			headers: { "X-Pin-Token": token.id },
		});
		expect(deleteRes.status).toBe(403);

		const listRes = await app.request("/comments?url=https://tokendel.com");
		const list = await listRes.json();
		expect(list.length).toBe(1);
	});
});
