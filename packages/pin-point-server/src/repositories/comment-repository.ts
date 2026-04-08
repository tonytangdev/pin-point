import type { PinComment } from "../types";

export interface CommentRepository {
  create(comment: PinComment): Promise<PinComment>;
  findByUrl(url: string): Promise<PinComment[]>;
  findAll(): Promise<PinComment[]>;
  deleteById(id: string): Promise<void>;
}
