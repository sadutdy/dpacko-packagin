import { Types } from 'mongoose';

import { DESK_STEPS, DeskStep, STEP_AUDIENCE, deskProgress, nextDeskStep } from '@ameen/domain';

import { AppError } from '../../core/errors/AppError.js';
import { buildPageMeta, parsePagination } from '../../core/http/pagination.js';
import { userRepository } from '../auth/auth.repository.js';
import { crmRepository } from '../crm/crm.repository.js';
import type { CustomerDoc } from '../crm/crm.repository.js';
import { nextCounter } from '../counters/counter.model.js';
import { ordersRepository, type OrderDoc } from '../orders/orders.repository.js';
import { paymentsService } from '../payments/payments.service.js';
import { notificationsService } from '../notifications/notification.service.js';
import type {
  DailyCashDoc,
  DeskEventEntry,
  OfficeTaskDoc,
  OutstandingFollowupDoc,
  SmallOutstandingDoc,
} from './office.repository.js';
import {
  officeRepository,
  type ChecklistItemDoc,
} from './office.repository.js';

/** The shop's local timezone for "business days" (date strings). */
export const SHOP_TZ_OFFSET_MIN = 5 * 60 + 30; // Asia/Kolkata = UTC+5:30

function toIsoBusinessDay(date: Date, offsetMinutes = SHOP_TZ_OFFSET_MIN): string {
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  return shifted.toISOString().slice(0, 10);
}

export function isoBusinessDay(date = new Date()): string {
  return toIsoBusinessDay(date);
}

const ISO_PERIOD_FULL = '25-26';

function toObject(doc: { toObject(options?: Record<string, unknown>): Record<string, unknown> }): Record<string, unknown> {
  return doc.toObject({ versionKey: false });
}

/** Converts stored desk events into the pure domain shape (ISO timestamps). */
function deskEventViews(events: readonly DeskEventEntry[]): { step: string; by: string; at?: string; note?: string }[] {
  return events.map((event) => ({
    step: event.step,
    by: String(event.by),
    at: event.at ? event.at.toISOString() : undefined,
    note: event.note,
  }));
}

/**
 * "My Day" service rules:
 * - Checklist submissions exist once per kind+day (auto-created on first save).
 * - Submissions are answered today: office_admin cannot answer for a past date;
 *   only Admin may backdate (a business-day guard).
 * - Tasks and appointments have no hard delete — status flows only.
 */

function isTodayOrFuture(date: string, actorRole: string): void {
  if (date > isoBusinessDay()) {
    throw AppError.validation('Checklist date is in the future');
  }
  if (date < isoBusinessDay() && actorRole !== 'admin') {
    throw AppError.forbidden('Only an admin may record checklist answers for a past date');
  }
}

export const officeService = {
  /* ------------------------- checklist templates ------------------------- */

  async listChecklistTemplates(kind: string, includeInactive = false) {
    const templates = await officeRepository.listChecklistTemplates(
      includeInactive ? { kind } : { kind, active: true },
    );
    return templates.map(toObject);
  },

  async createChecklistTemplate(input: Record<string, unknown>) {
    const item = await officeRepository.createChecklistTemplate(input);
    return toObject(item);
  },

  async updateChecklistTemplate(id: string, patch: Record<string, unknown>) {
    const item = await officeRepository.updateChecklistTemplate(id, patch);
    if (!item) throw AppError.notFound('Checklist template not found');
    return toObject(item);
  },

  /* --------------------------- daily checklist --------------------------- */

  /** Today's checklist state: template items joined with any existing answers. */
  async checklistState(kind: string, date?: string, actorId = '') {
    const day = date ?? isoBusinessDay();
    const templates = await officeRepository.listChecklistTemplates({ kind, active: true });
    const submission = await officeRepository.findSubmission(kind, day);
    const answered = new Map(
      (submission?.items ?? []).map((entry) => [String(entry.itemId), { done: entry.done, note: entry.note, at: entry.at }]),
    );
    return {
      kind,
      date: day,
      items: templates.map((template: ChecklistItemDoc) => ({
        _id: String(template._id),
        labelEn: template.labelEn,
        labelTa: template.labelTa,
        labelMl: template.labelMl,
        mandatory: template.mandatory,
        position: template.position,
        answer: answered.get(String(template._id)) ?? null,
      })),
      submittedAt: submission?.submittedAt ?? null,
      updatedAt: submission?.updatedAt ?? null,
      submittedBy: submission ? String(submission.submittedBy) : null,
      mine: Boolean(submission && String(submission.submittedBy) === actorId),
    };
  },

  /** Saves (creates or merges) answers for a kind+day. Enforces no-backdating. */
  async saveChecklist(
    input: { kind: string; date: string; items: { itemId: string; done: boolean; note?: string }[] },
    actorRole: string,
    actorId: string,
  ) {
    isTodayOrFuture(input.date, actorRole);
    const templateIds = new Set(
      (
        await officeRepository.listChecklistTemplates({ kind: input.kind, active: true })
      ).map((template) => String(template._id)),
    );
    for (const item of input.items) {
      if (!templateIds.has(item.itemId)) {
        throw AppError.validation('Unknown checklist item for this day');
      }
    }

    const now = new Date();
    const existing = await officeRepository.findSubmission(input.kind, input.date);
    if (existing) {
      const merged = new Map(
        existing.items.map((entry) => [String(entry.itemId),
          { itemId: entry.itemId, done: entry.done, note: entry.note, at: entry.at }]),
      );
      for (const entry of input.items) {
        merged.set(entry.itemId, {
          itemId: new Types.ObjectId(entry.itemId),
          done: entry.done,
          note: entry.note ?? merged.get(entry.itemId)?.note ?? '',
          at: now,
        });
      }
      await officeRepository.mergeSubmission(existing, {
        items: input.items.map((entry) => ({
          itemId: new Types.ObjectId(entry.itemId),
          done: entry.done,
          note: entry.note ?? merged.get(String(entry.itemId))?.note ?? '',
          at: now,
        })),
        submittedBy: new Types.ObjectId(actorId),
        submittedAt: now,
      });
      return toObject(existing);
    }

    const created = await officeRepository.createSubmission({
      kind: input.kind,
      date: input.date,
      items: input.items.map((entry) => ({
        itemId: new Types.ObjectId(entry.itemId),
        done: entry.done,
        note: entry.note ?? '',
        at: now,
      })),
      submittedBy: new Types.ObjectId(actorId),
      submittedAt: now,
      updatedAt: now,
    });
    return toObject(created);
  },

  /* ------------------------------- tasks ------------------------------- */

  async listTasks(query: Record<string, unknown>, actorId: string) {
    const params = parsePagination(query);
    const parsedQuery = query as { view?: string; status?: string; priority?: string; kind?: string; date?: string };
    const filter: Record<string, unknown> = {};
    if (parsedQuery.status) filter.status = parsedQuery.status;
    else if (!parsedQuery.view) filter.status = { $in: ['open', 'in_progress'] };
    if (parsedQuery.priority) filter.priority = parsedQuery.priority;
    if (parsedQuery.kind) filter.kind = parsedQuery.kind;

    switch (parsedQuery.view) {
      case 'mine':
        filter.owner = new Types.ObjectId(actorId);
        break;
      case 'inbox':
        filter.owner = null;
        break;
      case 'urgent':
        filter.priority = 'urgent';
        break;
      case 'open':
        filter.status = { $in: ['open', 'in_progress'] };
        break;
      default:
        break;
    }
    if (parsedQuery.view === 'inbox') filter.kind = { $in: ['inbox', 'reminder'] };

    const view = filter;
    const [tasks, total] = await Promise.all([
      officeRepository.listTasks(view, params.skip, params.limit, params.sort),
      officeRepository.countTasks(view),
    ]);
    return {
      tasks: tasks.map(toObject),
      meta: buildPageMeta(total, params),
    };
  },

  async createTask(input: Record<string, unknown>, actorId: string) {
    const payload = {
      ...input,
      owner: (input.owner as string) ? new Types.ObjectId(input.owner as string) : null,
      ownerRole: input.ownerRole ?? '',
      dueDate: (input.dueDate as Date) ?? null,
      assignedBy: new Types.ObjectId(actorId),
      doneAt: null,
    };
    const task = await officeRepository.createTask(payload);
    return toObject(task);
  },

  /**
   * Status flow: open → in_progress → done | cancelled, done back to open.
   * `doneAt` is stamped by the server on first completion and preserved after.
   */
  async updateTask(id: string, patch: Record<string, unknown>) {
    const task = await officeRepository.findTaskById(id);
    if (!task) throw AppError.notFound('Task not found');
    assertTaskTransition(task, patch);
    const clean: Record<string, unknown> = { ...patch };
    if (patch.status === 'done' && task.status !== 'done') {
      clean.doneAt = new Date();
    }
    if ((patch.owner as string) !== undefined) {
      clean.owner = (patch.owner as string) ? new Types.ObjectId(patch.owner as string) : null;
    }
    const updated = await officeRepository.updateTask(id, clean);
    if (!updated) throw AppError.notFound('Task not found');
    return toObject(updated);
  },

  /* --------------------------- appointments --------------------------- */

  async listAppointments(query: Record<string, unknown>) {
    const params = parsePagination(query);
    const parsedQuery = query as { kind?: string; date?: string; view?: string };
    const filter: Record<string, unknown> = {};
    if (parsedQuery.kind) filter.kind = parsedQuery.kind;
    if (parsedQuery.view === 'today') filter.date = isoBusinessDay();
    else if (parsedQuery.date) filter.date = parsedQuery.date;
    else if (!parsedQuery.view) filter.date = isoBusinessDay();
    if (parsedQuery.view === 'upcoming') {
      filter.date = { $gte: isoBusinessDay() };
    }

    const [appointments, total] = await Promise.all([
      officeRepository.listAppointments(filter, params.skip, params.limit, params.sort),
      officeRepository.countAppointments(filter),
    ]);
    return {
      appointments: appointments.map(toObject),
      meta: buildPageMeta(total, params),
    };
  },

  async createAppointment(input: Record<string, unknown>, actorId: string) {
    const date: string = input.date as string;
    isTodayOrFuture(date, 'admin');
    const payload: Record<string, unknown> = { ...input, createdBy: new Types.ObjectId(actorId) };
    if (input.checkIn === true) payload.timeIn = new Date();
    payload.date = date;
    delete (payload as Record<string, unknown>).checkIn;
    const appointment = await officeRepository.createAppointment(payload);
    return toObject(appointment);
  },

  async updateAppointment(id: string, patch: Record<string, unknown>) {
    const appointment = await officeRepository.findAppointmentById(id);
    if (!appointment) throw AppError.notFound('Appointment not found');
    if (appointment.timeOut && patch.timeOut) {
      throw AppError.conflict('Visit already closed — create a correction note instead');
    }
    if (patch.timeOut && !appointment.timeIn && !patch.timeIn) {
      throw AppError.conflict('Cannot check out before check-in');
    }
    const updated = await officeRepository.updateAppointment(id, patch);
    if (!updated) throw AppError.notFound('Appointment not found');
    return toObject(updated);
  },

  /* ------------------------------ summary ------------------------------ */

  async summary(actorId: string, dateParam?: string) {
    const day = dateParam ?? isoBusinessDay();
    const opening = await this.checklistState('opening', day, actorId);
    const closing = await this.checklistState('closing', day, actorId);

    const startOfDay = new Date(`${day}T00:00:00.000+05:30`);
    const endOfDay = new Date(`${day}T23:59:59.999+05:30`);

    const [dueToday, urgent, openInbox] = await Promise.all([
      officeRepository.countTasks({
        status: { $in: ['open', 'in_progress'] },
        dueDate: { $gte: startOfDay, $lte: endOfDay },
      }),
      officeRepository.countTasks({
        status: { $in: ['open', 'in_progress'] },
        priority: 'urgent',
      }),
      officeRepository.countTasks({
        status: { $in: ['open', 'in_progress'] },
        owner: null,
        kind: { $in: ['inbox', 'reminder'] },
      }),
    ]);
    const visitors = await officeRepository.listAppointmentsByDate(day);
    const mineOpen = await officeRepository.countTasks({
      status: { $in: ['open', 'in_progress'] },
      owner: new Types.ObjectId(actorId),
    });

    return {
      date: day,
      checklist: { opening, closing },
      tasks: { dueToday, urgent, openInbox, mineOpen },
      visitors: {
        total: visitors.length,
        open: visitors.filter((v) => !v.timeOut).length,
        rows: visitors.map(toObject),
      },
    };
  },

  /* ------------------------- sales order desk (M2) ------------------------- */

  /** Today's desk board: orders the office is shepherding, with ladder state. */
  async listDeskOrders(query: { date?: string; pending?: boolean; page?: number; limit?: number }) {
    const day = query.date ?? isoBusinessDay();
    const startOfDay = new Date(`${day}T00:00:00.000+05:30`);
    const endOfDay = new Date(`${day}T23:59:59.999+05:30`);
    const statuses = ['placed', 'payment_pending', 'in_production', 'ready', 'dispatched', 'delivered'];
    const params = parsePagination({ page: query.page, limit: query.limit });
    const filter: Record<string, unknown> = {
      status: { $in: statuses },
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    };
    const [orders, total] = await Promise.all([
      ordersRepository.listOrders(filter, params.skip, params.limit),
      ordersRepository.countOrders(filter),
    ]);
    let rows = await Promise.all(
      orders.map(async (order) => this.describeDeskOrder(order)),
    );
    if (query.pending === true) {
      rows = rows.filter((row) => !row.progress.every((entry) => entry.done));
    }
    return {
      rows,
      meta: buildPageMeta(total, params),
      date: day,
    };
  },

  async getDeskOrder(orderId: string) {
    const order = await ordersRepository.findOrderById(orderId);
    if (!order) throw AppError.notFound('Order not found');
    const detail = await this.describeDeskOrder(order);
    const log = await notificationsService.listLog({ orderId: new Types.ObjectId(orderId) }, 50);
    return { ...detail, notifications: log };
  },

  /** Shared ladder rendering for one order doc. */
  async describeDeskOrder(order: OrderDoc) {
    const desk = await officeRepository.findDeskDoc(String(order._id));
    const events = (desk?.events ?? []).map((event) => ({
      step: event.step,
      by: String(event.by),
      at: event.at ? event.at.toISOString() : undefined,
      note: event.note,
    }));
    const progress = deskProgress(events);
    const next = nextDeskStep(events);
    const invoice = order.invoiceId ? String(order.invoiceId) : null;
    return {
      order: toObject(order),
      progress,
      nextStep: next,
      done: next === null,
      bill: invoice ? await paymentsService.getBillStatus(invoice) : null,
    };
  },

  /**
   * Records the next desk step. office_admin progresses strictly one rung at a
   * time; admins may skip ahead (missing rungs are backfilled, except
   * `printed`, which can only come from a real bill print). `printed` itself is
   * never recorded by hand.
   */
  async saveDeskStep(orderId: string, input: { step: string; note?: string }, actorId: string, actorRole: string) {
    const order = await ordersRepository.findOrderById(orderId);
    if (!order) throw AppError.notFound('Order not found');
    if (input.step === DeskStep.Printed) {
      throw AppError.conflict('The printed step is recorded automatically when the bill is printed');
    }
    const desk = await officeRepository.findDeskDoc(orderId);
    const events = deskEventViews(desk?.events ?? []);
    const next = nextDeskStep(events);
    const targetIdx = DESK_STEPS.indexOf(input.step as DeskStep);
    if (input.step !== next && actorRole !== 'admin') {
      throw AppError.conflict(`Expected next desk step ${next ?? '(none)'} but got ${input.step}`);
    }
    if (actorRole === 'admin' && targetIdx >= 0) {
      // Backfill the skipped rungs so the ladder stays coherent (printed frozen).
      for (let idx = 0; idx < targetIdx; idx += 1) {
        const rung: DeskStep | undefined = DESK_STEPS[idx];
        if (!rung || rung === DeskStep.Printed) continue;
        if (!events.some((event) => event.step === rung)) {
          await officeRepository.appendDeskEvent(new Types.ObjectId(orderId), {
            step: rung,
            by: new Types.ObjectId(actorId),
            note: `backfilled by admin skip to ${String(input.step)}`,
          });
        }
      }
    }
    const saved = await officeRepository.appendDeskEvent(new Types.ObjectId(orderId), {
      step: input.step,
      by: new Types.ObjectId(actorId),
      note: input.note,
    });
    await this.notifyDeskStep(orderId, input.step, order, actorId);
    return toObject(saved);
  },

  /** Prints the bill (cut if needed) and records the `printed` desk step. */
  /** Prints the bill (cut if needed) and records the `printed` desk step. */
  async printBill(orderId: string, input: { copies: number; note?: string }, actorId: string) {
    const order = await ordersRepository.findOrderById(orderId);
    if (!order) throw AppError.notFound('Order not found');
    const invoice = await paymentsService.printInvoiceForOrder(orderId, actorId, input.copies);
    const prior = await officeRepository.findDeskDoc(orderId);
    const alreadyPrinted = (prior?.events ?? []).some((event) => event.step === DeskStep.Printed);
    if (!alreadyPrinted) {
      await officeRepository.appendDeskEvent(new Types.ObjectId(orderId), {
        step: DeskStep.Printed,
        by: new Types.ObjectId(actorId),
        note: input.note,
      });
    }
    return invoice;
  },

  /** End-of-day desk summary for one business date. */
  async deskSummary(dateParam?: string) {
    const day = dateParam ?? isoBusinessDay();
    const startOfDay = new Date(`${day}T00:00:00.000+05:30`);
    const endOfDay = new Date(`${day}T23:59:59.999+05:30`);
    const desks = await officeRepository.listDeskDocs();
    const orderIds = desks
      .filter((desk) => (desk.events.at(-1)?.at ?? new Date(0)) >= startOfDay)
      .map((desk) => String(desk.orderId));
    let salesQuantityPcs = 0;
    const customersServiced = new Set<string>();
    let billsPrinted = 0;
    const rows = [];
    for (const orderId of orderIds) {
      const order = await ordersRepository.findOrderById(String(orderId));
      if (!order) continue;
      customersServiced.add(String(order.customerId));
      salesQuantityPcs += (order.items ?? []).reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);
      if (order.invoiceId) {
        const bill = await paymentsService.getBillStatus(String(order.invoiceId));
        if (bill && bill.printCount > 0) billsPrinted += 1;
      }
      const desk = desks.find((d) => String(d.orderId) === orderId);
      rows.push({
        order: toObject(order),
        progress: deskProgress(deskEventViews(desk?.events ?? [])),
        done: nextDeskStep(deskEventViews(desk?.events ?? [])) === null,
      });
    }
    void endOfDay;
    return {
      date: day,
      ordersTouched: orderIds.length,
      customersServiced: customersServiced.size,
      salesQuantityPcs,
      billsPrinted,
      rows,
    };
  },

  /** Fan-out a desk step notification into the message log per audience group. */
  async notifyDeskStep(orderId: string, step: string, order: OrderDoc, actorId: string) {
    const groups = STEP_AUDIENCE[step as DeskStep] ?? [];
    const actorName = await actorDisplayName(actorId);
    await notificationsService.fanOut({
      event: step,
      groups,
      body: `Order ${order.orderNumber} — desk step '${step}' recorded by ${actorName}`,
      orderId,
      actorId,
      actorName,
    });
  },

  /* ---------------------- follow-ups & routes (M3) ---------------------- */

  async listRoutes(query: { kind?: string; includeInactive?: boolean }) {
    const filter: Record<string, unknown> = {};
    if (query.kind) filter.kind = query.kind;
    if (!query.includeInactive) filter.active = true;
    const routes = await officeRepository.listRoutes(filter);
    return routes.map(toObject);
  },

  async createRoute(input: { weekday: number; area: string; kind: string; customers: string[]; active: boolean }, actorId: string) {
    void actorId;
    const existing = await officeRepository.listRoutes({ weekday: input.weekday }, 'weekday');
    const duplicate = existing.some((route) => route.area.toLowerCase() === input.area.toLowerCase());
    if (duplicate) {
      throw AppError.conflict(`A route for ${input.area} already exists on weekday ${String(input.weekday)}`);
    }
    const route = await officeRepository.createRoute(input);
    return toObject(route);
  },

  async updateRoute(id: string, patch: Record<string, unknown>) {
    const route = await officeRepository.updateRoute(id, patch);
    if (!route) throw AppError.notFound('Route schedule not found');
    return toObject(route);
  },

  /** Today's active routes (shop-timezone weekday) with customer desk cards. */
  async routesToday() {
    const day = isoBusinessDay();
    const weekday = new Date(`${day}T00:00:00.000Z`).getUTCDay();
    const routes = await officeRepository.listRoutes({ weekday, active: true });
    const rows = [];
    for (const route of routes) {
      const customers = [];
      for (const customerId of route.customers) {
        const customer = await crmRepository.findById(String(customerId));
        if (!customer) continue;
        customers.push({
          customerId: String(customer._id),
          customerCode: customer.customerCode,
          businessName: customer.businessName,
          phone: customer.phone,
          segment: customer.segment,
          paymentTermsDays: customer.paymentTermsDays,
          isBlacklisted: customer.isBlacklisted,
          deskNotes: customer.deskNotes ?? {},
        });
      }
      rows.push({ id: String(route._id), area: route.area, kind: route.kind, customers });
    }
    return { date: day, weekday, routes: rows };
  },

  async createCallLog(input: { customerId: string; date?: string; channel: string; outcome: string; nextAction?: string; nextActionDate?: string }, actorId: string) {
    const customer = await crmRepository.findById(input.customerId);
    if (!customer) throw AppError.notFound('Customer not found');
    const log = await officeRepository.createCallLog({
      customerId: new Types.ObjectId(input.customerId),
      date: input.date ?? isoBusinessDay(),
      channel: input.channel,
      outcome: input.outcome,
      nextAction: input.nextAction ?? '',
      nextActionDate: input.nextActionDate ?? '',
      by: new Types.ObjectId(actorId),
    });
    return toObject(log);
  },

  async listCallLogs(query: { customerId?: string; date?: string; page: number; limit: number }) {
    const params = parsePagination({ page: query.page, limit: query.limit });
    const filter: Record<string, unknown> = {};
    if (query.customerId) filter.customerId = new Types.ObjectId(query.customerId);
    if (query.date) filter.date = query.date;
    const [logs, total] = await Promise.all([
      officeRepository.listCallLogs(filter, params.skip, params.limit),
      officeRepository.countCallLogs(filter),
    ]);
    return { callLogs: logs.map(toObject), meta: buildPageMeta(total, params) };
  },

  /** OFF-3: desk notes + follow-up context for the order-entry screen. */
  async customerScreenContext(customerId: string) {
    const customer = await crmRepository.findById(customerId);
    if (!customer) throw AppError.notFound('Customer not found');
    const logs = await officeRepository.listCallLogs({ customerId: new Types.ObjectId(customerId) }, 0, 5);
    const smalls = await officeRepository.listSmallEntries({
      customerId: new Types.ObjectId(customerId),
      settled: false,
    });
    return {
      customerId,
      businessName: customer.businessName,
      paymentTermsDays: customer.paymentTermsDays,
      isBlacklisted: customer.isBlacklisted,
      creditUsedPaise: customer.creditUsed ?? 0,
      pendingSmallOutstandingPaise: smalls.reduce((sum: number, row: SmallOutstandingDoc) => sum + row.amountPaise, 0),
      pendingSmallEntries: smalls.map(toObject),
      deskNotes: customer.deskNotes ?? {},
      callLogs: logs.map(toObject),
    };
  },

  /* ------------------------ outstanding (M4) ------------------------ */

  /**
   * Daily list = customers on credit with their latest follow-up attached.
   * `overdue` view filters to promise-date misses (SLO: follow up at least
   * every other business day) and auto-raises a `missed_deadline` deviation on
   * first detection.
   */
  async listOutstanding(view: string) {
    const customers = await crmRepository.list({ creditUsed: { $gt: 0 } }, 0, 500);
    const latest = await officeRepository.listRecentFollowups(
      customers.map((row: CustomerDoc) => row._id),
      1,
    );
    const latestByCustomer = new Map(latest.map((row: OutstandingFollowupDoc) => [String(row.customerId), row]));
    const day = isoBusinessDay();
    const yesterday = isoBusinessDay(new Date(Date.now() - 86_400_000));
    const rows = customers.map((customer: CustomerDoc) => {
      const followup = latestByCustomer.get(String(customer._id));
      const promised = followup?.promiseDate ?? '';
      const checkedRecently = followup ? followup.date >= yesterday : false;
      // Missed promise trumps recency: a stale promise is a breach even if the
      // office called yesterday; no contact within the one-working-day SLO is
      // also a breach.
      const promiseMissed = promised !== '' && promised < day;
      const overdue = !followup || promiseMissed || (promised === '' && !checkedRecently);
      return {
        customerId: String(customer._id),
        businessName: customer.businessName,
        phone: customer.phone,
        creditUsedPaise: customer.creditUsed ?? 0,
        paymentTermsDays: customer.paymentTermsDays,
        lastFollowup: followup
          ? { date: followup.date, promiseDate: followup.promiseDate, outcome: followup.outcome, amountPaise: followup.amountPaise }
          : null,
        overdue,
      };
    });
    if (view === 'overdue') {
      const overdueRows = rows.filter((row: { overdue: boolean }) => row.overdue);
      for (const row of overdueRows) {
        const openMisses = await officeRepository.countOpenDeviations(
          new Types.ObjectId(row.customerId),
          'missed_deadline',
        );
        if (openMisses === 0) {
          await officeRepository.createDeviation({
            kind: 'missed_deadline',
            severity: 'medium',
            category: 'outstanding',
            immediateEscalation: false,
            customerId: new Types.ObjectId(row.customerId),
            detail: `Credit of ₹${(row.creditUsedPaise / 100).toLocaleString('en-IN')} overdue as of ${day}`,
            openedBy: null,
          });
        }
      }
      return { view, date: day, rows: overdueRows };
    }
    if (view === 'small') {
      const unsettled = await officeRepository.listSmallEntries({ settled: false });
      const byCustomer = new Map<string, { customerId: string; entries: SmallOutstandingDoc[] }>();
      for (const entry of unsettled) {
        const key = String(entry.customerId);
        const bucket = byCustomer.get(key) ?? { customerId: key, entries: [] };
        bucket.entries.push(entry);
        byCustomer.set(key, bucket);
      }
      const smallRows = [];
      for (const bucket of byCustomer.values()) {
        const customer = await crmRepository.findById(bucket.customerId);
        smallRows.push({
          customerId: bucket.customerId,
          businessName: customer?.businessName ?? bucket.customerId,
          totalPaise: bucket.entries.reduce((sum: number, row: SmallOutstandingDoc) => sum + row.amountPaise, 0),
          entries: bucket.entries.map(toObject),
        });
      }
      return { view, date: day, rows: smallRows };
    }
    return { view, date: day, rows };
  },

  /** Records a follow-up: snapshots today's `creditUsed`, sets the promise. */
  async addFollowup(customerId: string, input: { promiseDate: string; outcome: string }, actorId: string) {
    const customer = await crmRepository.findById(customerId);
    if (!customer) throw AppError.notFound('Customer not found');
    if (!customer.creditUsed) {
      throw AppError.conflict('Customer has nothing outstanding on credit');
    }
    const entry = await officeRepository.createFollowup({
      customerId: new Types.ObjectId(customerId),
      date: isoBusinessDay(),
      amountPaise: customer.creditUsed ?? 0,
      promiseDate: input.promiseDate,
      outcome: input.outcome,
      by: new Types.ObjectId(actorId),
    });
    return toObject(entry);
  },

  /** OFF-4: clerk records a small cash gap for carry-forward collection. */
  async createSmallEntry(input: { customerId: string; amountPaise: number; reason?: string }, actorId: string) {
    const customer = await crmRepository.findById(input.customerId);
    if (!customer) throw AppError.notFound('Customer not found');
    const entry = await officeRepository.createSmallEntry({
      customerId: new Types.ObjectId(input.customerId),
      amountPaise: input.amountPaise,
      reason: input.reason ?? '',
      createdOn: isoBusinessDay(),
      createdBy: new Types.ObjectId(actorId),
    });
    return toObject(entry);
  },

  /** Applies every unsettled small amount of the customer onto an order. */
  async applySmallToOrder(customerId: string, orderId: string, actorId: string) {
    void actorId;
    const order = await ordersRepository.findOrderById(orderId);
    if (!order) throw AppError.notFound('Order not found');
    if (String(order.customerId) !== customerId) {
      throw AppError.conflict('Order belongs to a different customer');
    }
    if (['closed', 'cancelled'].includes(order.status)) {
      throw AppError.conflict('Small outstanding cannot be applied to a closed or cancelled order');
    }
    const unsettled = await officeRepository.listSmallEntries({
      customerId: new Types.ObjectId(customerId),
      settled: false,
    });
    if (unsettled.length === 0) {
      throw AppError.conflict('No unsettled small outstanding for this customer');
    }
    const settled = [];
    for (const entry of unsettled) {
      const updated = await officeRepository.settleSmallEntry(String(entry._id), new Types.ObjectId(orderId));
      if (updated) settled.push(toObject(updated));
    }
    return {
      orderId,
      appliedCount: settled.length,
      appliedPaise: settled.reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.amountPaise ?? 0), 0),
      entries: settled,
    };
  },

  /** N10: cash/expenses ledger with day totals. */
  async dailyCash(input: { date?: string }) {
    const day = input.date ?? isoBusinessDay();
    const rows = await officeRepository.listDailyCash({ date: day });
    return {
      date: day,
      rows: rows.map(toObject),
      totals: {
        collectedPaise: rows.reduce((sum: number, row: DailyCashDoc) => sum + row.collectedPaise, 0),
        expensesPaise: rows.reduce((sum: number, row: DailyCashDoc) => sum + row.expensesPaise, 0),
        outstandingPaise: rows.reduce((sum: number, row: DailyCashDoc) => sum + row.outstandingPaise, 0),
      },
    };
  },

  async createDailyCash(
    input: { date?: string; invoiceId?: string; orderId?: string; customerId?: string; collectedPaise: number; expensesPaise: number; outstandingPaise: number; notes?: string },
    actorId: string,
  ) {
    const entry = await officeRepository.createDailyCash({
      date: input.date ?? isoBusinessDay(),
      invoiceId: input.invoiceId ? new Types.ObjectId(input.invoiceId) : null,
      orderId: input.orderId ? new Types.ObjectId(input.orderId) : null,
      customerId: input.customerId ? new Types.ObjectId(input.customerId) : null,
      collectedPaise: input.collectedPaise,
      expensesPaise: input.expensesPaise,
      outstandingPaise: input.outstandingPaise,
      notes: input.notes ?? '',
      by: new Types.ObjectId(actorId),
    });
    return toObject(entry);
  },

  /* ---------------- dispatch, complaints & alerts (M5) ---------------- */

  /** OFF-5 dispatch desk: due today / delayed / dispatched for a business date. */
  async dispatchBoard(dateParam?: string) {
    const day = dateParam ?? isoBusinessDay();
    const startOfDay = new Date(`${day}T00:00:00.000+05:30`);
    const endOfDay = new Date(`${day}T23:59:59.999+05:30`);
    const statuses = ['placed', 'payment_pending', 'in_production', 'ready', 'dispatched'];

    const [dueRows, delayedRows, dispatchedToday] = await Promise.all([
      ordersRepository.listOrders(
        { status: { $in: [...statuses] }, requestedDeliveryDate: { $gte: startOfDay, $lte: endOfDay } },
        0,
        500,
      ),
      ordersRepository.listOrders(
        { status: { $in: [...statuses] }, requestedDeliveryDate: { $lt: startOfDay } },
        0,
        500,
      ),
      officeRepository.listDeliveriesOnDate(startOfDay, endOfDay),
    ]);

    const allOrderIds = [
      ...dueRows.map((row: OrderDoc) => row._id),
      ...delayedRows.map((row: OrderDoc) => row._id),
      ...dispatchedToday.map((row: Record<string, unknown>) => new Types.ObjectId(String(row.orderId))),
    ];
    const deliveries = await officeRepository.listDeliveriesForOrders([...allOrderIds]);
    const byOrder = new Map(deliveries.map((row) => [String(row.orderId), row]));
    const decorate = (order: OrderDoc) => ({
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      customerId: String(order.customerId),
      status: order.status,
      requestedDeliveryDate: order.requestedDeliveryDate ?? null,
      delivery: byOrder.get(String(order._id)) ?? null,
    });
    const decorateEvent = (row: Record<string, unknown>) => ({
      orderId: String(row.orderId ?? ''),
      status: row.status,
      deliveredAt: row.deliveredAt ?? null,
      plannedAt: row.plannedAt ?? null,
    });
    return {
      date: day,
      dueToday: dueRows.map(decorate),
      delayed: delayedRows.map(decorate),
      dispatched: dispatchedToday.map(decorateEvent),
    };
  },

  /** OFF-5 complaint register with ticket numbers and closure rules. */
  async createComplaint(input: { customerId: string; orderId?: string; kind: string; title?: string; detail: string; guidance?: string }, actorId: string) {
    const customer = await crmRepository.findById(input.customerId);
    if (!customer) throw AppError.notFound('Customer not found');
    const ticketNo = `CMP-${String(await nextCounter('complaint', ISO_PERIOD_FULL)).padStart(5, '0')}`;
    const complaint = await officeRepository.createComplaint({
      ticketNo,
      customerId: new Types.ObjectId(input.customerId),
      orderId: input.orderId ? new Types.ObjectId(input.orderId) : null,
      kind: input.kind,
      title: input.title ?? '',
      detail: input.detail,
      guidance: input.guidance ?? '',
      openedBy: new Types.ObjectId(actorId),
    });
    return toObject(complaint);
  },

  async updateComplaint(id: string, patch: { status?: string; title?: string; kind?: string; guidance?: string; resolution?: string; closureDate?: string; }, actorId: string) {
    const complaint = await officeRepository.findComplaintById(id);
    if (!complaint) throw AppError.notFound('Complaint not found');
    if (patch.status !== undefined && patch.status !== complaint.status && complaint.status === 'closed') {
      throw AppError.conflict('Closed complaints are immutable — open a new complaint instead');
    }
    const update: Record<string, unknown> = { ...patch };
    if (patch.status === 'resolved' || patch.status === 'closed') {
      update.closedBy = new Types.ObjectId(actorId);
      update.closureDate = patch.closureDate ?? isoBusinessDay();
      update.closedAt = new Date();
    }
    const updated = (await officeRepository.updateComplaint(id, update)) as { toObject(o?: Record<string, unknown>): Record<string, unknown> } | null;
    if (!updated) throw AppError.notFound('Complaint not found');
    return toObject(updated);
  },

  async listComplaints(query: { customerId?: string; status?: string; page: number; limit: number }) {
    const params = parsePagination({ page: query.page, limit: query.limit });
    const filter: Record<string, unknown> = {};
    if (query.customerId) filter.customerId = new Types.ObjectId(query.customerId);
    if (query.status) filter.status = query.status;
    const [rows, total] = await Promise.all([
      officeRepository.listComplaints(filter, params.skip, params.limit),
      officeRepository.countComplaints(filter),
    ]);
    return { rows: rows.map(toObject), meta: buildPageMeta(total, params) };
  },

  /** OFF-5 stock alerts with acknowledgement state. */
  async listStockAlerts() {
    return officeRepository.listLowStockMaterials();
  },

  /** Records the office ack for a low-stock alert. */
  async ackStockAlert(materialId: string, note: string | undefined, actorId: string) {
    const acked = (await officeRepository.ackLowStock(
      materialId,
      new Types.ObjectId(actorId),
      note ?? '',
    )) as { toObject(o?: Record<string, unknown>): Record<string, unknown> } | null;
    if (!acked) throw AppError.notFound('Material not found');
    return toObject(acked);
  },
};

/** Resolves a friendly name for notification bodies. */
async function actorDisplayName(actorId: string): Promise<string> {
  const user = await userRepository.findById(actorId);
  return user?.name ?? actorId;
}

/** append-only rule: task status may only move forward on the ladder. */
function assertTaskTransition(task: OfficeTaskDoc, patch: Record<string, unknown>): void {
  const next = patch.status as string | undefined;
  if (!next) return;
  const allowed: Record<string, readonly string[]> = {
    open: ['in_progress', 'cancelled'],
    in_progress: ['done', 'cancelled'],
    done: ['open'],
    cancelled: ['open'],
  };
  if (next === task.status) return;
  if (!allowed[task.status]?.includes(next)) {
    throw AppError.conflict(`Task cannot move from ${task.status} to ${next}`);
  }
}
