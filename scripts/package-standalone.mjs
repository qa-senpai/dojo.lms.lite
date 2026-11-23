import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { build } from "esbuild";
if (!existsSync(".next/standalone/server.js"))
  throw new Error("Run npm run build first");
if (existsSync("release/data"))
  throw new Error(
    "release/data exists: move live data before replacing the release",
  );
rmSync("release", { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
mkdirSync("release");
cpSync(".next/standalone", "release", { recursive: true });
cpSync(".next/static", "release/.next/static", { recursive: true });
cpSync("public", "release/public", { recursive: true });
cpSync(".env.example", "release/.env.example");
cpSync("deploy", "release/deploy", { recursive: true });
cpSync("docs/deploy.md", "release/DEPLOY.md");
cpSync("scripts/backup.mjs", "release/backup.mjs");
await build({
  entryPoints: ["scripts/seed.ts"],
  outfile: "release/seed.cjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  plugins: [
    {
      name: "node-server-only",
      setup(build) {
        build.onResolve({ filter: /^server-only$/ }, () => ({
          path: "server-only",
          namespace: "empty",
        }));
        build.onLoad({ filter: /.*/, namespace: "empty" }, () => ({
          contents: "",
          loader: "js",
        }));
      },
    },
  ],
});
writeFileSync(
  "release/START.txt",
  "Node >=22.17. Build this artifact on Linux for a Linux VPS.\nSet APP_URL and an external DATABASE_PATH in .env.\nnode --env-file=.env seed.cjs\nHOSTNAME=127.0.0.1 PORT=3000 node --env-file=.env --max-old-space-size=256 server.js\n",
);
console.log(
  "Standalone release ready in release/ (without secrets or database).",
);
