import { Hono } from "hono";
import { cors } from "hono/cors";
import { CommentService } from "./services/comment-service";
import { commentRoutes } from "./routes/comments";
import type { CommentRepository } from "./repositories/comment-repository";

type AppOptions = {
  repository: CommentRepository;
  corsOrigin?: string;
};

export function createApp({ repository, corsOrigin = "*" }: AppOptions) {
  const app = new Hono();
  const service = new CommentService(repository);

  app.use("*", cors({ origin: corsOrigin }));
  app.route("/comments", commentRoutes(service));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
  });

  return app;
}
