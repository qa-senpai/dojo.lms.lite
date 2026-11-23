import { z } from "zod";
export const credentials = z.object({
  email: z.email("Вкажіть коректний email").trim().toLowerCase().max(254),
  password: z.string().min(8, "Пароль — щонайменше 8 символів").max(128),
});
export const registration = credentials.extend({
  name: z.string().trim().min(2, "Вкажіть ім’я").max(80),
});
export function isAdmin(user: { role: string } | null | undefined) {
  return user?.role === "ADMIN";
}
