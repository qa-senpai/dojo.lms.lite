import { randomUUID } from "node:crypto";
import { one, run } from "../src/platform/db/server";
import { hashPassword } from "../src/platform/crypto";
import {
  saveCourse,
  saveChapter,
  saveExercise,
} from "../src/modules/course-authoring/server";
import { credentials } from "../src/modules/accounts/rules";
import type { User } from "../src/modules/accounts/types";
async function account(
  name: string,
  email: string,
  password: string,
  role: User["role"],
) {
  credentials.parse({ email, password });
  const existing = one<User>(
    "SELECT id,name,email,role FROM users WHERE email=?",
    email,
  );
  if (existing) {
    if (existing.role !== role)
      throw new Error("Existing account has a different role: " + email);
    return existing;
  }
  const user = { id: randomUUID(), name, email, role };
  run(
    "INSERT INTO users VALUES (?,?,?,?,?)",
    user.id,
    name,
    email,
    await hashPassword(password),
    role,
  );
  return user;
}
async function main() {
  const admin = await account(
    "Адміністратор",
    process.env.SEED_ADMIN_EMAIL || "admin@dojo.test",
    process.env.SEED_ADMIN_PASSWORD || "Admin-demo-2026!",
    "ADMIN",
  );
  await account(
    "Студент",
    process.env.SEED_STUDENT_EMAIL || "student@dojo.test",
    process.env.SEED_STUDENT_PASSWORD || "Student-demo-2026!",
    "STUDENT",
  );
  if (!one("SELECT id FROM courses WHERE id=?", "demo-playwright")) {
    const course = saveCourse(admin, null, {
      title: "Перші кроки в автоматизації",
      description:
        "Навчальний курс для знайомства з LMS.\n\nПройдіть конспект, виконайте тест і JavaScript-вправу, надішліть домашню роботу. Усі результати зберігаються у вашому кабінеті.",
      category: "Автоматизація",
      published: true,
    });
    run("UPDATE courses SET id=? WHERE id=?", "demo-playwright", course.id);
    const chapter = saveChapter(admin, "demo-playwright", null, {
      title: "Тестування та перша перевірка",
      notes:
        "# Від вимоги до перевірки\n\nАвтоматизований тест перевіряє очікувану поведінку програми.\n\n## Структура Arrange — Act — Assert\n\n1. Підготуйте дані.\n2. Виконайте дію.\n3. Перевірте результат.\n\n```js\nconst actual = 2 + 3;\nconsole.assert(actual === 5);\n```\n\nПерейдіть у вкладку **Вправи**, а потім надішліть ДЗ.",
      homework:
        "Опишіть три сценарії перевірки форми входу: успішний вхід, неправильний пароль і порожній email.",
      published: true,
    });
    saveExercise(admin, "demo-playwright", chapter.id, null, {
      title: "Що перевіряє assert?",
      kind: "QUIZ",
      prompt: "Оберіть правильне твердження.",
      options: [
        "Відповідність результату очікуванню",
        "Швидкість написання коду",
        "Колір редактора",
      ],
      answer: 0,
    });
    saveExercise(admin, "demo-playwright", chapter.id, null, {
      title: "Сума двох чисел",
      kind: "CODE",
      prompt: "Реалізуйте **solve(a, b)**: поверніть суму двох чисел.",
      starter: "function solve(a, b) {\n  // Ваш код\n}",
      tests: [
        { input: [2, 3], expected: 5 },
        { input: [-4, 4], expected: 0 },
        { input: [0, 0], expected: 0 },
      ],
    });
    saveChapter(admin, "demo-playwright", null, {
      title: "Підсумок курсу",
      notes:
        "# Готово до практики\n\nДля завершення курсу прочитайте обидва розділи, виконайте вправи й отримайте зарахування ДЗ.\n\nПоверніться у **Моє навчання**, щоб побачити прогрес.",
      published: true,
    });
  }
  console.log(
    "Demo course ready. Admin: " +
      admin.email +
      ". Passwords come from .env / .env.example; existing passwords are not overwritten.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
