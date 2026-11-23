# Dojo LMS Lite

Read docs/architecture/module-boundaries-and-ownership.md before changing code.
Modular monolith: app is transport; modules own business rules. Cross-module
imports use server/client/types/rules public entries. Keep Ukrainian UI and
brand-book tokens. Read installed Next.js docs before Next code changes.
Run npm run lint, npm run check:boundaries, npm run test:unit,
npm run test:integration, npm run build and npm run test:e2e.
Tests use isolated temporary SQLite databases, never data/dojo.sqlite.
Never add external auth/payments/email/analytics or a separate database server
without revisiting the 512 MB deployment requirement. Do not copy secrets
or student data from the parent dojo.lms repository.
