import "server-only";
import { randomUUID } from "node:crypto";
import { all, one, run, transaction } from "@/platform/db/server";
import { demand } from "@/platform/errors";
import { requireAdmin } from "@/modules/accounts/server";
import type { User } from "@/modules/accounts/types";
import type { Course, Chapter, Exercise } from "./types";
import {
  courseSchema,
  chapterSchema,
  exerciseSchema,
  exactOrder,
} from "./rules";
export function adminCourses(user: User | null) {
  requireAdmin(user);
  return all<Course>("SELECT * FROM courses ORDER BY created_at DESC");
}
export function adminCourse(user: User | null, id: string) {
  requireAdmin(user);
  const course = one<Course>("SELECT * FROM courses WHERE id=?", id);
  demand(course, 404, "Курс не знайдено");
  return {
    course,
    chapters: all<Chapter>(
      "SELECT * FROM chapters WHERE course_id=? ORDER BY position,id",
      id,
    ),
  };
}
export function saveCourse(
  user: User | null,
  id: string | null,
  input: unknown,
) {
  requireAdmin(user);
  const data = courseSchema.parse(input);
  if (id) adminCourse(user, id);
  const key = id || randomUUID();
  if (id)
    run(
      "UPDATE courses SET title=?,description=?,category=?,published=? WHERE id=?",
      data.title,
      data.description,
      data.category,
      Number(data.published),
      key,
    );
  else
    run(
      "INSERT INTO courses VALUES (?,?,?,?,?,?)",
      key,
      data.title,
      data.description,
      data.category,
      Number(data.published),
      Date.now(),
    );
  return { id: key };
}
export function deleteCourse(user: User | null, id: string) {
  adminCourse(user, id);
  run("DELETE FROM courses WHERE id=?", id);
}
export function adminChapter(user: User | null, courseId: string, id: string) {
  adminCourse(user, courseId);
  const chapter = one<Chapter>(
    "SELECT * FROM chapters WHERE id=? AND course_id=?",
    id,
    courseId,
  );
  demand(chapter, 404, "Розділ не знайдено");
  return {
    chapter,
    exercises: all<Exercise>(
      "SELECT * FROM exercises WHERE chapter_id=? ORDER BY position,id",
      id,
    ),
  };
}
export function saveChapter(
  user: User | null,
  courseId: string,
  id: string | null,
  input: unknown,
) {
  adminCourse(user, courseId);
  const data = chapterSchema.parse(input);
  if (id) adminChapter(user, courseId, id);
  const key = id || randomUUID();
  if (id)
    run(
      "UPDATE chapters SET title=?,notes=?,video_url=?,homework=?,published=? WHERE id=?",
      data.title,
      data.notes,
      data.video_url,
      data.homework,
      Number(data.published),
      key,
    );
  else
    run(
      `INSERT INTO chapters VALUES (?,?,?,?,?,?,(SELECT COALESCE(MAX(position),0)+1 FROM chapters WHERE course_id=?),?)`,
      key,
      courseId,
      data.title,
      data.notes,
      data.video_url,
      data.homework,
      courseId,
      Number(data.published),
    );
  return { id: key };
}
export function deleteChapter(user: User | null, courseId: string, id: string) {
  adminChapter(user, courseId, id);
  run("DELETE FROM chapters WHERE id=?", id);
}
export function saveExercise(
  user: User | null,
  courseId: string,
  chapterId: string,
  id: string | null,
  input: unknown,
) {
  adminChapter(user, courseId, chapterId);
  const data = exerciseSchema.parse(input);
  if (id)
    demand(
      one(
        "SELECT id FROM exercises WHERE id=? AND chapter_id=?",
        id,
        chapterId,
      ),
      404,
      "Вправу не знайдено",
    );
  const key = id || randomUUID();
  transaction(() => {
    if (id) {
      run(
        "UPDATE exercises SET title=?,kind=?,prompt=?,options=?,answer=?,starter=?,tests=? WHERE id=?",
        data.title,
        data.kind,
        data.prompt,
        JSON.stringify(data.options),
        data.answer,
        data.starter,
        JSON.stringify(data.tests),
        key,
      );
      run("DELETE FROM attempts WHERE exercise_id=?", id);
    } else
      run(
        "INSERT INTO exercises VALUES (?,?,?,?,?,?,?,?,?,(SELECT COALESCE(MAX(position),0)+1 FROM exercises WHERE chapter_id=?))",
        key,
        chapterId,
        data.title,
        data.kind,
        data.prompt,
        JSON.stringify(data.options),
        data.answer,
        data.starter,
        JSON.stringify(data.tests),
        chapterId,
      );
  });
  return { id: key };
}
export function deleteExercise(
  user: User | null,
  courseId: string,
  chapterId: string,
  id: string,
) {
  adminChapter(user, courseId, chapterId);
  demand(
    one("SELECT id FROM exercises WHERE id=? AND chapter_id=?", id, chapterId),
    404,
    "Вправу не знайдено",
  );
  run("DELETE FROM exercises WHERE id=?", id);
}
export function reorder(
  user: User | null,
  courseId: string,
  ids: string[],
  chapterId?: string,
) {
  adminCourse(user, courseId);
  if (chapterId) adminChapter(user, courseId, chapterId);
  const table = chapterId ? "exercises" : "chapters";
  const parent = chapterId ? "chapter_id" : "course_id";
  transaction(() => {
    const existing = all<{ id: string }>(
      `SELECT id FROM ${table} WHERE ${parent}=?`,
      chapterId || courseId,
    ).map((row) => row.id);
    demand(
      exactOrder(existing, ids),
      400,
      "Порядок має містити всі елементи без повторів",
    );
    ids.forEach((id, index) =>
      run(`UPDATE ${table} SET position=? WHERE id=?`, index + 1, id),
    );
  });
}
