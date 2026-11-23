import "server-only";
import { all, one, run } from "@/platform/db/server";
import { demand } from "@/platform/errors";
import { requireUser } from "@/modules/accounts/server";
import type { User } from "@/modules/accounts/types";
import type {
  Course,
  Chapter,
  Exercise,
} from "@/modules/course-authoring/types";
import { requireCourseAccess } from "@/modules/course-roster/server";
import { chapterComplete, completionPercent, quizPassed } from "./rules";
export function accessibleChapter(
  user: User | null,
  courseId: string,
  chapterId: string,
) {
  const current = requireCourseAccess(user, courseId);
  const chapter = one<Chapter>(
    "SELECT * FROM chapters WHERE id=? AND course_id=?",
    chapterId,
    courseId,
  );
  demand(
    chapter && (chapter.published || current.role === "ADMIN"),
    404,
    "Розділ не знайдено",
  );
  return { current, chapter };
}
export function player(user: User | null, courseId: string, chapterId: string) {
  const { current, chapter } = accessibleChapter(user, courseId, chapterId);
  const exercises = all<
    Omit<Exercise, "answer"> & { passed: number; saved_answer: string }
  >(
    `SELECT e.id,e.chapter_id,e.title,e.kind,e.prompt,e.options,e.starter,e.tests,e.position,
    COALESCE(a.passed,0) passed,COALESCE(a.answer,'') saved_answer FROM exercises e
    LEFT JOIN attempts a ON a.exercise_id=e.id AND a.user_id=? WHERE e.chapter_id=? ORDER BY e.position,e.id`,
    current.id,
    chapterId,
  );
  return {
    chapter,
    course: one<Course>("SELECT * FROM courses WHERE id=?", courseId)!,
    chapters: all<{ id: string; title: string }>(
      "SELECT id,title FROM chapters WHERE course_id=? AND (published=1 OR ?=1) ORDER BY position,id",
      courseId,
      Number(current.role === "ADMIN"),
    ),
    exercises,
    read: !!one<{ done: number }>(
      "SELECT done FROM progress WHERE user_id=? AND chapter_id=?",
      current.id,
      chapterId,
    )?.done,
    submission:
      one<{ id: string; content: string; status: string; feedback: string }>(
        "SELECT id,content,status,feedback FROM submissions WHERE user_id=? AND chapter_id=?",
        current.id,
        chapterId,
      ) || null,
  };
}
export function markRead(
  user: User | null,
  courseId: string,
  chapterId: string,
  done: boolean,
) {
  const { current } = accessibleChapter(user, courseId, chapterId);
  run(
    "INSERT INTO progress VALUES (?,?,?) ON CONFLICT(user_id,chapter_id) DO UPDATE SET done=excluded.done",
    current.id,
    chapterId,
    Number(done),
  );
}
export function submitExercise(
  user: User | null,
  courseId: string,
  chapterId: string,
  exerciseId: string,
  input: { answer?: unknown; code?: unknown; passed?: unknown },
) {
  const { current } = accessibleChapter(user, courseId, chapterId);
  const exercise = one<Exercise>(
    "SELECT * FROM exercises WHERE id=? AND chapter_id=?",
    exerciseId,
    chapterId,
  );
  demand(exercise, 404, "Вправу не знайдено");
  let passed: boolean;
  let answer: string;
  if (exercise.kind === "QUIZ") {
    demand(
      typeof input.answer === "number" &&
        Number.isInteger(input.answer) &&
        input.answer >= 0 &&
        input.answer < JSON.parse(exercise.options).length,
      400,
      "Оберіть відповідь",
    );
    passed = quizPassed(exercise.answer, input.answer);
    answer = String(input.answer);
  } else {
    demand(
      typeof input.code === "string" &&
        input.code.length <= 20000 &&
        typeof input.passed === "boolean",
      400,
      "Некоректний результат виконання",
    );
    passed = input.passed;
    answer = input.code;
  }
  run(
    `INSERT INTO attempts VALUES (?,?,?,?) ON CONFLICT(user_id,exercise_id) DO UPDATE SET passed=MAX(attempts.passed,excluded.passed),answer=excluded.answer`,
    current.id,
    exerciseId,
    Number(passed),
    answer,
  );
  return { passed };
}
export function studentCourses(user: User | null) {
  const current = requireUser(user);
  return all<Course>(
    `SELECT c.* FROM courses c JOIN enrollments e ON e.course_id=c.id WHERE e.user_id=? AND c.published=1 ORDER BY c.created_at DESC`,
    current.id,
  ).map((course) => ({ ...course, ...courseProgress(current, course.id) }));
}
export function courseProgress(user: User, courseId: string) {
  const chapters = all<{
    id: string;
    done: number;
    pending: number;
    homework: string;
    status: string;
  }>(
    `SELECT h.id,h.homework,
    COALESCE(p.done,0) done,COALESCE(s.status,'') status,
    (SELECT COUNT(*) FROM exercises e WHERE e.chapter_id=h.id AND NOT EXISTS (SELECT 1 FROM attempts a WHERE a.exercise_id=e.id AND a.user_id=? AND a.passed=1)) pending
    FROM chapters h LEFT JOIN progress p ON p.chapter_id=h.id AND p.user_id=?
    LEFT JOIN submissions s ON s.chapter_id=h.id AND s.user_id=? WHERE h.course_id=? AND h.published=1 ORDER BY h.position,h.id`,
    user.id,
    user.id,
    user.id,
    courseId,
  );
  const completed = chapters.filter((c) =>
    chapterComplete(!!c.done, c.pending, !!c.homework, c.status),
  ).length;
  return {
    total: chapters.length,
    completed,
    percent: completionPercent(chapters.length, completed),
    firstChapter: chapters[0]?.id,
  };
}
