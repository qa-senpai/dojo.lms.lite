import {
  test as base,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
export const origin = "http://127.0.0.1:3106";
export const test = base;
export { expect };
export async function login(page: Page, role: "admin" | "student" = "admin") {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(role + "@dojo.test");
  await page
    .getByLabel("Пароль", { exact: true })
    .fill(role === "admin" ? "Admin-demo-2026!" : "Student-demo-2026!");
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
export async function apiLogin(
  request: APIRequestContext,
  role: "admin" | "student" = "admin",
) {
  const response = await request.post("/api/auth/sign-in", {
    headers: { Origin: origin },
    data: {
      email: role + "@dojo.test",
      password: role === "admin" ? "Admin-demo-2026!" : "Student-demo-2026!",
    },
  });
  expect(response.status()).toBe(200);
}
export async function createCourse(
  request: APIRequestContext,
  extra: Record<string, unknown> = {},
) {
  const response = await request.post("/api/courses", {
    headers: { Origin: origin },
    data: { title: "Course " + Date.now(), published: true, ...extra },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).id as string;
}
