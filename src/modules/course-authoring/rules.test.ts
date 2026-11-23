import { test } from "node:test";
import assert from "node:assert/strict";
import {
  courseSchema,
  chapterSchema,
  exerciseSchema,
  exactOrder,
  safeUrl,
} from "./rules";
test("courses are drafts by default and validate bounds", () => {
  assert.deepEqual(courseSchema.parse({ title: " Курс " }), {
    title: "Курс",
    description: "",
    category: "",
    published: false,
  });
  assert.equal(courseSchema.safeParse({ title: "A" }).success, false);
  assert.equal(
    courseSchema.safeParse({ title: "a".repeat(181) }).success,
    false,
  );
  assert.equal(chapterSchema.parse({ title: "Урок" }).published, false);
});
test("URL accepts HTTP(S) without credentials and rejects active protocols", () => {
  for (const value of [
    "",
    "http://example.test/video.mp4",
    "https://youtu.be/123",
  ])
    assert.equal(safeUrl.safeParse(value).success, true);
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,evil",
    "ftp://example.com",
    "https://user:pass@example.com",
    "bad",
  ])
    assert.equal(safeUrl.safeParse(value).success, false);
});
test("quiz requires valid options and an existing answer", () => {
  const quiz = {
    title: "Тест",
    kind: "QUIZ",
    prompt: "Оберіть",
    options: ["A", "B"],
    answer: 1,
  };
  assert.equal(exerciseSchema.safeParse(quiz).success, true);
  for (const patch of [
    { options: ["A"] },
    { answer: 2 },
    { options: ["", "B"] },
    { answer: -1 },
  ])
    assert.equal(
      exerciseSchema.safeParse({ ...quiz, ...patch }).success,
      false,
    );
});
test("coding requires at least one test, limits input and source length", () => {
  const code = {
    title: "Сума",
    kind: "CODE",
    prompt: "Напишіть solve",
    tests: [{ input: [2, 3], expected: 5 }],
  };
  assert.equal(exerciseSchema.safeParse(code).success, true);
  assert.equal(exerciseSchema.safeParse({ ...code, tests: [] }).success, false);
  assert.equal(
    exerciseSchema.safeParse({ ...code, starter: "x".repeat(20001) }).success,
    false,
  );
});
test("reorder is an exact permutation, including empty list", () => {
  assert.equal(exactOrder(["a", "b"], ["b", "a"]), true);
  assert.equal(exactOrder([], []), true);
  for (const ids of [["a"], ["a", "a"], ["a", "c"], ["a", "b", "c"]])
    assert.equal(exactOrder(["a", "b"], ids), false);
});
