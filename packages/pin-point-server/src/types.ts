import { z } from "zod";
import { randomUUID } from "node:crypto";

const AnchorSchema = z.object({
  selector: z.string(),
  xPercent: z.number(),
  yPercent: z.number(),
});

const ViewportSchema = z.object({
  width: z.number(),
});

export const PinCommentSchema = z.object({
  id: z.string().default(() => randomUUID()),
  url: z.string(),
  content: z.string(),
  anchor: AnchorSchema,
  viewport: ViewportSchema,
  createdAt: z.string().default(() => new Date().toISOString()),
});

export type PinComment = z.infer<typeof PinCommentSchema>;
