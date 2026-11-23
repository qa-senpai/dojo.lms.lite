import "server-only";
import { randomUUID } from "node:crypto";
import { all, one, run } from "@/platform/db/server";
import { demand } from "@/platform/errors";
import { requireAdmin } from "@/modules/accounts/server";
import type { User } from "@/modules/accounts/types";
import { requireCourseAccess } from "@/modules/course-roster/server";
export function courseAttachments(user: User | null, courseId: string) {
  requireCourseAccess(user, courseId);
  return all<{ id: string; name: string }>(
    "SELECT id,name FROM attachments WHERE course_id=? ORDER BY name",
    courseId,
  );
}
export async function uploadAttachment(
  user: User | null,
  courseId: string,
  file: File,
) {
  requireAdmin(user);
  requireCourseAccess(user, courseId);
  demand(
    file && file.size > 0 && file.size <= 5 * 1024 * 1024,
    400,
    "Файл має бути від 1 байта до 5 MB",
  );
  demand(
    /\.(pdf|txt|md|csv|json|png|jpg|jpeg|zip)$/i.test(file.name),
    400,
    "Дозволено PDF, TXT, MD, CSV, JSON, PNG, JPG, ZIP",
  );
  const id = randomUUID();
  run(
    "INSERT INTO attachments VALUES (?,?,?,?,?)",
    id,
    courseId,
    file.name.replace(/[/\\\r\n]/g, "_").slice(0, 180),
    file.type || "application/octet-stream",
    Buffer.from(await file.arrayBuffer()),
  );
  return { id };
}
export function attachment(user: User | null, courseId: string, id: string) {
  requireCourseAccess(user, courseId);
  const file = one<{ name: string; mime: string; bytes: Uint8Array }>(
    "SELECT name,mime,bytes FROM attachments WHERE id=? AND course_id=?",
    id,
    courseId,
  );
  demand(file, 404, "Файл не знайдено");
  return file;
}
export function deleteAttachment(
  user: User | null,
  courseId: string,
  id: string,
) {
  requireAdmin(user);
  requireCourseAccess(user, courseId);
  run("DELETE FROM attachments WHERE id=? AND course_id=?", id, courseId);
}
