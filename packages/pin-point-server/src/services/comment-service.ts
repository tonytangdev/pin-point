import type { PinComment } from "../types";
import type { CommentRepository } from "../repositories/comment-repository";

export class CommentService {
  constructor(private repository: CommentRepository) {}

  async create(comment: PinComment): Promise<PinComment> {
    return this.repository.create(comment);
  }

  async findAll(): Promise<PinComment[]> {
    return this.repository.findAll();
  }

  async findByUrl(url: string): Promise<PinComment[]> {
    return this.repository.findByUrl(url);
  }

  async delete(id: string): Promise<boolean> {
    return this.repository.deleteById(id);
  }
}
