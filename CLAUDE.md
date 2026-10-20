@AGENTS.md

# Lectio

Guided book study app (Next.js 16 App Router with Cache Components, React 19, SQLite + Drizzle). See README.md.

- **Book content is copyrighted personal material.** `content/books/` and `data/` are gitignored and must never be committed, copied into the Docker image or the CI. Tests use `content/fixtures/libro-ejemplo`.
- References to the book are by chapter › section (`[[Cap. 1 › Sección]]`), never by page: users study with a printed copy. Every ref must exist in the book's `sections.json`.
- Field keys (question codes, `unit.step.label-slug`) are how user answers are stored: changing the parser's key scheme or a notebook's labels orphans saved answers.
- With Cache Components, read the session only inside `<Suspense>`; `readSession()` calls `connection()` before using the clock.
- Every Server Action authorizes through `authorizeAction()` / `requireAdmin()` and validates input with zod; the answer guide is only returned once the user's answer is saved (`revealAnswerAction`).
- Checks: `npm run lint && npm run typecheck && npm test`, and `npm run build && npm run test:e2e` for UI changes. UI copy is neutral Spanish (tuteo, never voseo); code comments in English.
- Deploy: `docs/DEPLOYMENT.md` (shared edge Caddy on the VPS, GHCR, `deploy/`).
