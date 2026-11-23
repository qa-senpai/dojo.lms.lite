import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
process.env.DATABASE_PATH = resolve(
  process.env.DATABASE_PATH || "./data/dojo.sqlite",
);
process.env.HOSTNAME = process.env.HOSTNAME || "127.0.0.1";
process.env.NEXT_TELEMETRY_DISABLED = "1";
await import(pathToFileURL(resolve(".next/standalone/server.js")).href);
