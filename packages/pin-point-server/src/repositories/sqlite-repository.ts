import Database from "better-sqlite3";
import type { PinComment } from "../types";
import type { CommentRepository } from "./comment-repository";

type CommentRow = {
  id: string;
  url: string;
  content: string;
  anchor: string;
  viewport: string;
  created_at: string;
};

function rowToComment(row: CommentRow): PinComment {
  return {
    id: row.id,
    url: row.url,
    content: row.content,
    anchor: JSON.parse(row.anchor),
    viewport: JSON.parse(row.viewport),
    createdAt: row.created_at,
  };
}

export class SqliteCommentRepository implements CommentRepository {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        content TEXT NOT NULL,
        anchor TEXT NOT NULL,
        viewport TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_comments_url ON comments(url)
    `);
  }

  async create(comment: PinComment): Promise<PinComment> {
    this.db
      .prepare(
        `INSERT INTO comments (id, url, content, anchor, viewport, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        comment.id,
        comment.url,
        comment.content,
        JSON.stringify(comment.anchor),
        JSON.stringify(comment.viewport),
        comment.createdAt,
      );
    return comment;
  }

  async findByUrl(url: string): Promise<PinComment[]> {
    const rows = this.db
      .prepare("SELECT * FROM comments WHERE url = ?")
      .all(url) as CommentRow[];
    return rows.map(rowToComment);
  }

  async findAll(): Promise<PinComment[]> {
    const rows = this.db
      .prepare("SELECT * FROM comments")
      .all() as CommentRow[];
    return rows.map(rowToComment);
  }

  async deleteById(id: string): Promise<boolean> {
    const result = this.db.prepare("DELETE FROM comments WHERE id = ?").run(id);
    return result.changes > 0;
  }

  close() {
    this.db.close();
  }
}
