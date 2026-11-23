"use client";
import { useState, type ReactNode, type FormEvent } from "react";
import { useRouter } from "next/navigation";
export async function send(url: string, method: string, data: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Не вдалося виконати дію");
  return result;
}
type Props = {
  url: string;
  method?: string;
  children?: ReactNode;
  label: string;
  redirect?: string;
  values?: Record<string, unknown>;
  jsonFields?: string[];
  numberFields?: string[];
  booleanFields?: string[];
  confirm?: string;
  className?: string;
};
export function RemoteForm({
  url,
  method = "POST",
  children,
  label,
  redirect,
  values = {},
  jsonFields = [],
  numberFields = [],
  booleanFields = [],
  confirm: confirmation,
  className,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmation && !window.confirm(confirmation)) return;
    const data: Record<string, unknown> = {
      ...values,
      ...Object.fromEntries(new FormData(event.currentTarget)),
    };
    setBusy(true);
    setError("");
    setMessage("");
    try {
      for (const key of jsonFields) {
        try {
          data[key] = JSON.parse(String(data[key] || "[]"));
        } catch {
          throw new Error("Некоректний JSON: " + key);
        }
      }
      for (const key of numberFields) data[key] = Number(data[key]);
      for (const key of booleanFields) data[key] = data[key] === "on";
      const result = await send(url, method, data);
      if (redirect) router.push(redirect.replace(":id", result.id || ""));
      setMessage("Збережено");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка мережі");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className={className || "stack"}>
      {children}
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="success">
          {message}
        </p>
      ) : null}
      <button disabled={busy} type="submit">
        {busy ? "Зачекайте…" : label}
      </button>
    </form>
  );
}
export function UploadForm({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        "/api/courses/" + courseId + "/attachments",
        { method: "POST", body: new FormData(form) },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      form.reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка мережі");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={upload} className="stack">
      <label>
        Файл до 5 MB
        <input
          type="file"
          name="file"
          required
          accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.zip"
        />
      </label>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      <button disabled={busy}>Додати файл</button>
    </form>
  );
}
