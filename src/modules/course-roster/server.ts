import "server-only";
import { all, one, run } from "@/platform/db/server";
import { demand } from "@/platform/errors";
import {
  requireUser,
  requireAdmin,
  findUserByEmail,
} from "@/modules/accounts/server";
import type { User } from "@/modules/accounts/types";
export function hasAccess(user: User | null, courseId: string) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return !!one(
    "SELECT user_id FROM enrollments WHERE user_id=? AND course_id=?",
    user.id,
    courseId,
  );
}
export function requireCourseAccess(user: User | null, courseId: string) {
  const current = requireUser(user);
  const course = one<{ published: number }>(
    "SELECT published FROM courses WHERE id=?",
    courseId,
  );
  demand(
    course && (course.published || current.role === "ADMIN"),
    404,
    "Курс не знайдено",
  );
  demand(hasAccess(current, courseId), 403, "Спочатку запишіться на курс");
  return current;
}
export function enroll(user: User | null, courseId: string) {
  const current = requireUser(user);
  demand(
    one("SELECT id FROM courses WHERE id=? AND published=1", courseId),
    404,
    "Курс не знайдено",
  );
  run("INSERT OR IGNORE INTO enrollments VALUES (?,?)", current.id, courseId);
}
export function roster(user: User | null, courseId: string) {
  requireAdmin(user);
  return all<User>(
    `SELECT u.id,u.name,u.email,u.role FROM users u JOIN enrollments e ON e.user_id=u.id WHERE e.course_id=? ORDER BY u.name`,
    courseId,
  );
}
export function changeEnrollment(
  user: User | null,
  courseId: string,
  email: string,
  remove = false,
) {
  requireAdmin(user);
  demand(
    one("SELECT id FROM courses WHERE id=?", courseId),
    404,
    "Курс не знайдено",
  );
  const target = findUserByEmail(user, email);
  demand(target, 404, "Користувача з таким email не знайдено");
  if (remove)
    run(
      "DELETE FROM enrollments WHERE user_id=? AND course_id=?",
      target.id,
      courseId,
    );
  else
    run("INSERT OR IGNORE INTO enrollments VALUES (?,?)", target.id, courseId);
}
