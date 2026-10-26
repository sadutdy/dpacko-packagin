import { Router } from 'express';

import { Permission } from '@ameen/domain';

import { audit } from '../../core/middleware/audit.js';
import { authenticate } from '../../core/middleware/auth.js';
import { requirePermission } from '../../core/middleware/rbac.js';
import { validate } from '../../core/validation/index.js';
import { idParamSchema } from '../auth/auth.schema.js';
import { registersController } from './registers.controller.js';
import {
  deviationListSchema,
  attendanceListSchema,
  attendanceUpsertSchema,
  courierCreateSchema,
  courierListSchema,
  courierUpdateSchema,
  deviationCreateSchema,
  deviationUpdateSchema,
  sopAcknowledgeSchema,
  documentCreateSchema,
  documentListSchema,
  documentUpdateSchema,
  indentCreateSchema,
  indentListSchema,
  indentPatchSchema,
  maintenanceCreateSchema,
  maintenanceListSchema,
  maintenanceUpdateSchema,
  pettyCashCreateSchema,
  pettyCashListSchema,
  pettyCashUpdateSchema,
  registerListSchema,
  stationeryItemCreateSchema,
  stationeryMoveCreateSchema,
  vendorTrackerCreateSchema,
  vendorTrackerListSchema,
  vendorTrackerUpdateSchema,
  wasteCreateSchema,
  wasteListSchema,
} from './office.schema.js';

export const registersRouter: Router = Router();

registersRouter.use(authenticate);

/* courier */
registersRouter.get('/courier', requirePermission(Permission.OfficeRead), validate(courierListSchema, 'query'), registersController.listCourier);
registersRouter.post(
  '/courier',
  requirePermission(Permission.OfficeWrite),
  validate(courierCreateSchema),
  audit('office.courier.create', 'CourierEntry'),
  registersController.createCourier,
);
registersRouter.patch(
  '/courier/:id',
  requirePermission(Permission.OfficeWrite),
  validate(idParamSchema, 'params'),
  validate(courierUpdateSchema),
  audit('office.courier.update', 'CourierEntry'),
  registersController.updateCourier,
);

/* stationery */
registersRouter.get('/stationery', requirePermission(Permission.OfficeRead), validate(registerListSchema, 'query'), registersController.listStationery);
registersRouter.post(
  '/stationery',
  requirePermission(Permission.OfficeWrite),
  validate(stationeryItemCreateSchema),
  audit('office.stationery.item.create', 'StationeryItem'),
  registersController.createStationeryItem,
);
registersRouter.post(
  '/stationery/move',
  requirePermission(Permission.OfficeWrite),
  validate(stationeryMoveCreateSchema),
  audit('office.stationery.move', 'StationeryMove'),
  registersController.moveStationery,
);

/* indents */
registersRouter.get('/indents', requirePermission(Permission.OfficeRead), validate(indentListSchema, 'query'), registersController.listIndents);
registersRouter.post(
  '/indents',
  requirePermission(Permission.OfficeWrite),
  validate(indentCreateSchema),
  audit('office.indent.create', 'StationeryIndent'),
  registersController.createIndent,
);
registersRouter.patch(
  '/indents/:id',
  requirePermission(Permission.OfficeWrite),
  validate(idParamSchema, 'params'),
  validate(indentPatchSchema),
  audit('office.indent.decide', 'StationeryIndent'),
  registersController.patchIndent,
);

/* maintenance */
registersRouter.get('/maintenance', requirePermission(Permission.OfficeRead), validate(maintenanceListSchema, 'query'), registersController.listMaintenance);
registersRouter.post(
  '/maintenance',
  requirePermission(Permission.OfficeWrite),
  validate(maintenanceCreateSchema),
  audit('office.maintenance.create', 'MaintenanceLog'),
  registersController.createMaintenance,
);
registersRouter.patch(
  '/maintenance/:id',
  requirePermission(Permission.OfficeWrite),
  validate(idParamSchema, 'params'),
  validate(maintenanceUpdateSchema),
  audit('office.maintenance.update', 'MaintenanceLog'),
  registersController.updateMaintenance,
);

/* waste */
registersRouter.get('/waste', requirePermission(Permission.OfficeRead), validate(wasteListSchema, 'query'), registersController.listWaste);
registersRouter.post(
  '/waste',
  requirePermission(Permission.OfficeWrite),
  validate(wasteCreateSchema),
  audit('office.waste.create', 'WasteLog'),
  registersController.createWaste,
);

/* petty cash */
registersRouter.get('/petty-cash', requirePermission(Permission.OfficePettycash), validate(pettyCashListSchema, 'query'), registersController.listPettyCash);
registersRouter.post(
  '/petty-cash',
  requirePermission(Permission.OfficePettycash),
  validate(pettyCashCreateSchema),
  audit('office.petty-cash.create', 'PettyCashEntry'),
  registersController.createPettyCash,
);
registersRouter.patch(
  '/petty-cash/:id',
  requirePermission(Permission.OfficePettycash),
  validate(idParamSchema, 'params'),
  validate(pettyCashUpdateSchema),
  audit('office.petty-cash.update', 'PettyCashEntry'),
  registersController.updatePettyCash,
);

/* vendor deliveries tracker */
registersRouter.get('/vendor-tracker', requirePermission(Permission.OfficeRead), validate(vendorTrackerListSchema, 'query'), registersController.listVendorTracker);
registersRouter.post(
  '/vendor-tracker',
  requirePermission(Permission.OfficeWrite),
  validate(vendorTrackerCreateSchema),
  audit('office.vendor-tracker.create', 'VendorDeliveryTracker'),
  registersController.createVendorTracker,
);
registersRouter.patch(
  '/vendor-tracker/:id',
  requirePermission(Permission.OfficeWrite),
  validate(idParamSchema, 'params'),
  validate(vendorTrackerUpdateSchema),
  audit('office.vendor-tracker.update', 'VendorDeliveryTracker'),
  registersController.updateVendorTracker,
);

/* documents master & SOP acknowledgements */
registersRouter.get('/documents', requirePermission(Permission.OfficeRead), validate(documentListSchema, 'query'), registersController.listDocuments);
registersRouter.post(
  '/documents',
  requirePermission(Permission.OfficeWrite),
  validate(documentCreateSchema),
  audit('office.document.create', 'DocumentsMaster'),
  registersController.createDocument,
);
registersRouter.patch(
  '/documents/:id',
  requirePermission(Permission.OfficeDocumentsAuthorize),
  validate(idParamSchema, 'params'),
  validate(documentUpdateSchema),
  audit('office.document.update', 'DocumentsMaster'),
  registersController.updateDocument,
);
registersRouter.post(
  '/documents/acknowledge',
  requirePermission(Permission.OfficeRead),
  validate(sopAcknowledgeSchema),
  audit('office.document.acknowledge', 'DocumentAcknowledgement'),
  registersController.acknowledgeDocument,
);
registersRouter.get('/documents/acks', requirePermission(Permission.OfficeRead), registersController.listAcks);

/* attendance */
registersRouter.get('/attendance', requirePermission(Permission.OfficeEmployeeRead), validate(attendanceListSchema, 'query'), registersController.listAttendance);
registersRouter.post(
  '/attendance',
  requirePermission(Permission.OfficeEmployeeWrite),
  validate(attendanceUpsertSchema),
  audit('office.attendance.upsert', 'AttendanceInput'),
  registersController.upsertAttendance,
);

/* deviations */
registersRouter.get(
  '/deviations',
  requirePermission(Permission.OfficeRead),
  validate(deviationListSchema, 'query'),
  registersController.listDeviations,
);
registersRouter.post(
  '/deviations',
  requirePermission(Permission.OfficeWrite),
  validate(deviationCreateSchema),
  audit('office.deviation.create', 'Deviation'),
  registersController.createDeviation,
);
registersRouter.patch(
  '/deviations/:id',
  requirePermission(Permission.OfficeWrite),
  validate(idParamSchema, 'params'),
  validate(deviationUpdateSchema),
  audit('office.deviation.update', 'Deviation'),
  registersController.updateDeviation,
);
