# CLAUDE.md

Guidance for working in this repository.

## What this is

A pnpm + Turborepo monorepo for the Ameen packaging platform. `docs/ARCHITECTURE.md`
is the source of truth for the design; read it before making non-trivial changes.

## Commands

```bash
pnpm install          # install all workspace deps
pnpm dev              # API (:4000) + admin console (:5175)
pnpm build            # build every package (turbo)
pnpm lint             # eslint .
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest (unit + integration)
pnpm test:unit        # unit tests only
pnpm seed             # demo staff accounts (password: Password123!)
pnpm format           # prettier
```

`docker compose up -d` starts MongoDB (single-node replica set), Redis and MinIO.

## Architecture rules

- `packages/domain` is **pure** — no I/O, no Mongoose, no Express. It throws
  `DomainError` (never `AppError`); the API maps domain errors onto `AppError`.
- API modules follow `routes → controller → service → repository → model`.
  Controllers never touch Mongoose; services own business rules and transactions;
  repositories own queries only.
- Money is **integer paise** everywhere. Use `packages/domain/src/money`.
- Every request body/query/param is parsed by a zod schema at the route boundary
  via `validate(schema, source)`; controllers read `req.valid`.
- Errors use the single `AppError` / problem+json envelope.
- Business rules that must run in both the browser and the server live in
  `packages/domain`, not in a service.

## Office module (`apps/api/src/modules/office`)

Role-gated office_admin workspace (`/office/*`, permission `office:read`):
My Day, order desk, routes, outstanding, dispatch, registers 1–9, controls.

- Registers live at `/office/registers/*` (courier, stationery, indents,
  maintenance, waste, petty-cash, vendor-tracker, documents, attendance).
  Query `?format=csv` exports CSV; PDF export is deferred.
- Controls: `GET/POST/PATCH /office/reminders`, `GET/PUT /office/matrix`,
  `GET /office/channels`, `GET/POST /office/deviations`.
- Reminder rules run on BullMQ (`QueueName.OfficeReminders`, cron tz
  Asia/Kolkata); workers call `syncOfficeReminders()` on boot.
- Delegation matrix defaults are in `office.model.ts` (`DELEGATION_DEFAULTS`);
  writes without a delegation row throw domain `NOT_DELEGATED` → 403 and limit
  violations → 409 (see `errorHandler.ts`).
- Reminder PATCH routes address rules by **key**, not ObjectId.

## Conventions

- TypeScript `strict` + `noUncheckedIndexedAccess`. Handle `undefined` explicitly.
- ESM with `.js` extensions on relative imports.
- Tests are colocated in `packages/domain` (`*.spec.ts`) and under `apps/api/tests`.
- Commit messages are imperative and concise.
