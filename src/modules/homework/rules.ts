import { z } from "zod";
export const submissionSchema = z.object({
  content: z
    .string()
    .trim()
    .min(3, "Додайте відповідь або посилання")
    .max(10000),
});
export const reviewSchema = z
  .object({
    status: z.enum(["ACCEPTED", "REVISION"]),
    feedback: z.string().trim().max(5000).default(""),
  })
  .refine(
    (v) => v.status !== "REVISION" || v.feedback.length > 0,
    "Поясніть, що потрібно доопрацювати",
  );
export const statusLabels: Record<string, string> = {
  PENDING: "Очікує перевірки",
  REVISION: "Потрібне доопрацювання",
  ACCEPTED: "Зараховано",
};
