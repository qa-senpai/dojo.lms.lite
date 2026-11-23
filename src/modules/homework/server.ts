import "server-only";
import { randomUUID } from "node:crypto";
import { all, one, run } from "@/platform/db/server";
import { demand } from "@/platform/errors";
import { requireAdmin } from "@/modules/accounts/server";
import type { User } from "@/modules/accounts/types";
import { accessibleChapter } from "@/modules/learning/server";
import { submissionSchema, reviewSchema } from "./rules";
export function submitHomework(
  user: User | null,
  courseId: string,
  chapterId: string,
  input: unknown,
) {
  const { current, chapter } = accessibleChapter(user, courseId, chapterId);
  demand(chapter.homework, 400, "Для цього розділу немає ДЗ");
  const data = submissionSchema.parse(input);
  demand(
    one<{ status: string }>(
      "SELECT status FROM submissions WHERE user_id=? AND chapter_id=?",
      current.id,
      chapterId,
    )?.status !== "ACCEPTED",
    409,
    "Роботу вже зараховано",
  );
  run(
    `INSERT INTO submissions VALUES (?,?,?,?,'PENDING','',?) ON CONFLICT(user_id,chapter_id) DO UPDATE SET content=excluded.content,status='PENDING',feedback='',updated_at=excluded.updated_at`,
    randomUUID(),
    current.id,
    chapterId,
    data.content,
    Date.now(),
  );
}
export type Submission = {
  id: string;
  name: string;
  email: string;
  chapter_title: string;
  content: string;
  status: string;
  feedback: string;
  updated_at: number;
};
export function courseSubmissions(user: User | null, courseId: string) {
  requireAdmin(user);
  return all<Submission>(
    `SELECT s.*,u.name,u.email,h.title chapter_title FROM submissions s JOIN users u ON u.id=s.user_id JOIN chapters h ON h.id=s.chapter_id WHERE h.course_id=? ORDER BY s.updated_at DESC`,
    courseId,
  );
}
export function reviewHomework(
  user: User | null,
  courseId: string,
  id: string,
  input: unknown,
) {
  requireAdmin(user);
  const data = reviewSchema.parse(input);
  demand(
    one(
      "SELECT s.id FROM submissions s JOIN chapters h ON h.id=s.chapter_id WHERE s.id=? AND h.course_id=?",
      id,
      courseId,
    ),
    404,
    "Роботу не знайдено",
  );
  run(
    "UPDATE submissions SET status=?,feedback=?,updated_at=? WHERE id=?",
    data.status,
    data.feedback,
    Date.now(),
    id,
  );
}
