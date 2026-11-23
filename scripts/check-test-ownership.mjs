import { readFileSync, readdirSync } from "node:fs";
const ownership = JSON.parse(
  readFileSync("scripts/test-ownership.json", "utf8"),
);
const specs = ["tests/e2e", "tests/api"].flatMap((dir) =>
  readdirSync(dir)
    .filter((name) => name.endsWith(".spec.ts"))
    .map((name) => dir + "/" + name),
);
const missing = specs.filter((file) => !ownership[file]?.length);
if (missing.length) {
  console.error("Missing test ownership:", missing);
  process.exitCode = 1;
} else console.log("Test ownership OK");
