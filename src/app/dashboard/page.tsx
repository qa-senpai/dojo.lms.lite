import Link from "next/link";
import { signedIn } from "../_auth";
import { studentCourses } from "@/modules/learning/server";
export default async function Page() {
  const user = await signedIn();
  const courses = studentCourses(user);
  return (
    <>
      <p className="eyebrow">{"// мій простір"}</p>
      <h1>Моє навчання</h1>
      <p className="muted">
        Вітаємо, {user.name}. Продовжуйте з того місця, де зупинилися.
      </p>
      {courses.length ? (
        <div className="grid section">
          {courses.map((c) => (
            <article className="card" key={c.id}>
              <span className="badge">
                {c.percent === 100 ? "Завершено" : "У процесі"}
              </span>
              <h2>{c.title}</h2>
              <p className="muted">
                Завершено розділів: {c.completed} / {c.total}
              </p>
              <progress
                max="100"
                value={c.percent}
                aria-label={"Прогрес: " + c.title}
              />
              <span className="mono">{c.percent}%</span>
              <Link
                href={
                  c.firstChapter
                    ? "/learn/" + c.id + "/" + c.firstChapter
                    : "/courses/" + c.id
                }
              >
                Продовжити →
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty section">
          <p>Ви ще не записані на курси.</p>
          <Link href="/courses">Обрати курс →</Link>
        </div>
      )}
    </>
  );
}
