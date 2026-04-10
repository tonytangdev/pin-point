import type { Layer } from "effect";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { TokenRepository } from "./repositories/token-repo.js";
import { makeCommentRoutes } from "./routes/comments.js";
import type { CommentService } from "./services/comment-service.js";

export const createApp = (
	layer: Layer.Layer<CommentService | TokenRepository>,
) => {
	const app = new Hono();

	app.use("*", cors());
	app.route("/", makeCommentRoutes(layer));

	app.onError((err, c) => {
		console.error(err);
		return c.json({ error: "Internal server error" }, 500);
	});

	return app;
};
