import type { Request, RequestHandler } from 'express';

import { asyncHandler } from '../../core/http/asyncHandler.js';
import { created, ok, paginated } from '../../core/http/apiResponse.js';
import { notificationsService } from '../notifications/notification.service.js';
import { officeService } from './office.service.js';

const id = (req: Request) => (req.valid?.params as { id: string }).id;

export const officeController: {
  summary: RequestHandler;
  listChecklistTemplates: RequestHandler;
  createChecklistTemplate: RequestHandler;
  updateChecklistTemplate: RequestHandler;
  checklistState: RequestHandler;
  saveChecklist: RequestHandler;
  listTasks: RequestHandler;
  createTask: RequestHandler;
  updateTask: RequestHandler;
  listAppointments: RequestHandler;
  createAppointment: RequestHandler;
  updateAppointment: RequestHandler;
  listDeskOrders: RequestHandler;
  deskSummary: RequestHandler;
  getDeskOrder: RequestHandler;
  saveDeskStep: RequestHandler;
  printBill: RequestHandler;
  listNotifications: RequestHandler;
  listRoutes: RequestHandler;
  createRoute: RequestHandler;
  routesToday: RequestHandler;
  updateRoute: RequestHandler;
  listCallLogs: RequestHandler;
  createCallLog: RequestHandler;
  customerScreenContext: RequestHandler;
  listOutstanding: RequestHandler;
  listOutstandingSmall: RequestHandler;
  createSmallEntry: RequestHandler;
  addFollowup: RequestHandler;
  applyToOrder: RequestHandler;
  getDailyCash: RequestHandler;
  createDailyCash: RequestHandler;
  dispatchBoard: RequestHandler;
  listComplaints: RequestHandler;
  createComplaint: RequestHandler;
  updateComplaint: RequestHandler;
  listStockAlerts: RequestHandler;
  ackStockAlert: RequestHandler;
} = {
  summary: asyncHandler(async (req: Request, res) => {
    const { date } = (req.valid?.query ?? {}) as { date?: string };
    return ok(res, await officeService.summary(req.user!.id, date));
  }),

  /* ----------------------------- checklist ----------------------------- */
  listChecklistTemplates: asyncHandler(async (req, res) => {
    const { kind } = (req.valid?.query ?? {}) as { kind: string };
    return ok(res, await officeService.listChecklistTemplates(kind));
  }),

  createChecklistTemplate: asyncHandler(async (req, res) =>
    created(res, await officeService.createChecklistTemplate(req.valid?.body as Record<string, unknown>))),

  updateChecklistTemplate: asyncHandler(async (req, res) =>
    ok(res, await officeService.updateChecklistTemplate(id(req), req.valid?.body as Record<string, unknown>))),

  checklistState: asyncHandler(async (req, res) => {
    const q = (req.valid?.query ?? {}) as { kind: string; date?: string };
    return ok(res, await officeService.checklistState(q.kind, q.date, req.user!.id));
  }),

  saveChecklist: asyncHandler(async (req, res) =>
    ok(res, await officeService.saveChecklist(req.valid?.body as never, req.user!.role, req.user!.id))),

  /* -------------------------------- tasks ------------------------------- */
  listTasks: asyncHandler(async (req, res) => {
    const result = await officeService.listTasks(req.valid?.query as Record<string, unknown>, req.user!.id);
    return paginated(res, result.tasks, result.meta);
  }),

  createTask: asyncHandler(async (req, res) =>
    created(res, await officeService.createTask(req.valid?.body as Record<string, unknown>, req.user!.id))),

  updateTask: asyncHandler(async (req, res) =>
    ok(res, await officeService.updateTask(id(req), req.valid?.body as Record<string, unknown>))),

  /* ---------------------------- appointments ---------------------------- */
  listAppointments: asyncHandler(async (req, res) => {
    const result = await officeService.listAppointments(req.valid?.query as Record<string, unknown>);
    return paginated(res, result.appointments, result.meta);
  }),

  createAppointment: asyncHandler(async (req, res) =>
    created(res, await officeService.createAppointment(req.valid?.body as Record<string, unknown>, req.user!.id))),

  updateAppointment: asyncHandler(async (req, res) =>
    ok(res, await officeService.updateAppointment(id(req), req.valid?.body as Record<string, unknown>))),

  /* ------------------------- sales order desk (M2) ------------------------- */
  listDeskOrders: asyncHandler(async (req, res) => {
    const result = await officeService.listDeskOrders(req.valid?.query as Record<string, unknown>);
    return paginated(res, result.rows, result.meta);
  }),

  deskSummary: asyncHandler(async (req, res) => {
    const { date } = (req.valid?.query ?? {}) as { date?: string };
    return ok(res, await officeService.deskSummary(date));
  }),

  getDeskOrder: asyncHandler(async (req, res) => {
    const orderId = (req.valid?.params as { id: string }).id;
    return ok(res, await officeService.getDeskOrder(orderId));
  }),

  saveDeskStep: asyncHandler(async (req, res) =>
    ok(res, await officeService.saveDeskStep((req.valid?.params as { id: string }).id, req.valid?.body as { step: string; note?: string }, req.user!.id, req.user!.role))),

  printBill: asyncHandler(async (req, res) => {
    const body = (req.valid?.body ?? {}) as { copies?: number; note?: string };
    return ok(res, await officeService.printBill((req.valid?.params as { id: string }).id, { copies: body.copies ?? 2, note: body.note }, req.user!.id));
  }),

  listNotifications: asyncHandler(async (req, res) => {
    const q = (req.valid?.query ?? {}) as { event?: string; orderId?: string; group?: string; channel?: string; limit?: number };
    const filter: Record<string, unknown> = {};
    if (q.event) filter.event = q.event;
    if (q.orderId) filter.orderId = q.orderId;
    if (q.group) filter.group = q.group;
    if (q.channel) filter.channel = q.channel;
    return ok(res, await notificationsService.listLog(filter, q.limit ?? 50));
  }),

  /* ---------------------- follow-ups & routes (M3) ---------------------- */
  listRoutes: asyncHandler(async (req, res) =>
    ok(res, await officeService.listRoutes((req.valid?.query ?? {}) as Record<string, unknown>))),
  createRoute: asyncHandler(async (req, res) =>
    ok(res, await officeService.createRoute(req.valid?.body as never, req.user!.id))),
  routesToday: asyncHandler(async (req, res) => ok(res, await officeService.routesToday())),
  updateRoute: asyncHandler(async (req, res) =>
    ok(res, await officeService.updateRoute(id(req), req.valid?.body as Record<string, unknown>))),
  listCallLogs: asyncHandler(async (req, res) => {
    const result = await officeService.listCallLogs(req.valid?.query as never);
    return paginated(res, result.callLogs, result.meta);
  }),
  createCallLog: asyncHandler(async (req, res) =>
    ok(res, await officeService.createCallLog(req.valid?.body as never, req.user!.id))),
  customerScreenContext: asyncHandler(async (req, res) =>
    ok(res, await officeService.customerScreenContext((req.valid?.params as { id: string }).id))),

  /* ------------------------ outstanding (M4) ------------------------ */
  listOutstanding: asyncHandler(async (req, res) => {
    const { view } = (req.valid?.query ?? {}) as { view?: string };
    return ok(res, await officeService.listOutstanding(view ?? 'daily'));
  }),
  listOutstandingSmall: asyncHandler(async (_req, res) =>
    ok(res, await officeService.listOutstanding('small'))),
  createSmallEntry: asyncHandler(async (req, res) =>
    ok(res, await officeService.createSmallEntry(req.valid?.body as never, req.user!.id))),
  addFollowup: asyncHandler(async (req, res) =>
    ok(res, await officeService.addFollowup((req.valid?.params as { id: string }).id, req.valid?.body as never, req.user!.id))),
  applyToOrder: asyncHandler(async (req, res) => {
    const body = (req.valid?.body ?? {}) as { orderId?: string };
    return ok(res, await officeService.applySmallToOrder((req.valid?.params as { id: string }).id, body.orderId ?? '', req.user!.id));
  }),
  getDailyCash: asyncHandler(async (req, res) => {
    const { date } = (req.valid?.query ?? {}) as { date?: string };
    return ok(res, await officeService.dailyCash({ date }));
  }),
  createDailyCash: asyncHandler(async (req, res) =>
    ok(res, await officeService.createDailyCash(req.valid?.body as never, req.user!.id))),

  /* --------------- dispatch, complaints & stock alerts (M5) --------------- */
  dispatchBoard: asyncHandler(async (req, res) => {
    const { date } = (req.valid?.query ?? {}) as { date?: string };
    return ok(res, await officeService.dispatchBoard(date));
  }),
  listComplaints: asyncHandler(async (req, res) => {
    const result = await officeService.listComplaints(req.valid?.query as never);
    return paginated(res, result.rows, result.meta);
  }),
  createComplaint: asyncHandler(async (req, res) =>
    ok(res, await officeService.createComplaint(req.valid?.body as never, req.user!.id))),
  updateComplaint: asyncHandler(async (req, res) =>
    ok(res, await officeService.updateComplaint(id(req), req.valid?.body as never, req.user!.id))),
  listStockAlerts: asyncHandler(async (_req, res) => ok(res, await officeService.listStockAlerts())),
  ackStockAlert: asyncHandler(async (req, res) => {
    const body = (req.valid?.body ?? {}) as { note?: string };
    return ok(res, await officeService.ackStockAlert(id(req), body.note, req.user!.id));
  }),
};
