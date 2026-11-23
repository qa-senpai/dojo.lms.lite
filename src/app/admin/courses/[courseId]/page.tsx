import Link from "next/link";
import { signedIn, pageData } from "@/app/_auth";
import { adminCourse } from "@/modules/course-authoring/server";
import {
  CourseForm,
  ChapterForm,
  OrderedList,
  AttachmentsEditor,
} from "@/modules/course-authoring/client";
import { roster } from "@/modules/course-roster/server";
import { courseAttachments } from "@/modules/course-files/server";
import { courseSubmissions } from "@/modules/homework/server";
import { statusLabels } from "@/modules/homework/rules";
import { RemoteForm } from "@/components/ui/remote-form";
export default async function Page({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const user = await signedIn(true);
  const { courseId } = await params;
  const { course, chapters } = pageData(() => adminCourse(user, courseId));
  const students = roster(user, courseId);
  const submissions = courseSubmissions(user, courseId);
  return (
    <>
      <Link href="/admin/courses">← Керування курсами</Link>
      <h1 className="section">{course.title}</h1>
      <div className="two-col">
        <section className="stack">
          <section className="panel">
            <h2>Налаштування курсу</h2>
            <CourseForm course={course} />
          </section>
          <section className="panel">
            <h2>Розділи</h2>
            <OrderedList courseId={courseId} items={chapters} />
            <details className="section">
              <summary>Новий розділ</summary>
              <ChapterForm courseId={courseId} />
            </details>
          </section>
          <section className="panel">
            <h2>Матеріали курсу</h2>
            <AttachmentsEditor
              courseId={courseId}
              files={courseAttachments(user, courseId)}
            />
          </section>
          <section className="panel">
            <h2>Домашні роботи</h2>
            {!submissions.length ? (
              <p className="muted">Робіт на перевірку поки немає.</p>
            ) : (
              submissions.map((s) => (
                <details className="section" key={s.id}>
                  <summary>
                    {s.name} · {s.chapter_title} · {statusLabels[s.status]}
                  </summary>
                  <p className="muted">{s.email}</p>
                  <pre className="prose" style={{ whiteSpace: "pre-wrap" }}>
                    {s.content}
                  </pre>
                  <RemoteForm
                    url={"/api/courses/" + courseId + "/reviews/" + s.id}
                    method="PATCH"
                    label="Зберегти перевірку"
                  >
                    <label>
                      Рішення
                      <select
                        name="status"
                        defaultValue={
                          s.status === "ACCEPTED" ? "ACCEPTED" : "REVISION"
                        }
                      >
                        <option value="REVISION">На доопрацювання</option>
                        <option value="ACCEPTED">Зараховано</option>
                      </select>
                    </label>
                    <label>
                      Коментар
                      <textarea
                        name="feedback"
                        defaultValue={s.feedback}
                        maxLength={5000}
                      />
                    </label>
                  </RemoteForm>
                </details>
              ))
            )}
          </section>
        </section>
        <aside className="stack">
          <section className="panel">
            <h2>Учасники ({students.length})</h2>
            <RemoteForm
              url={"/api/courses/" + courseId + "/students"}
              label="Додати учасника"
            >
              <label>
                Email студента
                <input name="email" type="email" required />
              </label>
            </RemoteForm>
            <ul className="list section">
              {students.map((s) => (
                <li key={s.id}>
                  <strong>{s.name}</strong>
                  <p className="muted">{s.email}</p>
                  <RemoteForm
                    url={"/api/courses/" + courseId + "/students"}
                    method="DELETE"
                    values={{ email: s.email }}
                    label="Відкликати доступ"
                    confirm={"Відкликати доступ для " + s.email + "?"}
                  />
                </li>
              ))}
            </ul>
          </section>
          {course.published ? (
            <Link className="button secondary" href={"/courses/" + courseId}>
              Переглянути курс
            </Link>
          ) : null}
          <section className="panel danger-zone">
            <h2>Видалення курсу</h2>
            <p>Курс, розділи, файли та всі результати буде видалено.</p>
            <RemoteForm
              url={"/api/courses/" + courseId}
              method="DELETE"
              label="Видалити курс"
              confirm="Видалити курс і всі його дані?"
              redirect="/admin/courses"
            />
          </section>
        </aside>
      </div>
    </>
  );
}
