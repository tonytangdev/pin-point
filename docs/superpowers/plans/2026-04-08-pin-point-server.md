# pin-point-server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone backend server (`pin-point-server`) that stores and serves `PinComment` objects for the pin-point frontend library.

**Architecture:** Full layered (Routes → Service → Repository) Hono server with pluggable DB via repository pattern. SQLite adapter ships first. Deployed via Docker or `npx`.

**Tech Stack:** Hono, Zod, better-sqlite3, tsup, Vitest, pnpm workspaces

---

## File Map

### Monorepo Root (modified)

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add workspaces config, remove lib-specific fields |
| `pnpm-workspace.yaml` | Create | Define workspace packages |
| `.gitignore` | Modify | Add `*.db` for SQLite files |

### `packages/pin-point/` (moved from root)

All existing source files (`src/`, `demo/`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `package.json`) move here. No content changes — only paths.

### `packages/pin-point-server/` (new)

| File | Responsibility |
|------|----------------|
| `package.json` | Package manifest, bin entry, dependencies |
| `tsconfig.json` | TypeScript config |
| `tsup.config.ts` | Build config |
| `vitest.config.ts` | Test config |
| `src/index.ts` | Entry point — create app, start server |
| `src/app.ts` | Hono app factory (for testability) |
| `src/config.ts` | Env var parsing with defaults |
| `src/types.ts` | `PinComment` type + Zod schemas |
| `src/routes/comments.ts` | Route handlers for `/comments` |
| `src/services/comment-service.ts` | Business logic layer |
| `src/repositories/comment-repository.ts` | Interface definition |
| `src/repositories/in-memory-repository.ts` | In-memory impl (for tests) |
| `src/repositories/sqlite-repository.ts` | SQLite impl |
| `src/__tests__/comments-routes.test.ts` | Behavioral tests: HTTP API behavior |
| `src/__tests__/sqlite-repository.test.ts` | Behavioral tests: SQLite adapter data persistence |
| `src/__tests__/e2e.test.ts` | Behavioral tests: full server lifecycle via HTTP |
| `Dockerfile` | Container image |

---

## Task 1: Migrate to pnpm Workspaces

**Files:**
- Modify: `package.json`
- Create: `pnpm-workspace.yaml`
- Delete: `package-lock.json`

- [ ] **Step 1: Create pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 2: Move frontend lib into packages/pin-point/**

```bash
mkdir -p packages/pin-point
git mv src packages/pin-point/src
git mv demo packages/pin-point/demo
git mv tsconfig.json packages/pin-point/tsconfig.json
git mv tsup.config.ts packages/pin-point/tsup.config.ts
git mv vitest.config.ts packages/pin-point/vitest.config.ts
```

- [ ] **Step 3: Create child package.json via CLI**

```bash
cd packages/pin-point
pnpm init
```

Then update the generated `package.json`:
- Set `name` to `"pin-point"`, `version` to `"0.1.0"`
- Copy `main`, `module`, `types`, `exports`, `files`, `scripts`, `peerDependencies` fields from the current root `package.json`
- Install devDependencies via CLI (read exact package names from root `package.json` devDependencies):

```bash
cd packages/pin-point
pnpm add -D @testing-library/dom @testing-library/jest-dom @testing-library/react @types/react @types/react-dom @vitejs/plugin-react jsdom react react-dom tsup typescript vite vitest
```

- [ ] **Step 4: Update root package.json to workspace root**

Strip all lib-specific fields from root `package.json` and set:
- `name`: `"pin-point-monorepo"`
- `private`: `true`
- `scripts`: `{ "build": "pnpm -r build", "test": "pnpm -r test", "lint": "pnpm -r lint" }`
- Remove `main`, `module`, `types`, `exports`, `files`, `peerDependencies`, `devDependencies`

- [ ] **Step 5: Remove package-lock.json and install with pnpm**

```bash
rm package-lock.json
pnpm install
```

- [ ] **Step 6: Verify frontend lib still works**

```bash
cd packages/pin-point
pnpm build
pnpm test
pnpm lint
```

All existing tests must pass and build must produce the same output in `packages/pin-point/dist/`.

- [ ] **Step 7: Update .gitignore**

Add `*.db` to `.gitignore` (for SQLite files created during dev/testing).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: migrate to pnpm workspaces monorepo"
```

---

## Task 2: Scaffold pin-point-server Package

**Files:**
- Create: `packages/pin-point-server/package.json`
- Create: `packages/pin-point-server/tsconfig.json`
- Create: `packages/pin-point-server/tsup.config.ts`
- Create: `packages/pin-point-server/vitest.config.ts`

- [ ] **Step 1: Init package and install dependencies via CLI**

```bash
mkdir -p packages/pin-point-server
cd packages/pin-point-server
pnpm init
```

Then update the generated `package.json`:
- Set `name` to `"pin-point-server"`, `version` to `"0.1.0"`, `type` to `"module"`
- Add `main`, `types`, `bin`, `files`, and `scripts` fields:
  - `main`: `"./dist/index.js"`
  - `types`: `"./dist/index.d.ts"`
  - `bin`: `{ "pin-point-server": "./dist/index.js" }`
  - `files`: `["dist"]`
  - `scripts`: `{ "build": "tsup", "dev": "tsx src/index.ts", "test": "vitest run", "test:watch": "vitest", "lint": "tsc --noEmit" }`

Install dependencies via CLI:

```bash
cd packages/pin-point-server
pnpm add hono zod @hono/zod-validator better-sqlite3
pnpm add -D @types/better-sqlite3 tsup tsx typescript vitest
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "src/**/*.test.ts"]
}
```

- [ ] **Step 3: Create tsup.config.ts**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point-server/package.json packages/pin-point-server/tsconfig.json packages/pin-point-server/tsup.config.ts packages/pin-point-server/vitest.config.ts pnpm-lock.yaml
git commit -m "chore: scaffold pin-point-server package"
```

---

## Task 3: Types and Zod Schemas

**Files:**
- Create: `packages/pin-point-server/src/types.ts`

- [ ] **Step 1: Write test for schema validation**

Create `packages/pin-point-server/src/__tests__/types.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { PinCommentSchema } from "../types";

describe("PinCommentSchema", () => {
  const validComment = {
    id: "abc-123",
    url: "/dashboard",
    content: "This button is misaligned",
    anchor: { selector: "#hero", xPercent: 50, yPercent: 30 },
    viewport: { width: 1440 },
    createdAt: "2026-04-08T10:00:00.000Z",
  };

  it("accepts a valid PinComment", () => {
    const result = PinCommentSchema.safeParse(validComment);
    expect(result.success).toBe(true);
  });

  it("generates id and createdAt when missing", () => {
    const { id, createdAt, ...partial } = validComment;
    const result = PinCommentSchema.safeParse(partial);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBeDefined();
      expect(result.data.createdAt).toBeDefined();
    }
  });

  it("rejects missing content", () => {
    const { content, ...partial } = validComment;
    const result = PinCommentSchema.safeParse(partial);
    expect(result.success).toBe(false);
  });

  it("rejects missing anchor fields", () => {
    const broken = { ...validComment, anchor: { selector: "#x" } };
    const result = PinCommentSchema.safeParse(broken);
    expect(result.success).toBe(false);
  });

  it("rejects missing url", () => {
    const { url, ...partial } = validComment;
    const result = PinCommentSchema.safeParse(partial);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/pin-point-server && pnpm test
```

Expected: FAIL — `../types` module not found.

- [ ] **Step 3: Implement types.ts**

Create `packages/pin-point-server/src/types.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/pin-point-server && pnpm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point-server/src/types.ts packages/pin-point-server/src/__tests__/types.test.ts
git commit -m "feat(server): add PinComment type and Zod schema"
```

---

## Task 4: Repository Interface, In-Memory Impl, and Service

No dedicated tests for these — they are internal implementation details tested behaviorally through the route tests (Task 5) and E2E tests (Task 9).

**Files:**
- Create: `packages/pin-point-server/src/repositories/comment-repository.ts`
- Create: `packages/pin-point-server/src/repositories/in-memory-repository.ts`
- Create: `packages/pin-point-server/src/services/comment-service.ts`

- [ ] **Step 1: Implement repository interface**

Create `packages/pin-point-server/src/repositories/comment-repository.ts`:

```typescript
import type { PinComment } from "../types";

export interface CommentRepository {
  create(comment: PinComment): Promise<PinComment>;
  findByUrl(url: string): Promise<PinComment[]>;
  findAll(): Promise<PinComment[]>;
  deleteById(id: string): Promise<void>;
}
```

- [ ] **Step 2: Implement in-memory repository**

Create `packages/pin-point-server/src/repositories/in-memory-repository.ts`:

```typescript
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
```

- [ ] **Step 3: Implement service**

Create `packages/pin-point-server/src/services/comment-service.ts`:

```typescript
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

  async delete(id: string): Promise<void> {
    return this.repository.deleteById(id);
  }
}
```

- [ ] **Step 4: Lint check**

```bash
cd packages/pin-point-server && pnpm lint
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point-server/src/repositories/ packages/pin-point-server/src/services/
git commit -m "feat(server): add repository interface, in-memory impl, and service"
```

---

## Task 5: Hono Routes

**Files:**
- Create: `packages/pin-point-server/src/routes/comments.ts`
- Create: `packages/pin-point-server/src/app.ts`
- Create: `packages/pin-point-server/src/__tests__/comments-routes.test.ts`

- [ ] **Step 1: Write route tests**

Create `packages/pin-point-server/src/__tests__/comments-routes.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../app";
import { InMemoryCommentRepository } from "../repositories/in-memory-repository";

const validComment = {
  url: "/page",
  content: "looks off",
  anchor: { selector: "#hero", xPercent: 50, yPercent: 30 },
  viewport: { width: 1440 },
};

describe("Comment routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp({ repository: new InMemoryCommentRepository() });
  });

  it("POST /comments creates a comment and returns 201", async () => {
    const res = await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validComment),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.content).toBe("looks off");
    expect(body.createdAt).toBeDefined();
  });

  it("GET /comments returns all comments", async () => {
    await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validComment),
    });
    const res = await app.request("/comments");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });

  it("GET /comments?url=/page filters by url", async () => {
    await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validComment),
    });
    await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validComment, url: "/other" }),
    });

    const res = await app.request("/comments?url=/page");
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].url).toBe("/page");
  });

  it("DELETE /comments/:id removes a comment", async () => {
    const createRes = await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validComment),
    });
    const { id } = await createRes.json();

    const deleteRes = await app.request(`/comments/${id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(204);

    const listRes = await app.request("/comments");
    const body = await listRes.json();
    expect(body).toHaveLength(0);
  });

  it("POST /comments returns 400 for invalid body", async () => {
    const res = await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "missing fields" }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/pin-point-server && pnpm test -- src/__tests__/comments-routes.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement routes**

Create `packages/pin-point-server/src/routes/comments.ts`:

```typescript
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
```

- [ ] **Step 4: Implement app factory**

Create `packages/pin-point-server/src/app.ts`:

```typescript
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

  return app;
}
```

- [ ] **Step 5: Run tests**

```bash
cd packages/pin-point-server && pnpm test -- src/__tests__/comments-routes.test.ts
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/pin-point-server/src/routes/ packages/pin-point-server/src/app.ts packages/pin-point-server/src/__tests__/comments-routes.test.ts
git commit -m "feat(server): add Hono routes and app factory"
```

---

## Task 6: Config Module

**Files:**
- Create: `packages/pin-point-server/src/config.ts`

- [ ] **Step 1: Implement config**

Create `packages/pin-point-server/src/config.ts`:

```typescript
export type Config = {
  port: number;
  host: string;
  dbAdapter: "sqlite";
  databaseUrl: string;
  corsOrigin: string;
};

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST ?? "0.0.0.0",
    dbAdapter: "sqlite",
    databaseUrl: process.env.DATABASE_URL ?? "./pin-point.db",
    corsOrigin: process.env.CORS_ORIGIN ?? "*",
  };
}
```

- [ ] **Step 2: Lint check**

```bash
cd packages/pin-point-server && pnpm lint
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/pin-point-server/src/config.ts
git commit -m "feat(server): add config module"
```

---

## Task 7: SQLite Repository

**Files:**
- Create: `packages/pin-point-server/src/repositories/sqlite-repository.ts`
- Create: `packages/pin-point-server/src/__tests__/sqlite-repository.test.ts`

- [ ] **Step 1: Write SQLite repository tests**

Create `packages/pin-point-server/src/__tests__/sqlite-repository.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync } from "node:fs";
import { SqliteCommentRepository } from "../repositories/sqlite-repository";
import type { PinComment } from "../types";

const DB_PATH = "./test-comments.db";

const makeComment = (overrides: Partial<PinComment> = {}): PinComment => ({
  id: "test-1",
  url: "/page",
  content: "test comment",
  anchor: { selector: "#el", xPercent: 50, yPercent: 50 },
  viewport: { width: 1440 },
  createdAt: "2026-04-08T00:00:00.000Z",
  ...overrides,
});

describe("SqliteCommentRepository", () => {
  let repo: SqliteCommentRepository;

  beforeEach(() => {
    repo = new SqliteCommentRepository(DB_PATH);
  });

  afterEach(() => {
    repo.close();
    if (existsSync(DB_PATH)) unlinkSync(DB_PATH);
  });

  it("creates table on construction", () => {
    // No error = table created
    expect(repo).toBeDefined();
  });

  it("creates and retrieves a comment", async () => {
    const comment = makeComment();
    const created = await repo.create(comment);
    expect(created).toEqual(comment);

    const all = await repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(comment);
  });

  it("finds comments by url", async () => {
    await repo.create(makeComment({ id: "1", url: "/a" }));
    await repo.create(makeComment({ id: "2", url: "/b" }));
    await repo.create(makeComment({ id: "3", url: "/a" }));

    const results = await repo.findByUrl("/a");
    expect(results).toHaveLength(2);
    expect(results.every((c) => c.url === "/a")).toBe(true);
  });

  it("deletes a comment by id", async () => {
    await repo.create(makeComment({ id: "1" }));
    await repo.create(makeComment({ id: "2" }));
    await repo.deleteById("1");

    const all = await repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("2");
  });

  it("preserves anchor and viewport as structured objects", async () => {
    const comment = makeComment({
      anchor: { selector: "div > p:nth-of-type(2)", xPercent: 12.5, yPercent: 88.3 },
      viewport: { width: 768 },
    });
    await repo.create(comment);

    const [retrieved] = await repo.findAll();
    expect(retrieved.anchor).toEqual(comment.anchor);
    expect(retrieved.viewport).toEqual(comment.viewport);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/pin-point-server && pnpm test -- src/__tests__/sqlite-repository.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement SQLite repository**

Create `packages/pin-point-server/src/repositories/sqlite-repository.ts`:

```typescript
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
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        comment.id,
        comment.url,
        comment.content,
        JSON.stringify(comment.anchor),
        JSON.stringify(comment.viewport),
        comment.createdAt
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

  async deleteById(id: string): Promise<void> {
    this.db.prepare("DELETE FROM comments WHERE id = ?").run(id);
  }

  close() {
    this.db.close();
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/pin-point-server && pnpm test -- src/__tests__/sqlite-repository.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point-server/src/repositories/sqlite-repository.ts packages/pin-point-server/src/__tests__/sqlite-repository.test.ts
git commit -m "feat(server): add SQLite repository with auto-migration"
```

---

## Task 8: Server Entry Point

**Files:**
- Create: `packages/pin-point-server/src/index.ts`

- [ ] **Step 1: Implement entry point**

Create `packages/pin-point-server/src/index.ts`:

```typescript
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { SqliteCommentRepository } from "./repositories/sqlite-repository";

const config = loadConfig();
const repository = new SqliteCommentRepository(config.databaseUrl);
const app = createApp({ repository, corsOrigin: config.corsOrigin });

serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  console.log(`pin-point-server listening on http://${config.host}:${info.port}`);
});
```

- [ ] **Step 2: Add @hono/node-server dependency**

```bash
cd packages/pin-point-server && pnpm add @hono/node-server
```

- [ ] **Step 3: Verify build**

```bash
cd packages/pin-point-server && pnpm build
```

Expected: Builds successfully, produces `dist/index.js` with shebang.

- [ ] **Step 4: Verify dev server starts**

```bash
cd packages/pin-point-server && pnpm dev &
sleep 2
curl -s http://localhost:3000/comments | head
kill %1
```

Expected: Returns `[]` (empty array).

- [ ] **Step 5: Commit**

```bash
git add packages/pin-point-server/src/index.ts packages/pin-point-server/package.json pnpm-lock.yaml
git commit -m "feat(server): add entry point with node server"
```

---

## Task 9: E2E Tests

**Files:**
- Create: `packages/pin-point-server/src/__tests__/e2e.test.ts`

- [ ] **Step 1: Write E2E tests**

Create `packages/pin-point-server/src/__tests__/e2e.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../app";
import { SqliteCommentRepository } from "../repositories/sqlite-repository";
import { existsSync, unlinkSync } from "node:fs";

const DB_PATH = "./test-e2e.db";

describe("E2E", () => {
  let app: ReturnType<typeof createApp>;
  let repo: SqliteCommentRepository;

  beforeAll(() => {
    repo = new SqliteCommentRepository(DB_PATH);
    app = createApp({ repository: repo });
  });

  afterAll(() => {
    repo.close();
    if (existsSync(DB_PATH)) unlinkSync(DB_PATH);
  });

  it("full lifecycle: create, list, filter, delete", async () => {
    // Create two comments on different pages
    const c1 = await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "/home",
        content: "header too large",
        anchor: { selector: "#header", xPercent: 10, yPercent: 20 },
        viewport: { width: 1920 },
      }),
    });
    expect(c1.status).toBe(201);
    const comment1 = await c1.json();

    await app.request("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "/about",
        content: "typo in bio",
        anchor: { selector: ".bio", xPercent: 30, yPercent: 40 },
        viewport: { width: 1440 },
      }),
    });

    // List all
    const allRes = await app.request("/comments");
    const all = await allRes.json();
    expect(all).toHaveLength(2);

    // Filter by url
    const filtered = await app.request("/comments?url=/home");
    const filteredBody = await filtered.json();
    expect(filteredBody).toHaveLength(1);
    expect(filteredBody[0].content).toBe("header too large");

    // Delete
    const delRes = await app.request(`/comments/${comment1.id}`, {
      method: "DELETE",
    });
    expect(delRes.status).toBe(204);

    // Verify deleted
    const afterDelete = await app.request("/comments");
    const remaining = await afterDelete.json();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].content).toBe("typo in bio");
  });
});
```

- [ ] **Step 2: Run all tests**

```bash
cd packages/pin-point-server && pnpm test
```

Expected: All tests PASS across all test files.

- [ ] **Step 3: Commit**

```bash
git add packages/pin-point-server/src/__tests__/e2e.test.ts
git commit -m "test(server): add E2E test with full comment lifecycle"
```

---

## Task 10: Dockerfile

**Files:**
- Create: `packages/pin-point-server/Dockerfile`

- [ ] **Step 1: Create Dockerfile**

Create `packages/pin-point-server/Dockerfile`:

```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/pin-point-server/package.json packages/pin-point-server/
RUN pnpm install --frozen-lockfile --filter pin-point-server
COPY packages/pin-point-server packages/pin-point-server
RUN pnpm --filter pin-point-server build

FROM node:20-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=builder /app/packages/pin-point-server/dist ./dist
COPY --from=builder /app/packages/pin-point-server/package.json .
COPY --from=builder /app/pnpm-lock.yaml .
RUN pnpm install --prod
ENV DATABASE_URL=/data/pin-point.db
VOLUME /data
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Add .dockerignore**

Create `packages/pin-point-server/.dockerignore`:

```
node_modules
dist
*.db
```

- [ ] **Step 3: Commit**

```bash
git add packages/pin-point-server/Dockerfile packages/pin-point-server/.dockerignore
git commit -m "chore(server): add Dockerfile"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run full build from root**

```bash
pnpm build
```

Expected: Both packages build successfully.

- [ ] **Step 2: Run all tests from root**

```bash
pnpm test
```

Expected: All tests pass in both packages.

- [ ] **Step 3: Run lint from root**

```bash
pnpm lint
```

Expected: No type errors.

- [ ] **Step 4: Verify npx-like startup**

```bash
cd packages/pin-point-server && node dist/index.js &
sleep 2
curl -s -X POST http://localhost:3000/comments \
  -H "Content-Type: application/json" \
  -d '{"url":"/test","content":"hello","anchor":{"selector":"#x","xPercent":1,"yPercent":2},"viewport":{"width":1024}}'
curl -s http://localhost:3000/comments
kill %1
rm -f pin-point.db
```

Expected: POST returns 201 with the comment. GET returns array with 1 comment.

- [ ] **Step 5: Commit any remaining fixes**

If any issues found, fix and commit.
