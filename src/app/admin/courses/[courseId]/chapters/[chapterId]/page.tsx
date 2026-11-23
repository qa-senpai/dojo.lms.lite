import Link from "next/link";
import { signedIn, pageData } from "@/app/_auth";
import { adminChapter } from "@/modules/course-authoring/server";
import {
  ChapterForm,
  ExerciseForm,
  OrderedList,
} from "@/modules/course-authoring/client";
import { RemoteForm } from "@/components/ui/remote-form";
export default async function Page({
  params,
}: {
  params: Promise<{ courseId: string; chapterId: string }>;
}) {
  const user = await signedIn(true);
  const { courseId, chapterId } = await params;
  const { chapter, exercises } = pageData(() =>
    adminChapter(user, courseId, chapterId),
  );
  return (
    <>
      <Link href={"/admin/courses/" + courseId}>← До курсу</Link>
      <h1 className="section">{chapter.title}</h1>
      <div className="two-col">
        <section className="stack">
          <section className="panel">
            <h2>Матеріали розділу</h2>
            <ChapterForm courseId={courseId} chapter={chapter} />
          </section>
          <section className="panel">
            <h2>Вправи ({exercises.length})</h2>
            <OrderedList
              courseId={courseId}
              chapterId={chapterId}
              items={exercises}
            />
            {exercises.map((e) => (
              <details className="section" key={e.id}>
                <summary>
                  {e.title} · {e.kind === "QUIZ" ? "Тест" : "JavaScript"}
                </summary>
                <ExerciseForm
                  courseId={courseId}
                  chapterId={chapterId}
                  exercise={e}
                />
                <div className="section danger-zone">
                  <RemoteForm
                    url={
                      "/api/courses/" +
                      courseId +
                      "/chapters/" +
                      chapterId +
                      "/exercises/" +
                      e.id
                    }
                    method="DELETE"
                    label="Видалити вправу"
                    confirm="Видалити вправу та її результати?"
                  />
                </div>
              </details>
            ))}
            <details className="section">
              <summary>Нова вправа</summary>
              <ExerciseForm courseId={courseId} chapterId={chapterId} />
            </details>
          </section>
        </section>
        <aside className="stack">
          <Link
            className="button secondary"
            href={"/learn/" + courseId + "/" + chapterId}
          >
            Переглянути розділ
          </Link>
          <section className="panel danger-zone">
            <h2>Видалення розділу</h2>
            <RemoteForm
              url={"/api/courses/" + courseId + "/chapters/" + chapterId}
              method="DELETE"
              label="Видалити розділ"
              confirm="Видалити розділ і його результати?"
              redirect={"/admin/courses/" + courseId}
            />
          </section>
        </aside>
      </div>
    </>
  );
}
