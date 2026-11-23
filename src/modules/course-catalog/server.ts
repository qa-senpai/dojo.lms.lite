import "server-only";
import { all, one } from "@/platform/db/server";
import { demand } from "@/platform/errors";
import type { Course } from "@/modules/course-authoring/types";
import type { User } from "@/modules/accounts/types";
import { hasAccess } from "@/modules/course-roster/server";
export function listCourses(search = "", category = "") {
  return all<Course & { chapter_count: number }>(
    `SELECT c.*,(SELECT COUNT(*) FROM chapters h WHERE h.course_id=c.id AND h.published=1) chapter_count
    FROM courses c WHERE c.published=1 AND (c.title LIKE ? OR c.description LIKE ?) AND (?='' OR c.category=?) ORDER BY c.created_at DESC LIMIT 200`,
    "%" + search.slice(0, 100) + "%",
    "%" + search.slice(0, 100) + "%",
    category,
    category,
  );
}
export function categories() {
  return all<{ category: string }>(
    "SELECT DISTINCT category FROM courses WHERE published=1 AND category<>'' ORDER BY category",
  );
}
export function courseDetail(user: User | null, id: string) {
  const course = one<Course>(
    "SELECT * FROM courses WHERE id=? AND published=1",
    id,
  );
  demand(course, 404, "Курс не знайдено");
  return {
    course,
    enrolled: hasAccess(user, id),
    chapters: all<{ id: string; title: string }>(
      "SELECT id,title FROM chapters WHERE course_id=? AND published=1 ORDER BY position,id",
      id,
    ),
  };
}
