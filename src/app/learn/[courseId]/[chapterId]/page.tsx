import Link from "next/link";
import { signedIn, pageData } from "@/app/_auth";
import { player } from "@/modules/learning/server";
import { Lesson } from "@/modules/learning/client";
import { courseAttachments } from "@/modules/course-files/server";
export default async function Page({
  params,
}: {
  params: Promise<{ courseId: string; chapterId: string }>;
}) {
  const user = await signedIn();
  const { courseId, chapterId } = await params;
  const data = pageData(() => player(user, courseId, chapterId));
  const files = courseAttachments(user, courseId);
  const index = data.chapters.findIndex((c) => c.id === chapterId);
  const next = data.chapters[index + 1];
  return (
    <>
      <Link href="/dashboard">← Моє навчання</Link>
      <p className="eyebrow section">
        {"// "}
        {data.course.title}
      </p>
      <div className="player">
        <aside className="chapter-nav">
          <h2>Розділи</h2>
          {data.chapters.map((c, i) => (
            <Link
              key={c.id}
              href={"/learn/" + courseId + "/" + c.id}
              aria-current={chapterId === c.id ? "page" : undefined}
            >
              {i + 1}. {c.title}
            </Link>
          ))}
          {files.length ? (
            <>
              <h3 className="section">Файли курсу</h3>
              {files.map((f) => (
                <a
                  key={f.id}
                  href={"/api/courses/" + courseId + "/attachments/" + f.id}
                >
                  {f.name} ↓
                </a>
              ))}
            </>
          ) : null}
        </aside>
        <article>
          <h1>{data.chapter.title}</h1>
          <Lesson
            key={chapterId}
            chapter={data.chapter}
            read={data.read}
            exercises={data.exercises}
            submission={data.submission}
          />
          <div className="section split">
            {index > 0 ? (
              <Link
                href={"/learn/" + courseId + "/" + data.chapters[index - 1].id}
              >
                ← Попередній розділ
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={"/learn/" + courseId + "/" + next.id}>
                Наступний розділ →
              </Link>
            ) : (
              <Link href="/dashboard">До результатів →</Link>
            )}
          </div>
        </article>
      </div>
    </>
  );
}
