# Dojo LMS Lite

## Запуск локально

[Покроковий гайд для студентів](docs/testing/local-setup.md) охоплює встановлення, перший вхід, підключення до SQLite та запуск тесту Playwright.

Потрібен Node.js **22.17+** (рекомендована актуальна 22.x), npm.

```bash
cp .env.example .env
npm ci
npm run db:seed
npm run dev
```

Відкрити **http://localhost:3000**. SQLite автоматично створюється в
`data/dojo.sqlite`. Seed можна повторювати: наявні паролі й курс не стираються.

| Роль          | Email               | Пароль у демонстраційному середовищі |
| ------------- | ------------------- | ------------------------------------ |
| Адміністратор | `admin@dojo.test`   | `Admin-demo-2026!`                   |
| Студент       | `student@dojo.test` | `Student-demo-2026!`                 |

Змінюйте `SEED_*` у `.env` **до першого seed** для власного сервера.
Для HTTP-стенда використовуйте навчальні облікові записи й паролі.
Якщо відкриваєте інший host/port, встановіть точний `APP_URL` і перезапустіть
сервер: він використовується для перевірки Origin, а не для редиректів на HTTPS.

## Production і 512 MB

**Збирайте на робочому комп’ютері або CI, не на VPS з 512 MB.** Dev-сервер,
npm install, TypeScript і Playwright не входять у бюджет production runtime.
Linux release збирайте на Linux тієї ж архітектури, що й VPS.

```bash
npm run build
npm run package:standalone
# Локально для перевірки production:
npm start
```

`release/` містить Next standalone, static/public, автономний `seed.cjs`
і `backup.mjs`; не містить бази даних або `.env`. На VPS потрібні тільки
цей каталог, Node.js і постійний каталог даних. Nginx + systemd конфігурації,
Dockerfile та Linux CI-пакет підготовлені.

Повна інструкція: **[розгортання на VPS](docs/deploy.md)**.
Локальний smoke: 400 запитів, concurrency 4, Node heap 256 MiB;
RSS приблизно **99–179 MiB**, без HTTP-помилок. Це замір на macOS,
а не гарантія навантаження на 1 vCore; [умови перевірки](docs/testing/modular-refactoring-baseline.md).

## Перевірки

```bash
npm run lint
npm run check:boundaries
npm run check:test-ownership
npm run test:unit
npm run test:integration
npm run coverage:unit
npm run build
npx playwright install chromium
npm run test:e2e
npm run package:standalone
node scripts/http-resource-smoke.mjs
```

E2E запускає production-сервер на `127.0.0.1:3106` з окремою тимчасовою
SQLite та видаляє її після прогону. Інтеграційні тести також ізольовані.
Ваші `data/dojo.sqlite`, `.env` та запущений dev-сервер не змінюються.
HTTP/RAM smoke використовує порт 3216 та домен `dojo-lite.test`, який
Chromium локально відображає на 127.0.0.1; `/etc/hosts` не змінюється.

## Для випускного проєкту

[Опис сценаріїв та API](docs/documentation/lms.md) — база для власних тестів.
[Архітектура](docs/architecture/module-boundaries-and-ownership.md) пояснює
власників функціоналу. [Тест-план](docs/testing/capstone.md) містить приклади
завдань для студентів. Готові тести в `tests/` — регресійна перевірка стенда;
викладач може тримати їх окремо від студентського репозиторію тестів.
