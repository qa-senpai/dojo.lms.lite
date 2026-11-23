import Link from "next/link";
import { signedIn } from "@/app/_auth";
import { adminCourses } from "@/modules/course-authoring/server";
import { CourseForm } from "@/modules/course-authoring/client";
export default async function Page() {
  const user = await signedIn(true);
  const courses = adminCourses(user);
  return (
    <>
      <p className="eyebrow">{"// адміністрування"}</p>
      <h1>Керування курсами</h1>
      <div className="two-col">
        <section className="panel">
          <h2>Усі курси</h2>
          {courses.length ? (
            <ul className="list">
              {courses.map((c) => (
                <li key={c.id} className="split">
                  <Link href={"/admin/courses/" + c.id}>{c.title}</Link>
                  <span className="badge">
                    {c.published ? "Опубліковано" : "Чернетка"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Створіть перший курс.</p>
          )}
        </section>
        <section className="panel">
          <h2>Новий курс</h2>
          <CourseForm />
        </section>
      </div>
    </>
  );
}
