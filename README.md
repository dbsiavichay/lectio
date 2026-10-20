# Lectio

Estudio guiado de libros, con el libro impreso en la mano: sesiones paso a paso, guía de respuestas bloqueada hasta responder, repasos espaciados (+1/+3/+7/+14), compromisos, diario semanal, referencias por capítulo y sección («Mis páginas»), passkeys y PWA. Formato de cuadernos para otros libros: [docs/formato-cuaderno.md](docs/formato-cuaderno.md).

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind 4 · shadcn/ui (Base UI) · SQLite + Drizzle · argon2id · SimpleWebAuthn · Vitest · Playwright + axe.

## Desarrollo local

```bash
npm ci
npm run db:migrate
LECTIO_PASSWORD='una-clave-larga' npm run user -- create yo "Mi Nombre" --admin
npm run import -- content/fixtures/libro-ejemplo
npm run dev
```

Los libros reales viven en `content/books/<slug>/` y no se versionan, igual que `data/`.

| Comando                                                 | Qué hace                                    |
| ------------------------------------------------------- | ------------------------------------------- |
| `npm run import -- <carpeta> [--dry-run]`               | Valida e importa un paquete de libro.       |
| `npm run user -- create\|password\|list\|delete`        | Administra cuentas.                         |
| `npm run backup`                                        | Respaldo en caliente.                       |
| `npm test` · `npm run test:e2e`                         | Unitarias · E2E (requiere `npm run build`). |
| `npm run lint` · `npm run typecheck` · `npm run format` | Calidad.                                    |

Despliegue: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · Operación: [docs/RUNBOOK.md](docs/RUNBOOK.md).
