import { test } from "node:test";
import assert from "node:assert/strict";
import { submissionSchema, reviewSchema } from "./rules";
test("homework validation trims text and rejects blank/oversized submissions", () => {
  assert.equal(
    submissionSchema.parse({ content: " answer " }).content,
    "answer",
  );
  assert.equal(submissionSchema.safeParse({ content: "   " }).success, false);
  assert.equal(
    submissionSchema.safeParse({ content: "a".repeat(10001) }).success,
    false,
  );
});
test("revision needs feedback; accepted can have no comment", () => {
  assert.equal(
    reviewSchema.safeParse({ status: "REVISION", feedback: " " }).success,
    false,
  );
  assert.equal(
    reviewSchema.safeParse({
      status: "REVISION",
      feedback: "Виправте очікування",
    }).success,
    true,
  );
  assert.equal(reviewSchema.safeParse({ status: "ACCEPTED" }).success, true);
  assert.equal(reviewSchema.safeParse({ status: "PENDING" }).success, false);
});
