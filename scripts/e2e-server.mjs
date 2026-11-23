import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
const directory = mkdtempSync(join(tmpdir(), "dojo-lite-e2e-"));
const env = {
  ...process.env,
  DATABASE_PATH: join(directory, "test.sqlite"),
  APP_URL: "http://127.0.0.1:3106",
  SEED_ADMIN_EMAIL: "admin@dojo.test",
  SEED_ADMIN_PASSWORD: "Admin-demo-2026!",
  SEED_STUDENT_EMAIL: "student@dojo.test",
  SEED_STUDENT_PASSWORD: "Student-demo-2026!",
  NEXT_TELEMETRY_DISABLED: "1",
  NODE_OPTIONS: "--max-old-space-size=256",
};
const seed = spawnSync(
  process.execPath,
  ["--conditions=react-server", "--import", "tsx", "scripts/seed.ts"],
  { env, stdio: "inherit" },
);
if (seed.status !== 0) {
  rmSync(directory, { recursive: true, force: true });
  process.exit(seed.status || 1);
}
const child = spawn(process.execPath, [".next/standalone/server.js"], {
  env: { ...env, HOSTNAME: "127.0.0.1", PORT: "3106" },
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill("SIGTERM"));
child.on("exit", (code) => {
  rmSync(directory, { recursive: true, force: true });
  process.exit(code || 0);
});
