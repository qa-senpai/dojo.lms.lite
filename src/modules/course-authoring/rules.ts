import { z } from "zod";
const title = z.string().trim().min(2, "Назва — щонайменше 2 символи").max(180);
export const courseSchema = z.object({
  title,
  description: z.string().max(10000).default(""),
  category: z.string().trim().max(80).default(""),
  published: z.boolean().default(false),
});
export const safeUrl = z
  .string()
  .max(2000)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Потрібне HTTP або HTTPS посилання");
export const chapterSchema = z.object({
  title,
  notes: z.string().max(60000).default(""),
  video_url: safeUrl.default(""),
  homework: z.string().max(10000).default(""),
  published: z.boolean().default(false),
});
export const exerciseSchema = z
  .object({
    title,
    kind: z.enum(["QUIZ", "CODE"]),
    prompt: z.string().min(1).max(10000),
    options: z.array(z.string().trim().min(1).max(1000)).max(8).default([]),
    answer: z.number().int().min(0).max(7).default(0),
    starter: z.string().max(20000).default(""),
    tests: z
      .array(
        z.object({
          input: z.array(z.unknown()).max(10),
          expected: z.unknown(),
        }),
      )
      .max(30)
      .default([]),
  })
  .superRefine((value, ctx) => {
    if (
      value.kind === "QUIZ" &&
      (value.options.length < 2 || value.answer >= value.options.length)
    )
      ctx.addIssue({
        code: "custom",
        message: "Додайте 2–8 варіантів і правильний номер відповіді",
      });
    if (value.kind === "CODE" && value.tests.length < 1)
      ctx.addIssue({
        code: "custom",
        message: "Додайте хоча б один тест для solve(...args)",
      });
  });
export function exactOrder(existing: string[], requested: string[]) {
  return (
    existing.length === requested.length &&
    new Set(requested).size === existing.length &&
    requested.every((id) => existing.includes(id))
  );
}
