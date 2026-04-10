import type { Layer } from "effect";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { TokenRepository } from "./repositories/token-repo.js";
import { makeAdminTokenRoutes } from "./routes/admin-tokens.js";
import { makeCommentRoutes } from "./routes/comments.js";
import type { CommentService } from "./services/comment-service.js";
import type { TokenService } from "./services/token-service.js";

export const createApp = (
	layer: Layer.Layer<CommentService | TokenService | TokenRepository>,
) => {
	const app = new Hono();

	app.use("*", cors());
	app.route("/", makeCommentRoutes(layer));
	app.route("/", makeAdminTokenRoutes(layer));

	app.onError((err, c) => {
		console.error(err);
		return c.json({ error: "Internal server error", code: "DB_ERROR" }, 500);
	});

	return app;
};
