import type { PinComment } from "../types";
import type { CommentRepository } from "./comment-repository";

export class InMemoryCommentRepository implements CommentRepository {
  private comments: PinComment[] = [];

  async create(comment: PinComment): Promise<PinComment> {
    this.comments.push(comment);
    return comment;
  }

  async findByUrl(url: string): Promise<PinComment[]> {
    return this.comments.filter((c) => c.url === url);
  }

  async findAll(): Promise<PinComment[]> {
    return [...this.comments];
  }

  async deleteById(id: string): Promise<void> {
    this.comments = this.comments.filter((c) => c.id !== id);
  }
}
