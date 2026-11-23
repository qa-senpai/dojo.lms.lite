import Link from "next/link";
import { currentUser, pageData } from "@/app/_auth";
import { courseDetail } from "@/modules/course-catalog/server";
import { RemoteForm } from "@/components/ui/remote-form";
import { Markdown } from "@/components/ui/markdown";
export default async function Page({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const user = await currentUser();
  const { course, chapters, enrolled } = pageData(() =>
    courseDetail(user, courseId),
  );
  return (
    <>
      <Link href="/courses">← Усі курси</Link>
      <div className="section two-col">
        <section>
          <p className="eyebrow">
            {"// "}
            {course.category || "курс"}
          </p>
          <h1>{course.title}</h1>
          <Markdown>{course.description}</Markdown>
          <h2 className="section">Програма курсу</h2>
          <ol className="list">
            {chapters.map((c, i) => (
              <li key={c.id}>
                <span className="mono">
                  {String(i + 1).padStart(2, "0")} /{" "}
                </span>
                {enrolled ? (
                  <Link href={"/learn/" + courseId + "/" + c.id}>
                    {c.title}
                  </Link>
                ) : (
                  c.title
                )}
              </li>
            ))}
          </ol>
          {!chapters.length ? (
            <p className="empty">Розділи ще готуються.</p>
          ) : null}
        </section>
        <aside className="panel stack">
          <span className="badge">Безкоштовний доступ</span>
          <h2>Готові розпочати?</h2>
          <p className="muted">Конспекти, практика та збереження прогресу.</p>
          {!user ? (
            <Link className="button" href="/sign-in">
              Увійти для навчання
            </Link>
          ) : enrolled ? (
            chapters[0] ? (
              <Link
                className="button"
                href={"/learn/" + courseId + "/" + chapters[0].id}
              >
                Перейти до навчання
              </Link>
            ) : (
              <p>Ви записані на курс.</p>
            )
          ) : (
            <RemoteForm
              url={"/api/courses/" + courseId + "/enroll"}
              label="Записатися на курс"
            />
          )}
        </aside>
      </div>
    </>
  );
}
