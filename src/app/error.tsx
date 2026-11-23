"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="panel">
      <h1>Не вдалося завантажити сторінку</h1>
      <button onClick={reset}>Спробувати ще раз</button>
    </section>
  );
}
