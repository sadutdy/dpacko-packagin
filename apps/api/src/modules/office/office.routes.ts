import { Router } from 'express';

import { Permission } from '@ameen/domain';

import { audit } from '../../core/middleware/audit.js';
import { authenticate } from '../../core/middleware/auth.js';
import { requirePermission } from '../../core/middleware/rbac.js';
import { validate } from '../../core/validation/index.js';
import { idParamSchema } from '../auth/auth.schema.js';
import { officeController } from './office.controller.js';
import { registersController } from './registers.controller.js';
import { registersRouter } from './registers.routes.js';
import {
  appointmentCreateSchema,
  appointmentListSchema,
  appointmentUpdateSchema,
  applyToOrderSchema,
  callLogCreateSchema,
  callLogListSchema,
  checklistDailySchema,
  checklistQuerySchema,
  checklistTemplateCreateSchema,
  checklistTemplateUpdateSchema,
  complaintCreateSchema,
  complaintListSchema,
  complaintUpdateSchema,
  dailyCashCreateSchema,
  dailyCashQuerySchema,
  deskListSchema,
  deskStepCreateSchema,
  deskSummarySchema,
  dispatchBoardSchema,
  deviationListSchema,
  followupCreateSchema,
  notificationLogQuerySchema,
  outstandingViewSchema,
  printBillSchema,
  routeCreateSchema,
  routeListSchema,
  routeUpdateSchema,
  smallEntryCreateSchema,
  stockAckSchema,
  reminderCreateSchema,
  reminderUpdateSchema,
  matrixUpsertSchema,
  deviationCreateSchema,
  deviationUpdateSchema,
  sopAcknowledgeSchema,
  reminderKeyParamsSchema,
  summaryQuerySchema,
  taskCreateSchema,
  taskListSchema,
  taskUpdateSchema,
} from './office.schema.js';

/** Role.OfficeAdmin's daily driver — Module 1 "My Day". */
export const officeRouter: Router = Router();

officeRouter.use(authenticate);

officeRouter.get('/summary', requirePermission(Permission.OfficeRead), validate(summaryQuerySchema, 'query'), officeController.summary);

/* checklist templates (config) */
officeRouter.get(
  '/checklist/templates',
  requirePermission(Permission.OfficeRead),
  validate(checklistQuerySchema, 'query'),
  officeController.listChecklistTemplates,
);
officeRouter.post(
  '/checklist/templates',
  requirePermission(Permission.OfficeWrite),
  validate(checklistTemplateCreateSchema),
  audit('office.checklist.template.create', 'ChecklistItem'),
  officeController.createChecklistTemplate,
);
officeRouter.patch(
  '/checklist/templates/:id',
  requirePermission(Permission.OfficeWrite),
  validate(idParamSchema, 'params'),
  validate(checklistTemplateUpdateSchema),
  audit('office.checklist.template.update', 'ChecklistItem'),
  officeController.updateChecklistTemplate,
);

/* daily checklist answers (one submission per kind+day) */
officeRouter.get(
  '/checklist/daily',
  requirePermission(Permission.OfficeRead),
  validate(checklistQuerySchema, 'query'),
  officeController.checklistState,
);
officeRouter.post(
  '/checklist/daily',
  requirePermission(Permission.OfficeWrite),
  validate(checklistDailySchema),
  audit('office.checklist.save', 'ChecklistSubmission'),
  officeController.saveChecklist,
);

/* tasks / shared inbox / urgent requests */
officeRouter.get('/tasks', requirePermission(Permission.OfficeRead), validate(taskListSchema, 'query'), officeController.listTasks);
officeRouter.post(
  '/tasks',
  requirePermission(Permission.OfficeWrite),
  validate(taskCreateSchema),
  audit('office.task.create', 'OfficeTask'),
  officeController.createTask,
);
officeRouter.patch(
  '/tasks/:id',
  requirePermission(Permission.OfficeWrite),
  validate(idParamSchema, 'params'),
  validate(taskUpdateSchema),
  audit('office.task.update', 'OfficeTask'),
  officeController.updateTask,
);

/* visitors & meetings */
officeRouter.get('/visitors', requirePermission(Permission.OfficeRead), validate(appointmentListSchema, 'query'), officeController.listAppointments);
officeRouter.post(
  '/visitors',
  requirePermission(Permission.OfficeWrite),
  validate(appointmentCreateSchema),
  audit('office.visitor.create', 'Appointment'),
  officeController.createAppointment,
);
officeRouter.patch(
  '/visitors/:id',
  requirePermission(Permission.OfficeWrite),
  validate(idParamSchema, 'params'),
  validate(appointmentUpdateSchema),
  audit('office.visitor.update', 'Appointment'),
  officeController.updateAppointment,
);

/* ------------------------- sales order desk (M2) ------------------------- */

officeRouter.get(
  '/desk',
  requirePermission(Permission.OrdersDesk),
  validate(deskListSchema, 'query'),
  officeController.listDeskOrders,
);
officeRouter.get(
  '/desk/summary',
  requirePermission(Permission.OrdersDesk),
  validate(deskSummarySchema, 'query'),
  officeController.deskSummary,
);
officeRouter.get(
  '/desk/:id',
  requirePermission(Permission.OrdersDesk),
  validate(idParamSchema, 'params'),
  officeController.getDeskOrder,
);
officeRouter.post(
  '/desk/:id/steps',
  requirePermission(Permission.OrdersDesk),
  validate(idParamSchema, 'params'),
  validate(deskStepCreateSchema),
  audit('office.desk.step', 'OrderDeskStep'),
  officeController.saveDeskStep,
);
officeRouter.post(
  '/desk/:id/print-bill',
  requirePermission(Permission.OrdersDesk),
  validate(idParamSchema, 'params'),
  validate(printBillSchema),
  audit('office.desk.print', 'Invoice'),
  officeController.printBill,
);

/* message / notification log (read-only) */
officeRouter.get(
  '/notifications',
  requirePermission(Permission.OfficeRead),
  validate(notificationLogQuerySchema, 'query'),
  officeController.listNotifications,
);

/* -------------------- follow-ups & routes (M3) -------------------- */

officeRouter.get('/routes', requirePermission(Permission.OfficeRead), validate(routeListSchema, 'query'), officeController.listRoutes);
officeRouter.post(
  '/routes',
  requirePermission(Permission.OfficeWrite),
  validate(routeCreateSchema),
  audit('office.route.create', 'RouteSchedule'),
  officeController.createRoute,
);
officeRouter.get('/routes/today', requirePermission(Permission.OfficeRead), officeController.routesToday);
officeRouter.patch(
  '/routes/:id',
  requirePermission(Permission.OfficeWrite),
  validate(idParamSchema, 'params'),
  validate(routeUpdateSchema),
  audit('office.route.update', 'RouteSchedule'),
  officeController.updateRoute,
);

officeRouter.get(
  '/followups/call-logs',
  requirePermission(Permission.OfficeRead),
  validate(callLogListSchema, 'query'),
  officeController.listCallLogs,
);
officeRouter.post(
  '/followups/call-logs',
  requirePermission(Permission.OfficeWrite),
  validate(callLogCreateSchema),
  audit('office.calllog.create', 'CallLog'),
  officeController.createCallLog,
);
officeRouter.get(
  '/followups/screen-context/:id',
  requirePermission(Permission.OfficeRead),
  validate(idParamSchema, 'params'),
  officeController.customerScreenContext,
);

/* ------------------------ outstanding (M4) ------------------------ */

officeRouter.get(
  '/outstanding',
  requirePermission(Permission.OfficeRead),
  validate(outstandingViewSchema, 'query'),
  officeController.listOutstanding,
);
officeRouter.post(
  '/outstanding/small',
  requirePermission(Permission.OfficeWrite),
  validate(smallEntryCreateSchema),
  audit('office.outstanding.small.create', 'SmallOutstandingLedger'),
  officeController.createSmallEntry,
);
officeRouter.get(
  '/outstanding/small',
  requirePermission(Permission.OfficeRead),
  validate(outstandingViewSchema, 'query'),
  officeController.listOutstandingSmall,
);
officeRouter.post(
  '/outstanding/:id/followup',
  requirePermission(Permission.OfficeWrite),
  validate(idParamSchema, 'params'),
  validate(followupCreateSchema),
  audit('office.outstanding.followup', 'OutstandingFollowup'),
  officeController.addFollowup,
);
officeRouter.post(
  '/outstanding/:id/apply-to-order',
  requirePermission(Permission.OfficeWrite),
  validate(idParamSchema, 'params'),
  validate(applyToOrderSchema),
  audit('office.outstanding.apply-to-order', 'SmallOutstandingLedger'),
  officeController.applyToOrder,
);
officeRouter.get('/daily-cash', requirePermission(Permission.OfficeRead), validate(dailyCashQuerySchema, 'query'), officeController.getDailyCash);
officeRouter.post(
  '/daily-cash',
  requirePermission(Permission.OfficeWrite),
  validate(dailyCashCreateSchema),
  audit('office.daily-cash.create', 'DailyCashClose'),
  officeController.createDailyCash,
);

/* --------------- dispatch, complaints & stock alerts (M5) --------------- */

officeRouter.get(
  '/dispatch-board',
  requirePermission(Permission.OfficeRead),
  validate(dispatchBoardSchema, 'query'),
  officeController.dispatchBoard,
);

officeRouter.get(
  '/complaints',
  requirePermission(Permission.OfficeRead),
  validate(complaintListSchema, 'query'),
  officeController.listComplaints,
);
officeRouter.post(
  '/complaints',
  requirePermission(Permission.OfficeWrite),
  validate(complaintCreateSchema),
  audit('office.complaint.create', 'OfficeComplaint'),
  officeController.createComplaint,
);
officeRouter.patch(
  '/complaints/:id',
  requirePermission(Permission.OfficeWrite),
  validate(idParamSchema, 'params'),
  validate(complaintUpdateSchema),
  audit('office.complaint.update', 'OfficeComplaint'),
  officeController.updateComplaint,
);

officeRouter.get('/stock-alerts', requirePermission(Permission.OfficeRead), officeController.listStockAlerts);
officeRouter.post(
  '/stock-alerts/:id/ack',
  requirePermission(Permission.OfficeWrite),
  validate(idParamSchema, 'params'),
  validate(stockAckSchema),
  audit('office.stock-alert.ack', 'Material'),
  officeController.ackStockAlert,
);

/* registers 1–9 (M6) */
officeRouter.use('/registers', registersRouter);

/* controls (M7): reminders, delegation matrix, channels, SOP acknowledgements,
 * top-level deviations aliases per plan §6 */
officeRouter.get('/reminders', requirePermission(Permission.OfficeRead), registersController.listReminders);
officeRouter.post(
  '/reminders',
  requirePermission(Permission.OfficeWrite),
  validate(reminderCreateSchema),
  audit('office.reminder.create', 'ReminderRule'),
  registersController.createReminder,
);
officeRouter.patch(
  '/reminders/:id',
  requirePermission(Permission.OfficeWrite),
  validate(reminderKeyParamsSchema, 'params'),
  validate(reminderUpdateSchema),
  audit('office.reminder.update', 'ReminderRule'),
  registersController.updateReminder,
);
officeRouter.get('/matrix', requirePermission(Permission.OfficeMatrixRead), registersController.listMatrix);
officeRouter.put(
  '/matrix',
  requirePermission(Permission.OfficeMatrixWrite),
  validate(matrixUpsertSchema),
  audit('office.matrix.upsert', 'DelegationMatrix'),
  registersController.upsertMatrix,
);
officeRouter.get('/channels', requirePermission(Permission.OfficeRead), registersController.listChannels);
officeRouter.get('/sop/acknowledge', requirePermission(Permission.OfficeRead), registersController.listAcks);
officeRouter.post(
  '/sop/acknowledge',
  requirePermission(Permission.OfficeRead),
  validate(sopAcknowledgeSchema),
  audit('office.sop.acknowledge', 'DocumentAcknowledgement'),
  registersController.acknowledgeDocument,
);
officeRouter.get(
  '/deviations',
  requirePermission(Permission.OfficeRead),
  validate(deviationListSchema, 'query'),
  registersController.listDeviations,
);
officeRouter.post(
  '/deviations',
  requirePermission(Permission.OfficeWrite),
  validate(deviationCreateSchema),
  audit('office.deviation.create', 'Deviation'),
  registersController.createDeviation,
);
officeRouter.patch(
  '/deviations/:id',
  requirePermission(Permission.OfficeWrite),
  validate(idParamSchema, 'params'),
  validate(deviationUpdateSchema),
  audit('office.deviation.update', 'Deviation'),
  registersController.updateDeviation,
);
