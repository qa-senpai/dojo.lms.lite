import { test } from "node:test";
import assert from "node:assert/strict";
import { quizPassed, completionPercent, chapterComplete } from "./rules";
test("quiz grading rejects coerced answers", () => {
  assert.equal(quizPassed(1, 1), true);
  for (const answer of ["1", true, null, 0, 2, 1.1])
    assert.equal(quizPassed(1, answer), false);
});
test("progress handles empty courses and clamps counts", () => {
  assert.equal(completionPercent(0, 0), 0);
  assert.equal(completionPercent(3, 1), 33);
  assert.equal(completionPercent(2, 5), 100);
  assert.equal(completionPercent(2, -1), 0);
});
test("completion requires reading, all exercises and accepted homework", () => {
  assert.equal(chapterComplete(true, 0, false), true);
  assert.equal(chapterComplete(true, 0, true, "ACCEPTED"), true);
  for (const status of ["PENDING", "REVISION", undefined])
    assert.equal(chapterComplete(true, 0, true, status), false);
  assert.equal(chapterComplete(false, 0, false), false);
  assert.equal(chapterComplete(true, 1, false), false);
});
