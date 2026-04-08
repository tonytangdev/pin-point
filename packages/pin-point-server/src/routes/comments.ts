import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PinCommentSchema } from "../types";
import type { CommentService } from "../services/comment-service";

export function commentRoutes(service: CommentService) {
  const router = new Hono();

  router.post("/", zValidator("json", PinCommentSchema), async (c) => {
    const comment = c.req.valid("json");
    const created = await service.create(comment);
    return c.json(created, 201);
  });

  router.get("/", async (c) => {
    const url = c.req.query("url");
    const comments = url
      ? await service.findByUrl(url)
      : await service.findAll();
    return c.json(comments);
  });

  router.delete("/:id", async (c) => {
    const id = c.req.param("id");
    await service.delete(id);
    return c.body(null, 204);
  });

  return router;
}
