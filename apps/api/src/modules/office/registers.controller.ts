import type { Request, RequestHandler } from 'express';

import { sendCsvOrJson } from './registers.csv.js';
import { controlsService, registersService } from './registers.service.js';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import { created, ok } from '../../core/http/apiResponse.js';

const id = (req: Request) => (req.valid?.params as { id: string }).id;
const q = <T>(req: Request) => (req.valid?.query ?? {}) as T;
const b = <T>(req: Request) => (req.valid?.body ?? {}) as T;

export const registersController: {
  listCourier: RequestHandler;
  createCourier: RequestHandler;
  updateCourier: RequestHandler;
  listStationery: RequestHandler;
  createStationeryItem: RequestHandler;
  moveStationery: RequestHandler;
  listIndents: RequestHandler;
  createIndent: RequestHandler;
  patchIndent: RequestHandler;
  listMaintenance: RequestHandler;
  createMaintenance: RequestHandler;
  updateMaintenance: RequestHandler;
  listWaste: RequestHandler;
  createWaste: RequestHandler;
  listPettyCash: RequestHandler;
  createPettyCash: RequestHandler;
  updatePettyCash: RequestHandler;
  listVendorTracker: RequestHandler;
  createVendorTracker: RequestHandler;
  updateVendorTracker: RequestHandler;
  listDocuments: RequestHandler;
  createDocument: RequestHandler;
  updateDocument: RequestHandler;
  acknowledgeDocument: RequestHandler;
  listAcks: RequestHandler;
  listAttendance: RequestHandler;
  upsertAttendance: RequestHandler;
  listDeviations: RequestHandler;
  createDeviation: RequestHandler;
  updateDeviation: RequestHandler;
  listReminders: RequestHandler;
  createReminder: RequestHandler;
  updateReminder: RequestHandler;
  listMatrix: RequestHandler;
  upsertMatrix: RequestHandler;
  listChannels: RequestHandler;
} = {
  listCourier: asyncHandler(async (req, res) => {
    const { rows, meta } = await registersService.listCourier(q<{ direction?: string; page: number; limit: number; format?: string }>(req));
    return sendCsvOrJson(res, rows, q<{ format?: string }>(req).format, { rows, meta });
  }),
  createCourier: asyncHandler(async (req, res) =>
    created(res, await registersService.createCourier(b(req), req.user!.id)),
  ),
  updateCourier: asyncHandler(async (req, res) =>
    ok(res, await registersService.updateCourier(id(req), b(req), req.user!.id)),
  ),

  listStationery: asyncHandler(async (req, res) => {
    const { rows, meta } = await registersService.listStationery(q<{ page: number; limit: number }>(req));
    return sendCsvOrJson(res, rows, q<{ format?: string }>(req).format, { rows, meta });
  }),
  createStationeryItem: asyncHandler(async (req, res) =>
    created(res, await registersService.createStationeryItem(b(req), req.user!.id)),
  ),
  moveStationery: asyncHandler(async (req, res) =>
    created(res, await registersService.moveStationery(b(req), req.user!.id)),
  ),

  listIndents: asyncHandler(async (req, res) => {
    const { rows, meta } = await registersService.listIndents(q<{ status?: string; page: number; limit: number }>(req));
    return sendCsvOrJson(res, rows, q<{ format?: string }>(req).format, { rows, meta });
  }),
  createIndent: asyncHandler(async (req, res) =>
    created(res, await registersService.createIndent(b(req), req.user!.id, req.user!.role)),
  ),
  patchIndent: asyncHandler(async (req, res) =>
    ok(res, await registersService.patchIndent(id(req), b(req), req.user!.id, req.user!.role)),
  ),

  listMaintenance: asyncHandler(async (req, res) => {
    const { rows, meta } = await registersService.listMaintenance(q<{ page: number; limit: number }>(req));
    return sendCsvOrJson(res, rows, q<{ format?: string }>(req).format, { rows, meta });
  }),
  createMaintenance: asyncHandler(async (req, res) =>
    created(res, await registersService.createMaintenance(b(req), req.user!.id)),
  ),
  updateMaintenance: asyncHandler(async (req, res) =>
    ok(res, await registersService.updateMaintenance(id(req), b(req), req.user!.id)),
  ),

  listWaste: asyncHandler(async (req, res) => {
    const { rows, meta } = await registersService.listWaste(q<{ page: number; limit: number }>(req));
    return sendCsvOrJson(res, rows, q<{ format?: string }>(req).format, { rows, meta });
  }),
  createWaste: asyncHandler(async (req, res) =>
    created(res, await registersService.createWaste(b(req), req.user!.id)),
  ),

  listPettyCash: asyncHandler(async (req, res) => {
    const { rows, meta } = await registersService.listPettyCash(q<{ status?: string; page: number; limit: number }>(req));
    return sendCsvOrJson(res, rows, q<{ format?: string }>(req).format, { rows, meta });
  }),
  createPettyCash: asyncHandler(async (req, res) =>
    created(res, await registersService.createPettyCash(b(req), req.user!.id, req.user!.role)),
  ),
  updatePettyCash: asyncHandler(async (req, res) =>
    ok(res, await registersService.updatePettyCash(id(req), b(req), req.user!.id)),
  ),

  listVendorTracker: asyncHandler(async (req, res) => {
    const { rows, meta } = await registersService.listVendorTracker(q<{ page: number; limit: number }>(req));
    return sendCsvOrJson(res, rows, q<{ format?: string }>(req).format, { rows, meta });
  }),
  createVendorTracker: asyncHandler(async (req, res) =>
    created(res, await registersService.createVendorTracker(b(req), req.user!.id)),
  ),
  updateVendorTracker: asyncHandler(async (req, res) =>
    ok(res, await registersService.updateVendorTracker(id(req), b(req), req.user!.id)),
  ),

  listDocuments: asyncHandler(async (req, res) => {
    const { rows, meta } = await registersService.listDocuments(q<{ type?: string; page: number; limit: number }>(req));
    return sendCsvOrJson(res, rows, q<{ format?: string }>(req).format, { rows, meta });
  }),
  createDocument: asyncHandler(async (req, res) =>
    created(res, await registersService.createDocument(b(req), req.user!.id)),
  ),
  updateDocument: asyncHandler(async (req, res) =>
    ok(res, await registersService.updateDocument(id(req), b(req), req.user!.role)),
  ),
  acknowledgeDocument: asyncHandler(async (req, res) =>
    created(res, await registersService.acknowledgeDocument(b(req), req.user!.id)),
  ),
  listAcks: asyncHandler(async (req, res) => {
    const query = q<{ docId?: string; userId?: string }>(req);
    return ok(res, await registersService.listAcks(query.docId, query.userId));
  }),

  listAttendance: asyncHandler(async (req, res) =>
    ok(res, await registersService.listAttendance(q<{ date?: string; userId?: string }>(req))),
  ),
  upsertAttendance: asyncHandler(async (req, res) =>
    ok(res, await registersService.upsertAttendance(b(req), req.user!.id)),
  ),

  listDeviations: asyncHandler(async (req, res) =>
    ok(res, await registersService.listDeviations(q<{ openOnly?: string }>(req))),
  ),
  createDeviation: asyncHandler(async (req, res) =>
    created(res, await registersService.createDeviation(b(req), req.user!.id)),
  ),
  updateDeviation: asyncHandler(async (req, res) =>
    ok(res, await registersService.updateDeviation(id(req), b(req))),
  ),

  /* M7 controls */
  listReminders: asyncHandler(async (_req, res) => ok(res, await controlsService.listReminders())),
  createReminder: asyncHandler(async (req, res) => created(res, await controlsService.createReminder(b(req)))),
  updateReminder: asyncHandler(async (req, res) => ok(res, await controlsService.updateReminder(id(req), b(req)))),
  listMatrix: asyncHandler(async (_req, res) => ok(res, await controlsService.listMatrix())),
  upsertMatrix: asyncHandler(async (req, res) => ok(res, await controlsService.upsertMatrix(b(req)))),
  listChannels: asyncHandler(async (_req, res) => ok(res, await controlsService.listChannels())),
};
