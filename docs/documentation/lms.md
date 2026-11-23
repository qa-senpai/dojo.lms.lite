# LMS Lite: поведінка і API

## Основні правила

Усі публічні курси безкоштовні. Студент реєструється і сам записується на курс;
адміністратор може додати зареєстрованого студента за email або відкликати
доступ. Оскільки каталог відкритий, відкликаний студент може записатися знову;
це не бан. Старий прогрес при відкликанні зберігається.

Чернетки курсів/розділів приховані від студентів. Адміністратор може відкрити
чернетку розділу для попереднього перегляду. Публічний `/courses/:id` показує
тільки published course; його програма не містить приватний текст уроків.
Вміст розділу й файли потребують enrollment або admin role.

Завершення курсу = кожен **опублікований** розділ прочитано + всі його вправи
виконано + усі задані ДЗ мають ACCEPTED. Порожній курс має 0%, не 100%.
Новий опублікований розділ/вправа змінює знаменник прогресу. Редагування вправи
скидає результати цієї вправи. Невдала спроба після успіху не скасовує успіх.

QUIZ має 2–8 варіантів і одну правильну відповідь; grading на сервері.
Правильний answer не надходить у студентський player JSON/RSC.
CODE: функція `solve(...input)` повертає JSON-сумісний результат, який
порівнюється з expected; порядок ключів об’єкта не має значення. До 30 тестів,
код до 20 000 символів, timeout 5 секунд. Код виконується в Worker усередині
sandboxed iframe з opaque origin та CSP без мережі, не на Node-сервері.
Результат CODE підтверджує браузер; це навчальний прогрес, а не захищена
атестація — навмисний клієнт може підробити passed. У client не використовуються
Secure Context API, тож виконання працює на звичайному HTTP-домені.

ДЗ: PENDING → REVISION (обов’язковий коментар) → повторна подача PENDING →
ACCEPTED. Прийняте ДЗ не можна переписати студентом. Адміністратор може повернути
його на доопрацювання. У відповідях немає автоматичного GitHub/LLM/SMTP ефекту.

Відео: для прямого mp4/webm/ogg URL — native player, для інших URL — посилання
в новій вкладці. YouTube/Vimeo API, приватний video hosting та embed SDK не потрібні.
Markdown не виконує raw HTML. Вкладення 1 байт–5 MiB: PDF/TXT/MD/CSV/JSON/PNG/JPG/ZIP,
у SQLite BLOB; скачування як octet-stream attachment з nosniff і перевіркою доступу.

Для авторів курсу є окрема [інструкція зі створення quiz і JavaScript-задач із JSON-прикладами](exercises.md).

## HTTP API

JSON mutations мають `Content-Type: application/json` та `Origin: <APP_URL>`.
Сесія — cookie `dojo_session`; роль/ідентифікатор беруться тільки із сесії.
Неавторизований запит — 401; недостатні права — 403; невидимий/відсутній
ресурс — 404; invalid input — 400; duplicate registration/accepted resubmit —
409; body >128 KiB — 413; auth throttle — 429. Відповіді API: private, no-store.

| Метод | URL | Поведінка |
| --- | --- | --- |
| POST | `/api/auth/sign-up` | `{name,email,password}`, автоматичний вхід |
| POST | `/api/auth/sign-in` | `{email,password}` |
| POST | `/api/auth/sign-out` | Відкликати сесію |
| GET | `/api/health` | `{status:"ok"}` — процес відповідає |
| GET | `/api/courses?q=…` | Публічні курси |
| GET | `/api/courses/:courseId` | Опис і назви published розділів |
| POST/PATCH/DELETE | `/api/courses[/:courseId]` | Admin CRUD |
| GET | `/api/admin/courses[/:courseId]` | Admin reads |
| POST | `/api/courses/:courseId/enroll` | Самостійний запис |
| POST/DELETE | `/api/courses/:courseId/students` | Admin grant/revoke `{email}` |
| POST/PATCH/DELETE | `/api/courses/:courseId/chapters[/:chapterId]` | Admin chapter CRUD |
| GET | `/api/courses/:courseId/chapters/:chapterId` | Дозволений player, без quiz answer |
| GET | `/api/admin/courses/:courseId/chapters/:chapterId` | Admin chapter + exercise answers |
| POST | `/api/courses/:courseId/chapters/reorder` | `{ids:[…]}` — усі chapter IDs без повторів |
| POST/PATCH/DELETE | `/api/courses/:courseId/chapters/:chapterId/exercises[/:exerciseId]` | Admin exercise CRUD |
| POST | `…/chapters/:chapterId/exercises/reorder` | `{ids:[…]}` — усі exercise IDs |
| POST | `…/chapters/:chapterId/exercises/:exerciseId/attempt` | Quiz `{answer:0}` або code `{code,passed}` |
| POST | `…/chapters/:chapterId/progress` | `{done:true}` — прочитаний конспект |
| POST | `…/chapters/:chapterId/homework` | `{content:"…"}` |
| PATCH | `/api/courses/:courseId/reviews/:submissionId` | `{status:"ACCEPTED"|"REVISION",feedback}` |
| POST | `/api/courses/:courseId/attachments` | Admin multipart, поле `file` |
| GET/DELETE | `/api/courses/:courseId/attachments/:fileId` | Authorized download / admin delete |

Course fields: `title`, `description`, `category`, `published` (boolean).
Chapter: `title`, `notes`, `video_url`, `homework`, `published`.
Exercise: `title`, `kind: QUIZ|CODE`, `prompt`, `options:string[]`, `answer:number`
(index від 0), `starter:string`, `tests:[{input:unknown[],expected:unknown}]`.
PATCH у lite — збереження повної форми: пропущені необов’язкові поля отримують
defaults, тому надсилайте всі поля, які потрібно зберегти.

## Дані та перевірки

SQLite schema: `src/platform/db/server.ts`, foreign keys/cascades увімкнено,
короткі багатокрокові writes — BEGIN IMMEDIATE. Записи перетворюються на plain
objects перед React props; нативний SQLite повертає null-prototype records.
Схема має version 1. Import production MariaDB dump не підтримується.

Перевірки: rules/crypto/http unit; `tests/integration.test.ts` із реальною
тимчасовою SQLite; `tests/e2e/lms.spec.ts` і `tests/api/security.spec.ts`;
`http-resource-smoke.mjs` перевіряє зібраний standalone, HTTP insecure origin,
відсутність сторонніх запитів, RSS та online backup. Докладні фактичні
результати — [verification baseline](../testing/modular-refactoring-baseline.md).
