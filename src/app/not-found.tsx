import Link from "next/link";
export default function NotFound() {
  return (
    <section className="panel">
      <p className="eyebrow">404</p>
      <h1>Сторінку не знайдено</h1>
      <Link href="/courses">Повернутися до курсів →</Link>
    </section>
  );
}
