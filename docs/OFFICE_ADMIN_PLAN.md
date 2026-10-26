# Office Administrator Modules — Implementation Plan

Status: **Proposed — awaiting approval** · Written 2026-10-22
Scope: new `office_admin` role + "My Day", Sales Order Desk, follow-up/routes,
outstanding payments, dispatch/complaints/stock alerts, registers, and
controls/audit tooling. Everything follows `docs/ARCHITECTURE.md` conventions.

---

## 0. Current-state findings (what we build on)

| Existing piece | Where | Reuse / change |
|---|---|---|
| RBAC matrix (single source of truth) | `packages/domain/src/auth/permissions.ts` (`Role`, `Permission`, `rolePermissions`) | Add `OfficeAdmin` role + new office permissions; both API guard (`requirePermission`) and web `useCan()` read it |
| AppError + problem+json, zod `validate()` | `apps/api/src/core/errors`, `core/validation` | Unchanged — all new routes follow the same pattern |
| Audit | `apps/api/src/modules/audit/audit.model.ts` (append-only, 2y TTL) + `core/middleware/audit.ts` (`audit(action, entityType)` wrapper, captures before/after) | Extend usage to **every** office write; handlers set `res.locals.auditBefore` |
| BullMQ queue registry | `apps/api/src/jobs/queues.ts` + `worker.ts` | Add `OfficeReminders` queue with repeatable scheduled jobs |
| Notifications | `apps/api/src/modules/notifications/otpNotifier.ts` only | Build a general `notificationLog` + channel config service (WhatsApp/SMS/in-app) with message logging |
| Counters (`nextCounter`) | `apps/api/src/modules/counters/counter.model.ts` | Register numbers/codes (`CR-…`, `IND-…`, …) |
| Customers | `apps/api/src/modules/crm/crm.model.ts` (`notes`, `addresses`, `creditLimit`, `creditUsed`, `paymentTermsDays`) | Extend with `deskNotes` (preferred language, box-size habits, follow-up prefs) |
| Orders | `stateHistory` exists; workflow stretcher below | Add office desk step log (own collection, keyed by order) |
| Invoice model | `apps/api/src/modules/payments/payments.model.ts` | Add `printCount`, `printedAt[]` for bill print tracking |
| Inventory low stock | `GET /inventory/stock/low` exists | Add acknowledgement tracking alert |
| i18n | none yet | New `packages/i18n` (en/ta/ml dictionaries), user `locale` extended |

---

## 1. RBAC — role and permission changes

### 1.1 New role

```
Role.OfficeAdmin = 'office_admin'
```

### 1.2 New permissions (all registered in `Permission`)

| Permission | Grants |
|---|---|
| `office:read` | Read all office modules (registers, tasks, checklists, follow-ups, deviations, documents) |
| `office:write` | Create/update office records (tasks, registers, follow-ups, call logs, complaints, escalations) |
| `orders:desk` | Step the sales-order-desk workflow (checked → confirmed → …) incl. bill print recording |
| `office:pettycash` | Petty cash register entries and reconciliation (assignable per user via delegation matrix) |
| `office:employee:read` / `office:employee:write` | Restricted-access employee records (field-level guarded) |
| `office:matrix:read` / `office:matrix:write` | Read/configure the delegation-of-authority matrix and notification channels (admin only — *not* granted to office_admin) |
| `office:documents:authorize` | Written-authorization + approval for document removal / obsoletion (admin only) |

### 1.3 `office_admin` full grant list

Read (cannot be removed by the role): `orders:read:all` (view orders, customers,
stock and dispatch), `catalog:read`, `pricing:read`, `crm:read`, `inventory:read`,
`delivery:read`, `production:read`, `reports:read`, `notifications:read/write`,
`audit:read`, `office:read/write`, `orders:desk`, plus finance-view
(`payments/invoices` read is covered by `orders:read:all`).
Writes it also gets: existing `orders:write` (create/update order notes claims as today, no
status transitions beyond desk steps — desk steps are gated by `orders:desk`), `crm:write`
(follow-up notes only), `office:employee:*` if delegated.

### 1.4 Denial list (enforced by the matrix — office_admin explicitly lacks)

- `pricing:write`, `catalog:write`, `purchasing:write`, `settings:write`
  → cannot create/alter prices, discounts, price rules, SKUs, POs/invoice approvals;
  invoice writes (`POST/PATCH/DELETE /payments/invoices`) already sit behind `settings:write`, so they stay read-only.
- `production:write` → cannot touch QC results, batch/lot numbers, material specs, stage status.
- `inventory:write`, `delivery:write`, `driver:write` → cannot change
  stock movements, GRNs, dispatch/traceability records.
- `users:write`, `office:matrix:write`, `office:documents:authorize`,
  `orders:cancel`, DELETE endpoints in orders/invoices/purchasing → no hard
  deletes, no backdating/overwriting of official records (services also
  *append-only enforce*: registers append lines or supersede with a new revision, never overwrite history).
- Every correction to a guarded area goes through the owning role; the change
  lands in `audit_logs` with before/after (already captured by the audit middleware).

### 1.5 Delegation-of-authority matrix (configurable, audited)

New collection `delegation_matrix`:
```
{ role, action, limitPaise|null, limitQty|null, active, updatedBy, updatedAt }
```
Pure checker in `packages/domain` (`auth/delegation.ts`):
`assertDelegation(role, action, amountPaise?)` throws `DomainError` when the
action is unapproved or the amount exceeds the limit. Seeded defaults:
office_admin may create indents/production requests up to ₹25,000 and never
approve invoices; admin unlimited. Config endpoints update the matrix
(`office:matrix:write`) with full audit trail.

---

## 2. Data model — new collections

All follow house rules: integer-paise money, `timestamps: true`, `schemaVersion`.
"E" = existing model touched, "N" = new collection.

| # | Collection | Purpose / key fields |
|---|---|---|
| E1 | `users` | Add `'office_admin'` to role enum; `locale` enum extended to `en|ta|ml`; seed office admin |
| E2 | `customers` | Add `deskNotes { preferredLanguage, boxSizeHabits[], otherReplies, followUpPrefs }` — shown on order screen |
| E3 | `invoices` | Add `printCount`, `prints[{ at, by }]` |
| E4 | `inventory` (materials) | Keep `minQty`; add `minQtyAlertAck { by, at, note? }` cleared on restock |
| N1 | `checklist_items` | Opening/closing templates (kind, labelEn/Ta/Ml, order, mandatory, active) |
| N2 | `checklist_submissions` | One per kind+day (unique index), items[] with `done, note, at` — no backdate guard enforced server-side (`date` must be today unless admin) |
| N3 | `office_tasks` | Owner, title, due, priority, status, source; the "shared inbox / pending items" filter; urgent flag |
| N4 | `appointments` | Visitors & meetings: person/org/contact, host, purpose, time in/out, ID + restricted-area flag (doubles as "today's visitors") |
| N5 | `order_desk_steps` | `{ orderId, step, at, by, note }` — the ordered desk workflow log (see §3) |
| N6 | `route_schedules` | Weekly routes: `weekday, area, kind (retail/wholesale), customers[], active` — seeded Tue Wandoor / Thu Vengara / Sat Perinthalmanna |
| N7 | `call_logs` | Customer contact log: `{ customerId, date, channel (call/whatsapp/voice), outcome, nextAction, nextActionDate }` |
| N8 | `outstanding_followups` | Per customer/day: `amountPaise (snapshot), promiseDate, outcome, by`; auto-escalation flags (see §5) |
| N9 | `small_outstanding_ledger` | Carry-forward entries `{ customerId, amountPaise, settleByOrder?: orderId, settled, settledOnOrder }` — surfaced as "settle against next order" at order entry |
| N10 | `daily_cash_close` | Per delivered sale / day: `date, invoiceId, orderId, customerId, collectedPaise, expensesPaise, outstandingPaise, notes` + day totals |
| N11 | `notification_channels` | Config per group (packing/accounts/sales): `whatsapp|sms|in_app` targets, templates |
| N12 | `notification_log` | Every outbound message: recipients, channel, template, payload, status, sentAt, error |
| N13 | `stationery_items` | Consumables stock: qty, unit, reorderLevel, avgCost |
| N14 | `stationery_indents` | Purchase requests: item, qty, purpose, requiredDate, status (draft→approved→committed / rejected), approvedBy/At+limit-check |
| N15 | `maintenance_log` | Facility complaints & reminders: location, issue, priority, team, dates, monthly/yearly cadence |
| N16 | `waste_log` | Scrap disposal: type (scrap/paper/rejected), qty, handler (default "Haritha Karma Sena", configurable), proof |
| N17 | `petty_cash_entries` | Entry, purpose, cost centre, requester, receipt no, amount ≤ approved limit, status, reconciliation; splitting detector runs on write |
| N18 | `vendor_deliveries_tracker` | PO-linked: promised date, pending documents, complaint link, overdue escalation state |
| N19 | `documents_master` | Approved doc list: `docNo, fileName (gst_sale|gst_purchase|other), revision, date, accessRoles[], retentionUpto, status` — status changes (obsolete/retired) require `office:documents:authorize`; never hard-deleted |
| N20 | `document_acknowledgements` | Per revision ack: user, docId, revision, at (SOP ADM-SOP-1 lives here) |
| N21 | `attendance_inputs` | Restricted: per user/day attendance inputs; reads gated to `office:employee:read` + admin |
| N22 | `deviations` | Deviation/escalation log: `kind (missed_deadline|unauthorized|discrepancy|incident|near_miss|suspected_fraud|data_breach), severity, category, immediateEscalation bool, owner, correctiveAction, closedAt` |
| N23 | `delegation_matrix` | §1.5 |
| N24 | `reminder_rules` | Config for BullMQ repeatables: `{ key, kind, cron/days, active, channel }` (opening checklist, route-day, outstanding follow-up, EOD closing, maintenance monthly/yearly, SOP annual review) |

---

## 3. Sales-order-desk workflow (existing order + step log)

Static step ladder (constants in `packages/domain/src/order-state/desk-flow.ts`,
pure, reused by the client to render the stepper):

```
checked → confirmed → packing_notified → accounts_notified → bill_prepared
       → bill_ready → printed (×2, printCount tracked) → extra_qty_recorded?
       → dispatch_docs_checked → delivery_confirmed → extra_qty_sold_check
       → collections_updated (EOD) → done
```

- Each step = document in `order_desk_steps` (append-only; who/when/note);
  skipping forward is blocked in domain (`nextDeskStep` guards), re-running a
  step appends a new line with an audit entry (no overwrite).
- Bill printing: `POST …/print-bill` increments `invoices.printCount`, appends
  to `prints[]`, and requires `orders:desk`.
- Extra quantity taken / sold: plain entries linked to the order.
- Notifications: on step entry, fan out to the groups configured in
  `notification_channels` (packing/accounts/sales) via the BullMQ
  `notification-fanout` queue; each send lands in `notification_log`.
- End-of-day summary: `GET /office/desk/summary?date=` → total sales quantity,
  bills, deliveries, extra qty, collections.

## 4. Outstanding payments (module 4 engine)

- Daily list = customers with `creditUsed > 0` (or small-outstanding ledger
  entries) joined with the latest `outstanding_followups` entry.
- Auto-flag: a customer becomes `overdue` when `promiseDate < today` or no
  follow-up within `SLO` (default: next working day); `deviations` entry is
  created automatically on first miss/delay with `kind=missed_deadline`.
- Small amounts: at order entry (when `deskNotes`/order screen is open) the API
  returns `pendingSmallOutstanding` for the customer; the clerk can apply it to
  the new order (`settleByOrder`), which increments the customer's
  `totalOrderValue` view and is cleared when the invoice for that order is paid
  (hook already exists in payments reconcile flow).
- Daily collections & expenses: entries per delivered sale in `daily_cash_close`.

## 5. Reminders & scheduled jobs (BullMQ)

New queue `office-reminders` (registry name `OfficeReminders`); repeatable jobs
are (re)configured from `reminder_rules` on worker boot:
opening-checklist (07:00), closing (20:00), route-day (06:00 on scheduled
weekdays), outstanding follow-up (09:30 daily), maintenance monthly/yearly,
SOP annual review. Reminders create in-app entries in `office_tasks` and honor
channel config; every dispatch is logged.

## 6. API surface (all under `/api/v1`, all zod-validated, all audited writes)

**Office core**
```
GET   /office/summary?date=                     office:read
GET/POST            /office/checklist/templates  office:read / office:write
GET                 /office/checklist/daily?kind&date
POST/PATCH          /office/checklist/daily      (one per kind+day; PATCH appends item answers)
CRUD /api/v1/office/tasks (list w/ filters inbox|urgent|mine, create, update status)
GET                 /office/visitors?date=
POST/PATCH          /office/visitors
GET/POST            /office/desk/:orderId/steps   (log + step)
POST                /office/desk/:orderId/print-bill
GET                 /office/desk/summary?date=
```

**CRM / follow-up**
```
GET/POST  /office/routes                (weekly schedule CRUD)
GET       /office/routes/today
GET/POST  /office/followups/call-logs?customerId
PATCH     /crm/customers/:id/desk-notes (crm:write, desk fields only)
GET       /office/customers/:id/notes-context   (shows on order screen)
```

**Outstanding**
```
GET   /office/outstanding?view=daily|overdue|small
POST  /office/outstanding/:customerId/followup
POST  /office/outstanding/:customerId/apply-to-order   (small-outstanding carry forward)
GET/POST /office/daily-cash?date=
```

**Dispatch / complaints / stock**
```
GET   /office/dispatch-board?date=          (due today / delayed / dispatched; read-only from delivery+orders)
GET/POST/PATCH /office/complaints           (product|service|other; guidance, resolution, closureDate)
GET   /office/stock-alerts                  (min-qty hits with ack state)
POST  /office/stock-alerts/:materialId/ack
```

**Registers** (uniform pattern; numbered per the brief §Modules-6)
```
GET/POST/PATCH /office/registers/courier        (+ route-to, POD fields)
GET/POST/PATCH /office/registers/visitors
GET/POST       /office/registers/stationery     + /move (in/out/reorder)
GET/POST/PATCH /office/registers/indents        (approval via delegation matrix)
GET/POST/PATCH /office/registers/maintenance    (monthly/yearly reminder cadence)
GET/POST       /office/registers/waste          (handler configurable)
GET/POST/PATCH /office/registers/petty-cash     (office:pettycash; splitting check on POST)
GET/POST/PATCH /office/registers/vendor-tracker
GET/POST/PATCH /office/registers/documents      (status changes need office:documents:authorize)
GET/POST       /office/registers/attendance     (office:employee:read/write)
```
`GET …/registers/*` accepts `format=csv|pdf` (pdf via pdfkit, csv via fast-csv) — export permission mirrors read.

**Controls**
```
GET/POST/PATCH /office/deviations       (immediate-escalation kinds auto-notify department head)
GET/POST       /office/reminders        (reminder_rules config)
GET/POST       /office/sop/acknowledge  (document_acknowledgements)
GET/POST/PUT   /office/matrix           (office:matrix:read/write)
GET/POST       /office/channels         (notification_channels config)
GET            /audit/…                 (audit:read already exists; UI page added)
```

## 7. Admin-web pages (mobile-first, reuse `useList`, `DataTable`, modals; topbar nav is already responsive)

`My Day`, `Order Desk`, `Follow-up & Routes`, `Outstanding`, `Dispatch`, `Registers` (tabbed), `Controls`, `Admin settings` (matrix/channels/checklist templates). Login page locale switch + `useI18n()` (en/ta/ml dictionaries in new `packages/i18n`; register forms carry ta/ml label columns; DB stores `labelEn/labelTa/labelMl`).

## 8. Seed data (extend `apps/api/src/scripts/seed.ts`)

- office_admin user `+919000000007` / `Password123!` (name: Office Admin Sasi)
- checklist templates (opening/closing from the SOP list), reminder rules
- routes: Tue Wandoor, Thu Vengara, Sat Perinthalmanna
- 3 customers with `deskNotes` incl. the 9x9x5 ↔ 10x10x5 example note
- register rows: courier in/out, visitor, stationery item below reorder, waste
  entry (Haritha Karma Sena), petty cash entry, deviation, documents master with
  ADM-SOP-1 rev 00, small-outstanding + overdue samples, delegation matrix defaults

## 9. Tests (`packages/domain/*.spec.ts` + `apps/api/tests/…`)

1. permissions: office_admin cannot edit QC/batch/dispatch/inventory records,
   cannot POST/PATCH/DELETE invoices or purchases, cannot hard-delete orders
   or documents; can desk-step orders (happy + step-skip rejection)
2. order desk workflow: full ladder, print-count increments, notification log rows
3. small-outstanding carry-forward flag + settle on next order
4. min-stock alert creation + acknowledgement cycle
5. petty-cash splitting detection (3× ₹9,900 within limits vs 1× ₹28,000 blocked)
6. delegation matrix limits (indent ₹25k boundary)
7. audit log written with before/after on office writes
8. checklist one-per-day uniqueness; no backdate by office_admin
9. overdue escalation deviation auto-creation

## 10. Milestones (gate after each: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`)

Status: **M0–M8 done** — gate fully green (84 domain + 3 i18n + 53 api tests).
Registers 1–9 live under `/office/registers/*` with CSV export; PDF export is
deferred (no pdfkit dep yet). Controls (reminders/BullMQ, matrix, channels,
deviations) are live; admin-web ships office pages (My Day, desk, routes,
outstanding, dispatch, registers, controls) behind `office:read` nav gating.

| # | Milestone | Contents |
|---|---|---|
| **M0** | RBAC + audit foundation | Role/permissions, delegation collection+domain checker, audit wiring on existing guarded writes, i18n package skeleton, users locale |
| **M1** | My Day | checklist templates + submissions, tasks/inbox, visitors/meetings, summary endpoint |
| **M2** | Sales order desk | desk-flow domain, step log + endpoints, bill print count, notification channels/log + fanout, EOD summary |
| **M3** | Follow-ups & routes | route schedules + today view, call logs, customer deskNotes + order-screen context |
| **M4** | Outstanding | daily list/escalation, follow-up log, small-outstanding ledger + apply-to-order, daily cash close |
| **M5** | Dispatch & alerts | dispatch board, complaints, min-stock alerts + ack |
| **M6** | Registers 1–9 | all register collections + endpoints + CSV/PDF export |
| **M7** | Controls | deviations, BullMQ reminder scheduler + rules, SOP/documents authorizations |
| **M8** | Seed + docs + UI polish | seed data, admin-web pages for all modules, tests green, update CLAUDE.md/README/permissions matrix |

Docs updated at the end: `CLAUDE.md` (new module + commands), `README.md`, and a permissions matrix table.
