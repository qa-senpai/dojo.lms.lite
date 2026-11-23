import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, tokenHash } from "./crypto";
test("passwords are salted and verified without storing plaintext", async () => {
  const first = await hashPassword("Password-123");
  const second = await hashPassword("Password-123");
  assert.notEqual(first, second);
  assert.ok(!first.includes("Password"));
  assert.equal(await verifyPassword("Password-123", first), true);
  assert.equal(await verifyPassword("Wrong", first), false);
  assert.equal(await verifyPassword("anything", "invalid"), false);
});
test("session hashes are deterministic and token-specific", () => {
  assert.equal(tokenHash("abc").length, 64);
  assert.equal(tokenHash("abc"), tokenHash("abc"));
  assert.notEqual(tokenHash("abc"), tokenHash("abd"));
});

test("password work has a bounded concurrency budget", async () => {
  const results = await Promise.allSettled([
    hashPassword("password1"),
    hashPassword("password2"),
    hashPassword("password3"),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    2,
  );
  const failure = results.find((result) => result.status === "rejected");
  assert.equal(failure?.reason.status, 429);
  assert.equal(
    await verifyPassword("abc", "0".repeat(32) + ":" + "z".repeat(128)),
    false,
  );
});
