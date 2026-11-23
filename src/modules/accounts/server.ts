import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { all, one, run, transaction } from "@/platform/db/server";
import { hashPassword, verifyPassword, tokenHash } from "@/platform/crypto";
import { demand } from "@/platform/errors";
import { credentials, registration } from "./rules";
import type { User } from "./types";
export const SESSION_SECONDS = 60 * 60 * 24 * 7;
export function requireUser(user: User | null): User {
  demand(user, 401, "Увійдіть до облікового запису");
  return user;
}
export function requireAdmin(user: User | null): User {
  const current = requireUser(user);
  demand(current.role === "ADMIN", 403, "Потрібні права адміністратора");
  return current;
}
export function limitAuth(email: string) {
  const key = tokenHash(email.toLowerCase().slice(0, 254));
  const now = Date.now();
  run("DELETE FROM login_limits WHERE expires < ?", now);
  const limit = one<{ count: number }>(
    "SELECT count FROM login_limits WHERE key=?",
    key,
  );
  demand(
    !limit || limit.count < 20,
    429,
    "Забагато спроб. Повторіть через 15 хвилин",
  );
  run(
    "INSERT INTO login_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
    key,
    now + 900000,
  );
}
export async function register(input: unknown) {
  const data = registration.parse(input);
  limitAuth(data.email);
  demand(
    !one("SELECT id FROM users WHERE email=?", data.email),
    409,
    "Цей email уже зареєстровано",
  );
  const password = await hashPassword(data.password);
  const user: User = {
    id: randomUUID(),
    name: data.name,
    email: data.email,
    role: "STUDENT",
  };
  transaction(() => {
    demand(
      !one("SELECT id FROM users WHERE email=?", data.email),
      409,
      "Цей email уже зареєстровано",
    );
    run(
      "INSERT INTO users VALUES (?,?,?,?,?)",
      user.id,
      user.name,
      user.email,
      password,
      user.role,
    );
  });
  return createSession(user);
}
export async function login(input: unknown) {
  const data = credentials.parse(input);
  limitAuth(data.email);
  const user = one<User & { password: string }>(
    "SELECT * FROM users WHERE email=?",
    data.email,
  );
  const valid = await verifyPassword(
    data.password,
    user?.password || "00000000000000000000000000000000:" + "0".repeat(128),
  );
  demand(user && valid, 401, "Неправильний email або пароль");
  return createSession(user);
}
function createSession(user: User) {
  const token = randomBytes(32).toString("hex");
  run("DELETE FROM sessions WHERE expires < ?", Date.now());
  run(
    "INSERT INTO sessions VALUES (?,?,?)",
    tokenHash(token),
    user.id,
    Date.now() + SESSION_SECONDS * 1000,
  );
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}
export function sessionUser(token?: string): User | null {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return (
    one<User>(
      `SELECT u.id,u.name,u.email,u.role FROM users u JOIN sessions s ON s.user_id=u.id
    WHERE s.token=? AND s.expires>?`,
      tokenHash(token),
      Date.now(),
    ) || null
  );
}
export function logout(token?: string) {
  if (token) run("DELETE FROM sessions WHERE token=?", tokenHash(token));
}
export function findUserByEmail(user: User | null, email: string) {
  requireAdmin(user);
  return one<User>("SELECT id,name,email,role FROM users WHERE email=?", email);
}
export function listUsers(user: User | null) {
  requireAdmin(user);
  return all<User>(
    "SELECT id,name,email,role FROM users ORDER BY name LIMIT 500",
  );
}
