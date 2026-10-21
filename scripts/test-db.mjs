// Runs the DB integration suite against LOCAL Supabase (see README_DEMO.md).
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["vitest", "run", "tests/integration"], {
  env: { ...process.env, RUN_DB_TESTS: "1" },
  shell: true,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
