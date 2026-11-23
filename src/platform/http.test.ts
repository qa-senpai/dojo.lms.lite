import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  checkOrigin,
  jsonBody,
  boundedBody,
  errorResponse,
  appOrigin,
} from "./http";
import { AppError, demand } from "./errors";
test("HTTP mutations require exact configured origin", () => {
  process.env.APP_URL = "http://dojo.test:3000/path";
  assert.equal(appOrigin(), "http://dojo.test:3000");
  assert.doesNotThrow(() =>
    checkOrigin(
      new Request("http://dojo.test", {
        headers: { origin: "http://dojo.test:3000" },
      }),
    ),
  );
  for (const origin of ["", "http://evil.test", "https://dojo.test:3000"])
    assert.throws(
      () =>
        checkOrigin(new Request("http://dojo.test", { headers: { origin } })),
      { status: 403 },
    );
  delete process.env.APP_URL;
});
test("JSON transport rejects wrong media, malformed JSON, empty and oversized streams", async () => {
  const request = (body: string, type = "application/json") =>
    new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": type },
      body,
    });
  assert.deepEqual(await jsonBody(request('{"ok":true}')), { ok: true });
  await assert.rejects(jsonBody(request("{")), { status: 400 });
  await assert.rejects(jsonBody(request("{}", "text/plain")), { status: 415 });
  await assert.rejects(boundedBody(request("12345"), 4), { status: 413 });
  await assert.rejects(boundedBody(new Request("http://localhost")), {
    status: 400,
  });
});
test("public error responses expose validation but not internal details", async (t) => {
  assert.doesNotThrow(() => demand(true, 400, "bad"));
  assert.throws(() => demand(false, 403, "Denied"), { status: 403 });
  const app = errorResponse(new AppError(404, "Missing"));
  assert.equal(app.status, 404);
  assert.deepEqual(await app.json(), { error: "Missing" });
  const parsed = z.string().safeParse(42);
  assert.equal(errorResponse(parsed.error).status, 400);
  t.mock.method(console, "error", () => {});
  const internal = errorResponse(new Error("SECRET"));
  assert.equal(internal.status, 500);
  assert.ok(!JSON.stringify(await internal.json()).includes("SECRET"));
});
