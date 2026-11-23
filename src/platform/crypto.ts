import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { demand } from "./errors";
const derive = promisify(scrypt);
let active = 0;
async function passwordKey(password: string, salt: string) {
  demand(active < 2, 429, "Сервер зайнятий. Повторіть за кілька секунд");
  active++;
  try {
    return (await derive(password, salt, 64)) as Buffer;
  } finally {
    active--;
  }
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await passwordKey(password, salt);
  return salt + ":" + hash.toString("hex");
}
export async function verifyPassword(password: string, encoded: string) {
  const [salt, value] = encoded.split(":");
  if (
    !/^[a-f0-9]{32}$/.test(salt || "") ||
    !/^[a-f0-9]{128}$/.test(value || "")
  )
    return false;
  const hash = await passwordKey(password, salt);
  return timingSafeEqual(hash, Buffer.from(value, "hex"));
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
