import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		// Integration tests (e2e.test.ts, token-repo-pg.test.ts) share a single
		// `pinpoint_test` Postgres database and TRUNCATE tables in afterEach.
		// Running them in parallel causes truncations in one file to clobber rows
		// another file just inserted. Force serial file execution so the DB state
		// is owned by one test file at a time.
		fileParallelism: false,
	},
});
