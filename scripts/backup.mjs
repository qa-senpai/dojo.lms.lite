import { DatabaseSync, backup } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
const source = resolve(process.env.DATABASE_PATH || "./data/dojo.sqlite");
const destination = process.argv[2];
if (!destination)
  throw new Error("Usage: npm run db:backup -- /absolute/path/backup.sqlite");
if (!existsSync(source)) throw new Error("Database does not exist: " + source);
if (existsSync(destination))
  throw new Error("Refusing to overwrite an existing backup");
mkdirSync(dirname(resolve(destination)), { recursive: true });
const database = new DatabaseSync(source, { readOnly: true });
try {
  await backup(database, resolve(destination));
  console.log("Backup saved: " + resolve(destination));
} finally {
  database.close();
}
