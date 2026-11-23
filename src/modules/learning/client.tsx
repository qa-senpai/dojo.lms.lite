"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { send, RemoteForm } from "@/components/ui/remote-form";
import { Markdown } from "@/components/ui/markdown";
import { runCode } from "@/platform/run-code";
import type { Chapter, Exercise } from "@/modules/course-authoring/types";
import { statusLabels } from "@/modules/homework/rules";
type PlayerExercise = Omit<Exercise, "answer"> & {
  passed: number;
  saved_answer: string;
};
type Submission = { content: string; status: string; feedback: string } | null;
export function Lesson({
  chapter,
  read,
  exercises,
  submission,
}: {
  chapter: Chapter;
  read: boolean;
  exercises: PlayerExercise[];
  submission: Submission;
}) {
  const [tab, setTab] = useState("notes");
  const base = "/api/courses/" + chapter.course_id + "/chapters/" + chapter.id;
  const tabs = [
    ["notes", "Конспект"],
    ...(chapter.video_url ? [["video", "Відео"]] : []),
    ...(chapter.homework ? [["homework", "ДЗ"]] : []),
    ...(exercises.length ? [["exercises", "Вправи"]] : []),
  ];
  return (
    <>
      <div className="tabs" role="tablist" aria-label="Матеріали розділу">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={"tab-" + key}
            aria-controls={"panel-" + key}
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id={"panel-" + tab}
        aria-labelledby={"tab-" + tab}
      >
        {tab === "notes" ? (
          <div className="stack">
            <Markdown>{chapter.notes || "Конспект ще готується."}</Markdown>
            <RemoteForm
              url={base + "/progress"}
              values={{ done: !read }}
              label={
                read
                  ? "Скасувати позначку прочитання"
                  : "Позначити як прочитане"
              }
            />
            {read ? <p className="success">✓ Конспект прочитано</p> : null}
          </div>
        ) : null}
        {tab === "video" ? (
          <div className="stack">
            {/\.(mp4|webm|ogg)(\?|$)/i.test(chapter.video_url) ? (
              <video
                className="video"
                controls
                preload="none"
                src={chapter.video_url}
              >
                <track kind="captions" />
              </video>
            ) : null}
            <a
              href={chapter.video_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Відкрити відео →
            </a>
          </div>
        ) : null}
        {tab === "homework" ? (
          <div className="stack">
            <Markdown>{chapter.homework}</Markdown>
            {submission ? (
              <div className="panel">
                <strong>{statusLabels[submission.status]}</strong>
                {submission.feedback ? <p>{submission.feedback}</p> : null}
              </div>
            ) : null}
            {submission?.status !== "ACCEPTED" ? (
              <RemoteForm
                url={base + "/homework"}
                label={submission ? "Надіслати повторно" : "Надіслати роботу"}
              >
                <label>
                  Відповідь або посилання
                  <textarea
                    name="content"
                    required
                    minLength={3}
                    maxLength={10000}
                    defaultValue={submission?.content}
                  />
                </label>
              </RemoteForm>
            ) : (
              <p className="success">✓ Домашнє завдання зараховано</p>
            )}
          </div>
        ) : null}
        {tab === "exercises" ? (
          <div className="stack">
            {exercises.map((e) => (
              <ExerciseCard
                key={e.id}
                exercise={e}
                url={base + "/exercises/" + e.id + "/attempt"}
              />
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}
function ExerciseCard({
  exercise: e,
  url,
}: {
  exercise: PlayerExercise;
  url: string;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState(e.saved_answer || "");
  const [code, setCode] = useState(e.saved_answer || e.starter);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function check() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (e.kind === "QUIZ") {
        const result = await send(url, "POST", {
          answer: answer === "" ? null : Number(answer),
        });
        setMessage(
          result.passed
            ? "✓ Правильно!"
            : "Відповідь неправильна. Спробуйте ще раз.",
        );
      } else {
        const result = await runCode(code, JSON.parse(e.tests));
        await send(url, "POST", { code, passed: result.passed });
        setMessage(result.lines.join("\n"));
      }
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Помилка мережі");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="panel">
      <div className="split">
        <h3>{e.title}</h3>
        {e.passed ? <span className="success">✓ Виконано</span> : null}
      </div>
      <Markdown>{e.prompt}</Markdown>
      {e.kind === "QUIZ" ? (
        <fieldset className="stack">
          <legend>Оберіть відповідь</legend>
          {(JSON.parse(e.options) as string[]).map((option, index) => (
            <label className="check" key={index}>
              <input
                type="radio"
                name={e.id}
                value={index}
                checked={answer === String(index)}
                onChange={(event) => setAnswer(event.target.value)}
              />
              {option}
            </label>
          ))}
        </fieldset>
      ) : (
        <label>
          JavaScript
          <textarea
            className="code"
            spellCheck={false}
            value={code}
            maxLength={20000}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
      )}
      <button
        className="section"
        disabled={busy || (e.kind === "QUIZ" && answer === "")}
        onClick={check}
      >
        {busy
          ? "Перевіряємо…"
          : e.kind === "QUIZ"
            ? "Перевірити відповідь"
            : "Запустити тести"}
      </button>
      {message ? (
        <pre role="status" className="code-results">
          {message}
        </pre>
      ) : null}
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
    </article>
  );
}
