import { test } from "node:test";
import assert from "node:assert/strict";
import { credentials, registration, isAdmin } from "./rules";
test("registration normalizes email, validates password/name and discards role escalation", () => {
  const parsed = registration.parse({
    name: "  Студент  ",
    email: "QA@EXAMPLE.COM",
    password: "password123",
    role: "ADMIN",
  });
  assert.deepEqual(parsed, {
    name: "Студент",
    email: "qa@example.com",
    password: "password123",
  });
  for (const input of [
    { name: "A", email: "qa@test.dev", password: "12345678" },
    { name: "QA", email: "broken", password: "12345678" },
    { name: "QA", email: "qa@test.dev", password: "short" },
  ])
    assert.equal(registration.safeParse(input).success, false);
  assert.equal(
    credentials.safeParse({ email: "qa@test.dev", password: "x".repeat(129) })
      .success,
    false,
  );
});
test("only ADMIN has admin privileges", () => {
  assert.equal(isAdmin(null), false);
  assert.equal(isAdmin({ role: "STUDENT" }), false);
  assert.equal(isAdmin({ role: "ADMIN" }), true);
});
