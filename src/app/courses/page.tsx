import Link from "next/link";
import { listCourses, categories } from "@/modules/course-catalog/server";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const query = await searchParams;
  const courses = listCourses(query.q, query.category);
  return (
    <>
      <p className="eyebrow">{"// навчальний простір"}</p>
      <h1>Курси</h1>
      <p className="muted">Обери курс і почни навчання у своєму темпі.</p>
      <form className="filters">
        <label>
          Пошук
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            placeholder="Назва або опис курсу"
          />
        </label>
        <label>
          Категорія
          <select name="category" defaultValue={query.category || ""}>
            <option value="">Усі категорії</option>
            {categories().map((c) => (
              <option key={c.category}>{c.category}</option>
            ))}
          </select>
        </label>
        <button>Знайти</button>
        <Link href="/courses">Скинути</Link>
      </form>
      {courses.length ? (
        <div className="grid">
          {courses.map((c) => (
            <article key={c.id} className="card">
              <div>
                <span className="badge">{c.category || "Навчання"}</span>
              </div>
              <h2>
                <Link href={"/courses/" + c.id}>{c.title}</Link>
              </h2>
              <p className="muted">{c.description.slice(0, 160)}</p>
              <div className="card-bottom">
                <span className="mono">Розділів: {c.chapter_count}</span>
                <Link href={"/courses/" + c.id}>Відкрити →</Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty">Курсів не знайдено. Спробуйте інший запит.</p>
      )}
    </>
  );
}
