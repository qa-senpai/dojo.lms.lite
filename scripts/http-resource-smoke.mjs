import { spawn, spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const directory = mkdtempSync(join(tmpdir(), "dojo-lite-http-"));
const origin = "http://dojo-lite.test:3216";
const env = {
  ...process.env,
  DATABASE_PATH: join(directory, "test.sqlite"),
  APP_URL: origin,
  HOSTNAME: "127.0.0.1",
  PORT: "3216",
  NODE_OPTIONS: "--max-old-space-size=256",
  NEXT_TELEMETRY_DISABLED: "1",
  SEED_ADMIN_EMAIL: "admin@dojo.test",
  SEED_ADMIN_PASSWORD: "Admin-demo-2026!",
  SEED_STUDENT_EMAIL: "student@dojo.test",
  SEED_STUDENT_PASSWORD: "Student-demo-2026!",
};
const seed = spawnSync(process.execPath, ["seed.cjs"], {
  cwd: resolve("release"),
  env,
  encoding: "utf8",
});
assert.equal(seed.status, 0, seed.stderr);
const child = spawn(process.execPath, ["server.js"], {
  cwd: resolve("release"),
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
child.stdout.on("data", (chunk) => {
  logs += chunk;
});
child.stderr.on("data", (chunk) => {
  logs += chunk;
});
let browser;
let timer;
const rss = [];
let errors = 0;
const local = "http://127.0.0.1:3216";
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(local + "/api/health")).ok) break;
    } catch {}
    if (i === 99) throw new Error("Server failed to start: " + logs);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const sample = () => {
    try {
      rss.push(
        Number(
          execFileSync("ps", ["-o", "rss=", "-p", String(child.pid)], {
            encoding: "utf8",
          }).trim(),
        ) / 1024,
      );
    } catch {}
  };
  sample();
  const startup = rss[0];
  timer = setInterval(sample, 200);
  browser = await chromium.launch({
    args: [
      "--host-resolver-rules=MAP dojo-lite.test 127.0.0.1",
      "--no-proxy-server",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const external = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(origin) && /^https?:/.test(request.url()))
      external.push(request.url());
  });
  page.on("pageerror", () => {
    errors++;
  });
  await page.goto(origin + "/sign-in");
  assert.equal(await page.evaluate(() => window.isSecureContext), false);
  await page.getByLabel("Email", { exact: true }).fill("admin@dojo.test");
  await page.getByLabel("Пароль", { exact: true }).fill("Admin-demo-2026!");
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/dashboard");
  const cookie = (await context.cookies()).find(
    (c) => c.name === "dojo_session",
  );
  assert.ok(cookie);
  assert.equal(cookie.secure, false);
  await page.goto(origin + "/courses");
  mkdirSync("temp/test-artifacts", { recursive: true });
  await page.screenshot({
    path: "temp/test-artifacts/desktop-catalog.png",
    fullPage: true,
  });
  await page
    .getByRole("heading", { name: "Перші кроки в автоматизації" })
    .getByRole("link")
    .click();
  await page.getByRole("link", { name: "Перейти до навчання" }).click();
  await page.getByRole("tab", { name: "Вправи", exact: true }).click();
  await page
    .getByRole("textbox", { name: "JavaScript", exact: true })
    .fill("function solve(a,b){ return a+b; }");
  await page
    .getByRole("button", { name: "Запустити тести", exact: true })
    .click();
  await page.getByText("✓ Тест 3", { exact: false }).waitFor();
  await page.screenshot({
    path: "temp/test-artifacts/desktop-player.png",
    fullPage: true,
  });
  assert.deepEqual(external, []);
  assert.equal(errors, 0);
  const cookieHeader = "dojo_session=" + cookie.value;
  await browser.close();
  browser = undefined;
  const paths = [
    "/courses",
    "/courses/demo-playwright",
    "/dashboard",
    "/admin/courses",
    "/api/courses",
  ];
  let completed = 0;
  const started = Date.now();
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let i = 0; i < 100; i++) {
        const response = await fetch(local + paths[i % paths.length], {
          headers: { Cookie: cookieHeader },
        });
        if (!response.ok) errors++;
        await response.arrayBuffer();
        completed++;
      }
    }),
  );
  sample();
  const report = {
    platform: process.platform,
    node: process.version,
    heapLimitMiB: 256,
    secureContext: false,
    httpCookie: true,
    externalRequests: external.length,
    browserErrors: errors,
    startupRssMiB: startup,
    peakRssMiB: Math.max(...rss),
    finalRssMiB: rss.at(-1),
    requests: completed,
    concurrency: 4,
    elapsedMs: Date.now() - started,
    httpErrors: errors,
    limitation:
      "Local host, no cgroup/RAM/1-vCPU enforcement. Not a VPS capacity guarantee.",
  };
  writeFileSync(
    "temp/test-artifacts/resource-report.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
  assert.equal(errors, 0);
  const backupPath = join(directory, "backup.sqlite");
  const backup = spawnSync(process.execPath, ["backup.mjs", backupPath], {
    cwd: resolve("release"),
    env,
    encoding: "utf8",
  });
  assert.equal(backup.status, 0, backup.stderr);
  console.log(
    "Standalone seed, HTTP on insecure origin, browser coding, resource smoke and online SQLite backup passed.",
  );
} finally {
  clearInterval(timer);
  if (browser) await browser.close();
  if (child.exitCode === null) {
    const exit = once(child, "exit");
    child.kill("SIGTERM");
    await exit;
  }
  rmSync(directory, { recursive: true, force: true });
}
