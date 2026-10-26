# Ameen Packaging — Platform

Digital platform for a packaging-box manufacturer in Tamil Nadu, India. Customers
are bakeries and broast/chicken shops that order parcel boxes in bulk.

The architecture is specified in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
The implementation covers auth/users, orders/payments, production, inventory,
delivery, purchasing, CRM/reports and the office_admin workspace
(see [`docs/OFFICE_ADMIN_PLAN.md`](docs/OFFICE_ADMIN_PLAN.md)).

## Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **Runtime:** Node 22, TypeScript 5 `strict`, ESM
- **API:** Express, Mongoose (MongoDB), ioredis (Redis), BullMQ, Socket.IO, zod
- **Web:** React + Vite + Tailwind
- **Domain:** pure TypeScript business logic in `packages/domain` (shared client/server)

## Layout

```
apps/
  api/          Express API (auth, users, orders, production, inventory,
                delivery, purchasing, crm, reports, office)
  admin-web/    Admin / OMS console (incl. role-gated office pages)
packages/
  domain/       money, permissions, order/production state machines, BOM, pricing
tools/
  seed/         demo data (seed lives in apps/api/src/scripts/seed.ts)
```

## Prerequisites

- Node.js >= 22
- pnpm >= 9 (`corepack enable`)
- Docker (for MongoDB replica set, Redis, MinIO)

## Getting started

```bash
pnpm install
cp .env.example .env
docker compose up -d          # mongo (replica set), redis, minio
pnpm seed                     # demo staff accounts
pnpm dev                      # API on :4000, admin console on :5175
```

Seeded staff logins use the phone numbers in `apps/api/src/scripts/seed.ts` with
the password `Password123!`.

### Environment

`apps/api/src/config/env.ts` validates `process.env` with zod at startup and fails
loudly if a required production secret is missing. In development, ephemeral RSA
keys and a dev cookie secret are generated automatically.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run the API and web apps in watch mode |
| `pnpm build` | Build every package |
| `pnpm lint` | ESLint every package |
| `pnpm typecheck` | TypeScript `--noEmit` every package |
| `pnpm test` | Vitest (unit + integration) |
| `pnpm test:unit` | Unit tests only |
| `pnpm seed` | Seed demo data |
| `pnpm format` | Prettier |

## Testing

- `packages/domain` — pure-function unit tests (money, pricing, BOM, state machines, RBAC).
- `apps/api` — unit tests for strategies/utils and integration tests for the auth
  flow, order/production/inventory/delivery/purchasing/crm/reports modules and the
  office module (`office-registers`, `office-controls`), backed by
  `mongodb-memory-server` (single-node replica set) and supertest.

## Milestones

- Core platform: see `docs/ARCHITECTURE.md` §9.
- Office admin workspace: `docs/OFFICE_ADMIN_PLAN.md` §10 — **M0–M8 done**
  (84 domain + 3 i18n + 53 api tests, gate fully green). Registers 1–9 live
  under `/office/registers/*` with CSV export; PDF export is deferred.
