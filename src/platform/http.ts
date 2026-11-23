import { ZodError } from "zod";
import { AppError, demand } from "./errors";
export function appOrigin() {
  const value = process.env.APP_URL || "http://localhost:3000";
  const url = new URL(value);
  demand(
    ["http:", "https:"].includes(url.protocol),
    500,
    "Некоректний APP_URL",
  );
  return url.origin;
}
export function checkOrigin(request: Request) {
  demand(
    request.headers.get("origin") === appOrigin(),
    403,
    "Неприпустиме джерело запиту",
  );
}
export async function boundedBody(request: Request, max = 128 * 1024) {
  const reader = request.body?.getReader();
  demand(reader, 400, "Порожній запит");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new AppError(413, "Завеликий запит");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function jsonBody(request: Request) {
  demand(
    request.headers.get("content-type")?.includes("application/json"),
    415,
    "Потрібен application/json",
  );
  const body = await boundedBody(request);
  try {
    return JSON.parse(body.toString()) as unknown;
  } catch {
    throw new AppError(400, "Некоректний JSON");
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof ZodError)
    return Response.json(
      { error: error.issues[0]?.message || "Перевірте поля" },
      { status: 400 },
    );
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(error);
  return Response.json({ error: "Не вдалося виконати дію" }, { status: 500 });
}
