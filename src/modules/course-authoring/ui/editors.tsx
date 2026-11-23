import Link from "next/link";
import { RemoteForm, UploadForm } from "@/components/ui/remote-form";
import type { Course, Chapter, Exercise } from "../types";
export function CourseForm({ course }: { course?: Course }) {
  return (
    <RemoteForm
      url={"/api/courses" + (course ? "/" + course.id : "")}
      method={course ? "PATCH" : "POST"}
      label={course ? "Зберегти курс" : "Створити курс"}
      redirect={course ? undefined : "/admin/courses/:id"}
      booleanFields={["published"]}
    >
      <label>
        Назва курсу
        <input
          name="title"
          required
          minLength={2}
          maxLength={180}
          defaultValue={course?.title}
        />
      </label>
      <label>
        Опис курсу (Markdown)
        <textarea
          name="description"
          maxLength={10000}
          defaultValue={course?.description}
        />
      </label>
      <label>
        Категорія
        <input name="category" maxLength={80} defaultValue={course?.category} />
      </label>
      <label className="check">
        <input
          type="checkbox"
          name="published"
          defaultChecked={!!course?.published}
        />
        Опубліковано
      </label>
    </RemoteForm>
  );
}
export function ChapterForm({
  courseId,
  chapter,
}: {
  courseId: string;
  chapter?: Chapter;
}) {
  return (
    <RemoteForm
      url={
        "/api/courses/" +
        courseId +
        "/chapters" +
        (chapter ? "/" + chapter.id : "")
      }
      method={chapter ? "PATCH" : "POST"}
      label={chapter ? "Зберегти розділ" : "Створити розділ"}
      redirect={
        chapter ? undefined : "/admin/courses/" + courseId + "/chapters/:id"
      }
      booleanFields={["published"]}
    >
      <label>
        Назва розділу
        <input
          name="title"
          required
          minLength={2}
          maxLength={180}
          defaultValue={chapter?.title}
        />
      </label>
      {chapter ? (
        <>
          <label>
            Конспект (Markdown)
            <textarea
              className="code"
              name="notes"
              maxLength={60000}
              defaultValue={chapter.notes}
            />
          </label>
          <label>
            Посилання на відео
            <input
              type="url"
              name="video_url"
              defaultValue={chapter.video_url}
              placeholder="https://…"
            />
          </label>
          <label>
            Домашнє завдання (Markdown)
            <textarea
              name="homework"
              maxLength={10000}
              defaultValue={chapter.homework}
            />
          </label>
        </>
      ) : null}
      <label className="check">
        <input
          type="checkbox"
          name="published"
          defaultChecked={!!chapter?.published}
        />
        Опубліковано
      </label>
    </RemoteForm>
  );
}
export function ExerciseForm({
  courseId,
  chapterId,
  exercise,
}: {
  courseId: string;
  chapterId: string;
  exercise?: Exercise;
}) {
  return (
    <RemoteForm
      url={
        "/api/courses/" +
        courseId +
        "/chapters/" +
        chapterId +
        "/exercises" +
        (exercise ? "/" + exercise.id : "")
      }
      method={exercise ? "PATCH" : "POST"}
      label={exercise ? "Зберегти вправу" : "Додати вправу"}
      jsonFields={["options", "tests"]}
      numberFields={["answer"]}
    >
      <label>
        Назва вправи
        <input
          name="title"
          required
          minLength={2}
          maxLength={180}
          defaultValue={exercise?.title}
        />
      </label>
      <label>
        Тип
        <select name="kind" defaultValue={exercise?.kind || "QUIZ"}>
          <option value="QUIZ">Тест</option>
          <option value="CODE">JavaScript</option>
        </select>
      </label>
      <label>
        Умова
        <textarea
          name="prompt"
          required
          maxLength={10000}
          defaultValue={exercise?.prompt}
        />
      </label>
      <label>
        Варіанти тесту (JSON масив рядків)
        <textarea
          className="code"
          name="options"
          defaultValue={
            exercise?.options || '["Перший варіант", "Другий варіант"]'
          }
        />
      </label>
      <label>
        Правильна відповідь тесту (нумерація від 0)
        <input
          type="number"
          name="answer"
          min={0}
          max={7}
          defaultValue={exercise?.answer || 0}
        />
      </label>
      <label>
        Стартовий JavaScript — функція solve
        <textarea
          className="code"
          name="starter"
          maxLength={20000}
          defaultValue={
            exercise?.starter || "function solve(a, b) {\n  return a + b;\n}"
          }
        />
      </label>
      <label>
        Тести JavaScript (JSON)
        <textarea
          className="code"
          name="tests"
          defaultValue={exercise?.tests || '[{"input": [2, 3], "expected": 5}]'}
        />
      </label>
      <p className="muted">
        Для тесту використовуються варіанти й правильна відповідь. Для
        JavaScript — стартовий код та перевірки solve(...input). Зміна вправи
        скидає її результати.
      </p>
    </RemoteForm>
  );
}
export function OrderedList({
  courseId,
  items,
  chapterId,
}: {
  courseId: string;
  items: { id: string; title: string }[];
  chapterId?: string;
}) {
  return (
    <ol className="list">
      {items.map((item, index) => {
        const move = (offset: number) => {
          const ids = items.map((i) => i.id);
          [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
          return ids;
        };
        return (
          <li key={item.id} className="split">
            <span>
              {index + 1}.{" "}
              {chapterId ? (
                item.title
              ) : (
                <Link
                  href={"/admin/courses/" + courseId + "/chapters/" + item.id}
                >
                  {item.title}
                </Link>
              )}
            </span>
            <div className="row">
              {index > 0 ? (
                <RemoteForm
                  className="inline"
                  url={
                    "/api/courses/" +
                    courseId +
                    "/chapters/" +
                    (chapterId ? chapterId + "/exercises/" : "") +
                    "reorder"
                  }
                  values={{ ids: move(-1) }}
                  label={"↑ " + item.title}
                />
              ) : null}
              {index < items.length - 1 ? (
                <RemoteForm
                  className="inline"
                  url={
                    "/api/courses/" +
                    courseId +
                    "/chapters/" +
                    (chapterId ? chapterId + "/exercises/" : "") +
                    "reorder"
                  }
                  values={{ ids: move(1) }}
                  label={"↓ " + item.title}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
export function AttachmentsEditor({
  courseId,
  files,
}: {
  courseId: string;
  files: { id: string; name: string }[];
}) {
  return (
    <div className="stack">
      <UploadForm courseId={courseId} />
      <ul className="list">
        {files.map((f) => (
          <li className="split" key={f.id}>
            <a href={"/api/courses/" + courseId + "/attachments/" + f.id}>
              {f.name}
            </a>
            <RemoteForm
              className="inline"
              url={"/api/courses/" + courseId + "/attachments/" + f.id}
              method="DELETE"
              label="Видалити файл"
              confirm={"Видалити " + f.name + "?"}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
