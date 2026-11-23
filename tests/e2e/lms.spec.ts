import { test, expect, login, origin, createCourse } from "../support/helpers";
test("root redirects to courses; registration, session persistence and logout over HTTP", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/courses$/);
  await expect(
    page.getByRole("heading", { name: "Курси", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Зареєструватися", exact: true })
    .click();
  await page.getByLabel("Ім’я", { exact: true }).fill("Новий Студент");
  await page
    .getByLabel("Email", { exact: true })
    .fill("new-" + Date.now() + "@dojo.test");
  await page.getByLabel("Пароль", { exact: true }).fill("Password123!");
  await page
    .getByRole("button", { name: "Зареєструватися", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
  await page.reload();
  await expect(page.getByText("Ви ще не записані на курси.")).toBeVisible();
  const session = (await context.cookies()).find(
    (c) => c.name === "dojo_session",
  );
  expect(session?.secure).toBe(false);
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");
  await page.getByRole("button", { name: "Вийти", exact: true }).click();
  await expect(page).toHaveURL(/sign-in/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/sign-in/);
});
test("invalid login reports a useful error and exposes no OAuth buttons", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await expect(page.getByText(/Google|GitHub/)).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill("nobody@dojo.test");
  await page.getByLabel("Пароль", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "Неправильний email або пароль",
  );
});
test("admin creates, edits, reorders and deletes a course and its chapters", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("link", { name: "Керування курсами", exact: true })
    .click();
  const title = "Browser course " + Date.now();
  await page.getByLabel("Назва курсу", { exact: true }).fill(title);
  await page
    .getByLabel("Опис курсу (Markdown)", { exact: true })
    .fill("A browser-authored course");
  await page.getByLabel("Категорія", { exact: true }).fill("QA");
  await page
    .getByRole("button", { name: "Створити курс", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/courses\/[^/]+$/);
  const courseUrl = page.url();
  await page
    .locator("form")
    .filter({
      has: page.getByRole("button", { name: "Зберегти курс", exact: true }),
    })
    .getByLabel("Опубліковано", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Зберегти курс", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Збережено");
  await page.getByText("Новий розділ", { exact: true }).click();
  await page.getByLabel("Назва розділу", { exact: true }).fill("Chapter A");
  await page
    .getByRole("button", { name: "Створити розділ", exact: true })
    .click();
  await expect(page).toHaveURL(/chapters/);
  await page
    .getByLabel("Конспект (Markdown)", { exact: true })
    .fill("# Notes\nReadable content");
  await page.getByLabel("Опубліковано", { exact: true }).check();
  await page
    .getByRole("button", { name: "Зберегти розділ", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Збережено");
  await page.goto(courseUrl);
  await page.getByText("Новий розділ", { exact: true }).click();
  await page.getByLabel("Назва розділу", { exact: true }).fill("Chapter B");
  await page
    .getByRole("button", { name: "Створити розділ", exact: true })
    .click();
  await expect(page).toHaveURL(/chapters/);
  await page.goto(courseUrl);
  await page.getByRole("button", { name: "↑ Chapter B", exact: true }).click();
  await expect(page.locator("ol.list li").first()).toContainText("Chapter B");
  await page.getByLabel("Назва курсу", { exact: true }).fill(title + " edited");
  await page
    .getByRole("button", { name: "Зберегти курс", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    title + " edited",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Видалити курс", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/courses$/);
  await expect(
    page.getByRole("link", { name: title + " edited", exact: true }),
  ).toHaveCount(0);
});
test("student completes quiz, isolated coding and homework with manual review", async ({
  page,
  browser,
}) => {
  await login(page, "student");
  await page.goto("/courses/demo-playwright");
  await page
    .getByRole("button", { name: "Записатися на курс", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Перейти до навчання" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Перейти до навчання" }).click();
  await expect(page).toHaveURL(/\/learn\/demo-playwright\//);
  const lessonUrl = page.url();
  await page
    .getByRole("button", { name: "Позначити як прочитане", exact: true })
    .click();
  await expect(page.getByText("✓ Конспект прочитано")).toBeVisible();
  await page.getByRole("tab", { name: "Вправи", exact: true }).click();
  await page.getByLabel("Швидкість написання коду").check();
  await page
    .getByRole("button", { name: "Перевірити відповідь", exact: true })
    .click();
  await expect(
    page.getByText("Відповідь неправильна. Спробуйте ще раз."),
  ).toBeVisible();
  await page.getByLabel("Відповідність результату очікуванню").check();
  await page
    .getByRole("button", { name: "Перевірити відповідь", exact: true })
    .click();
  await expect(page.getByText("✓ Правильно!", { exact: true })).toBeVisible();
  await page
    .getByRole("textbox", { name: "JavaScript", exact: true })
    .fill("function solve(a,b) { return a+b; }");
  await page
    .getByRole("button", { name: "Запустити тести", exact: true })
    .click();
  await expect(page.getByText("✓ Тест 3", { exact: false })).toBeVisible();
  await page
    .getByRole("textbox", { name: "JavaScript", exact: true })
    .fill("function solve() { while(true){} }");
  await page
    .getByRole("button", { name: "Запустити тести", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "Час виконання перевищено (5 секунд)",
    { timeout: 8000 },
  );
  await page.getByRole("tab", { name: "ДЗ", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Відповідь або посилання", exact: true })
    .fill("Three test scenarios");
  await page
    .getByRole("button", { name: "Надіслати роботу", exact: true })
    .click();
  await expect(
    page.getByText("Очікує перевірки", { exact: true }),
  ).toBeVisible();
  const adminContext = await browser.newContext({ baseURL: origin });
  const admin = await adminContext.newPage();
  await login(admin);
  await admin.goto("/admin/courses/demo-playwright");
  await admin
    .getByText(/Студент · Тестування та перша перевірка · Очікує перевірки/)
    .click();
  await admin
    .getByRole("combobox", { name: "Рішення", exact: true })
    .selectOption("REVISION");
  await admin
    .getByRole("textbox", { name: "Коментар", exact: true })
    .fill("Додайте негативний сценарій");
  await admin.getByRole("button", { name: "Зберегти перевірку" }).click();
  await expect(
    admin.getByText(
      /Студент · Тестування та перша перевірка · Потрібне доопрацювання/,
    ),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "ДЗ", exact: true }).click();
  await expect(page.getByText("Додайте негативний сценарій")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Відповідь або посилання", exact: true })
    .fill("Success, wrong password, empty email");
  await page
    .getByRole("button", { name: "Надіслати повторно", exact: true })
    .click();
  await expect(
    page.getByText("Очікує перевірки", { exact: true }),
  ).toBeVisible();
  await admin.reload();
  await admin
    .getByText(/Студент · Тестування та перша перевірка · Очікує перевірки/)
    .click();
  await admin
    .getByRole("combobox", { name: "Рішення", exact: true })
    .selectOption("ACCEPTED");
  await admin.getByRole("button", { name: "Зберегти перевірку" }).click();
  await expect(
    admin.getByText(/Студент · Тестування та перша перевірка · Зараховано/),
  ).toBeVisible();
  await adminContext.close();
  await page.goto(lessonUrl);
  await page
    .getByRole("link", { name: "Наступний розділ →", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Позначити як прочитане", exact: true })
    .click();
  await expect(page.getByText("✓ Конспект прочитано")).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await page.goto("/admin/courses");
  await expect(page).toHaveURL(/dashboard/);
});
test("catalog filters and mobile layout remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/courses");
  await page.getByLabel("Пошук", { exact: true }).fill("no-such-course");
  await page.getByRole("button", { name: "Знайти", exact: true }).click();
  await expect(
    page.getByText("Курсів не знайдено. Спробуйте інший запит."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Скинути", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Перші кроки в автоматизації" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "temp/test-artifacts/mobile-catalog.png",
    fullPage: true,
  });
});

test("admin authors an exercise and uploads a downloadable course file", async ({
  page,
}) => {
  await login(page);
  const id = await createCourse(page.request, {
    title: "Exercise editor " + Date.now(),
  });
  const created = await page.request.post("/api/courses/" + id + "/chapters", {
    headers: { Origin: origin },
    data: { title: "Exercise chapter", published: true },
  });
  expect(created.status()).toBe(201);
  const chapterId = (await created.json()).id;
  await page.goto("/admin/courses/" + id + "/chapters/" + chapterId);
  await page.getByText("Нова вправа", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Назва вправи", exact: true })
    .fill("Browser quiz");
  await page
    .getByRole("textbox", { name: "Умова", exact: true })
    .fill("Choose the first option");
  await page
    .getByRole("button", { name: "Додати вправу", exact: true })
    .click();
  await expect(
    page.locator("summary").filter({ hasText: "Browser quiz" }),
  ).toBeVisible();
  await page.goto("/admin/courses/" + id + "/chapters/" + chapterId);
  await page.locator("summary").filter({ hasText: "Browser quiz" }).click();
  await page
    .getByRole("spinbutton", {
      name: "Правильна відповідь тесту (нумерація від 0)",
      exact: true,
    })
    .first()
    .fill("1");
  await page
    .getByRole("button", { name: "Зберегти вправу", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Збережено");
  const data = await page.request.get(
    "/api/admin/courses/" + id + "/chapters/" + chapterId,
  );
  expect((await data.json()).exercises[0].answer).toBe(1);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Видалити вправу", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Вправи (0)", exact: true }),
  ).toBeVisible();
  await page.goto("/admin/courses/" + id);
  await page
    .getByLabel("Файл до 5 MB", { exact: true })
    .setInputFiles({
      name: "browser-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Browser attachment"),
    });
  await page.getByRole("button", { name: "Додати файл", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "browser-notes.txt", exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "browser-notes.txt", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("browser-notes.txt");
  expect(await download.failure()).toBeNull();
  await page.request.delete("/api/courses/" + id, {
    headers: { Origin: origin },
    data: {},
  });
});
