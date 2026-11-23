import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db, run, one, transaction } from "../src/platform/db/server";
import {
  register,
  login,
  logout,
  sessionUser,
  requireAdmin,
  limitAuth,
} from "../src/modules/accounts/server";
import {
  saveCourse,
  saveChapter,
  saveExercise,
  adminCourse,
  adminChapter,
  reorder,
  deleteCourse,
  deleteChapter,
  deleteExercise,
} from "../src/modules/course-authoring/server";
import {
  enroll,
  changeEnrollment,
  requireCourseAccess,
} from "../src/modules/course-roster/server";
import {
  listCourses,
  courseDetail,
} from "../src/modules/course-catalog/server";
import {
  player,
  markRead,
  submitExercise,
  studentCourses,
} from "../src/modules/learning/server";
import {
  submitHomework,
  reviewHomework,
  courseSubmissions,
} from "../src/modules/homework/server";
import {
  uploadAttachment,
  attachment,
  deleteAttachment,
  courseAttachments,
} from "../src/modules/course-files/server";
const directory = mkdtempSync(join(tmpdir(), "dojo-lite-integration-"));
process.env.DATABASE_PATH = join(directory, "test.sqlite");
after(() => {
  db().close();
  rmSync(directory, { recursive: true, force: true });
});
test("complete LMS workflow, permissions, persistence and atomic cascades", async () => {
  const adminSession = await register({
    name: "Admin",
    email: "admin@test.dev",
    password: "Password123",
  });
  run("UPDATE users SET role='ADMIN' WHERE id=?", adminSession.user.id);
  const admin = sessionUser(adminSession.token)!;
  const studentSession = await register({
    name: "Student",
    email: "student@test.dev",
    password: "Password123",
    role: "ADMIN",
  });
  const student = studentSession.user;
  assert.equal(student.role, "STUDENT");
  assert.throws(() => requireAdmin(student), { status: 403 });
  assert.throws(() => requireAdmin(null), { status: 401 });
  await assert.rejects(
    register({
      name: "Student",
      email: "STUDENT@test.dev",
      password: "Password123",
    }),
    { status: 409 },
  );
  await assert.rejects(
    login({ email: "student@test.dev", password: "wrong123" }),
    { status: 401 },
  );
  const signed = await login({
    email: "student@test.dev",
    password: "Password123",
  });
  assert.equal(sessionUser(signed.token)?.id, student.id);
  logout(signed.token);
  assert.equal(sessionUser(signed.token), null);
  assert.equal(sessionUser("invalid"), null);
  const course = saveCourse(admin, null, {
    title: "Automation",
    category: "QA",
  });
  assert.equal(listCourses().length, 0);
  assert.throws(() => courseDetail(student, course.id), { status: 404 });
  assert.throws(() => enroll(student, course.id), { status: 404 });
  assert.throws(() => saveCourse(student, null, { title: "Evil" }), {
    status: 403,
  });
  saveCourse(admin, course.id, {
    title: "Automation updated",
    category: "QA",
    published: true,
  });
  assert.equal(listCourses("updated", "QA").length, 1);
  assert.equal(
    Object.getPrototypeOf(adminCourse(admin, course.id).course),
    Object.prototype,
  );
  const first = saveChapter(admin, course.id, null, {
    title: "Chapter one",
    notes: "Notes",
    homework: "Write tests",
    published: true,
  });
  const second = saveChapter(admin, course.id, null, { title: "Chapter two" });
  assert.throws(() => player(student, course.id, first.id), { status: 403 });
  enroll(student, course.id);
  enroll(student, course.id);
  assert.throws(() => player(student, course.id, second.id), { status: 404 });
  assert.equal(player(student, course.id, first.id).chapters.length, 1);
  const quiz = saveExercise(admin, course.id, first.id, null, {
    title: "Question",
    kind: "QUIZ",
    prompt: "Select",
    options: ["No", "Yes"],
    answer: 1,
  });
  const code = saveExercise(admin, course.id, first.id, null, {
    title: "Addition",
    kind: "CODE",
    prompt: "solve",
    tests: [{ input: [1, 2], expected: 3 }],
  });
  assert.equal(
    "answer" in player(student, course.id, first.id).exercises[0],
    false,
  );
  assert.equal(
    submitExercise(student, course.id, first.id, quiz.id, { answer: 0 }).passed,
    false,
  );
  assert.equal(
    submitExercise(student, course.id, first.id, quiz.id, { answer: 1 }).passed,
    true,
  );
  assert.throws(
    () =>
      submitExercise(student, course.id, first.id, quiz.id, { answer: "1" }),
    { status: 400 },
  );
  submitExercise(student, course.id, first.id, code.id, {
    code: "function solve(a,b){return a+b}",
    passed: true,
  });
  markRead(student, course.id, first.id, true);
  assert.equal(studentCourses(student)[0].percent, 0);
  submitHomework(student, course.id, first.id, { content: "My solution" });
  let submission = courseSubmissions(admin, course.id)[0];
  reviewHomework(admin, course.id, submission.id, {
    status: "REVISION",
    feedback: "Add edge case",
  });
  assert.equal(
    player(student, course.id, first.id).submission?.status,
    "REVISION",
  );
  submitHomework(student, course.id, first.id, {
    content: "Improved solution",
  });
  submission = courseSubmissions(admin, course.id)[0];
  assert.equal(submission.feedback, "");
  assert.throws(
    () =>
      reviewHomework(student, course.id, submission.id, { status: "ACCEPTED" }),
    { status: 403 },
  );
  reviewHomework(admin, course.id, submission.id, { status: "ACCEPTED" });
  assert.equal(studentCourses(student)[0].percent, 100);
  assert.throws(
    () =>
      submitHomework(student, course.id, first.id, {
        content: "Overwrite accepted",
      }),
    { status: 409 },
  );
  markRead(student, course.id, first.id, false);
  assert.equal(studentCourses(student)[0].percent, 0);
  markRead(student, course.id, first.id, true);
  reorder(admin, course.id, [second.id, first.id]);
  assert.equal(adminCourse(admin, course.id).chapters[0].id, second.id);
  assert.throws(() => reorder(admin, course.id, [first.id, first.id]), {
    status: 400,
  });
  assert.equal(adminCourse(admin, course.id).chapters[0].id, second.id);
  reorder(admin, course.id, [code.id, quiz.id], first.id);
  assert.equal(
    adminChapter(admin, course.id, first.id).exercises[0].id,
    code.id,
  );
  const foreign = saveCourse(admin, null, {
    title: "Other course",
    published: true,
  });
  assert.throws(() => adminChapter(admin, foreign.id, first.id), {
    status: 404,
  });
  assert.throws(
    () =>
      reviewHomework(admin, foreign.id, submission.id, { status: "ACCEPTED" }),
    { status: 404 },
  );
  const file = await uploadAttachment(
    admin,
    course.id,
    new File(["hello"], "notes.txt", { type: "text/plain" }),
  );
  assert.equal(
    Buffer.from(attachment(student, course.id, file.id).bytes).toString(),
    "hello",
  );
  assert.equal(courseAttachments(student, course.id).length, 1);
  await assert.rejects(
    uploadAttachment(admin, course.id, new File(["evil"], "script.html")),
    { status: 400 },
  );
  changeEnrollment(admin, course.id, student.email, true);
  assert.throws(() => requireCourseAccess(student, course.id), { status: 403 });
  assert.throws(() => attachment(student, course.id, file.id), { status: 403 });
  changeEnrollment(admin, course.id, student.email);
  assert.equal(studentCourses(student)[0].percent, 100);
  deleteAttachment(admin, course.id, file.id);
  assert.equal(courseAttachments(student, course.id).length, 0);
  saveExercise(admin, course.id, first.id, quiz.id, {
    title: "Updated question",
    kind: "QUIZ",
    prompt: "Select",
    options: ["Yes", "No"],
    answer: 0,
  });
  assert.equal(studentCourses(student)[0].percent, 0);
  deleteExercise(admin, course.id, first.id, quiz.id);
  assert.equal(studentCourses(student)[0].percent, 100);
  deleteChapter(admin, course.id, second.id);
  assert.equal(adminCourse(admin, course.id).chapters.length, 1);
  assert.throws(
    () =>
      transaction(() => {
        run("DELETE FROM courses WHERE id=?", course.id);
        throw new Error("rollback");
      }),
    /rollback/,
  );
  assert.ok(adminCourse(admin, course.id));
  deleteCourse(admin, course.id);
  for (const table of [
    "chapters",
    "exercises",
    "enrollments",
    "attempts",
    "submissions",
    "progress",
    "attachments",
  ])
    assert.equal(one<{ n: number }>("SELECT COUNT(*) n FROM " + table)?.n, 0);
  for (let i = 0; i < 20; i++) limitAuth("limited@test.dev");
  assert.throws(() => limitAuth("limited@test.dev"), { status: 429 });
  run("UPDATE sessions SET expires=0");
  assert.equal(sessionUser(adminSession.token), null);
});
