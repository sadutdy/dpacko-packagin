import type { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '../../core/http/asyncHandler.js';
import { created, ok, paginated } from '../../core/http/apiResponse.js';
import { productionService } from './production.service.js';

export const productionController: {
  listJobs: RequestHandler;
  getJob: RequestHandler;
  createJob: RequestHandler;
  transition: RequestHandler;
  recordQc: RequestHandler;
  reserveMaterials: RequestHandler;
  consumeMaterials: RequestHandler;
  stageCounts: RequestHandler;
  sync: RequestHandler;
  listMachines: RequestHandler;
  createMachine: RequestHandler;
  updateMachine: RequestHandler;
  listChecklists: RequestHandler;
  createChecklist: RequestHandler;
  listShifts: RequestHandler;
  createShift: RequestHandler;
} = {
  listJobs: asyncHandler(async (req: Request, res: Response) => {
    const result = await productionService.listJobs(req.valid?.query as Record<string, unknown>);
    return paginated(res, result.jobs, result.meta);
  }),

  getJob: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await productionService.getJob(id));
  }),

  createJob: asyncHandler(async (req: Request, res: Response) =>
    created(res, await productionService.createJob(req.valid?.body as never, req.user!.id))),

  transition: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await productionService.transition(id, req.valid?.body as never, req.user!.id, req.user!.role));
  }),

  recordQc: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await productionService.recordQc(id, req.valid?.body as never, req.user!.id));
  }),

  reserveMaterials: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await productionService.reserveMaterials(id, req.valid?.body as never, req.user!.id));
  }),

  consumeMaterials: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    const { location } = req.valid?.body as { location?: string };
    return ok(res, await productionService.consumeMaterials(id, location ?? 'STORE-1', req.user!.id));
  }),

  stageCounts: asyncHandler(async (_req: Request, res: Response) => ok(res, await productionService.stageCounts())),

  sync: asyncHandler(async (req: Request, res: Response) =>
    ok(res, await productionService.sync(req.valid?.body as never, req.user!.id, req.user!.role))),

  listMachines: asyncHandler(async (_req: Request, res: Response) => ok(res, await productionService.listMachines())),
  createMachine: asyncHandler(async (req: Request, res: Response) =>
    created(res, await productionService.createMachine(req.valid?.body as Record<string, unknown>))),
  updateMachine: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await productionService.updateMachine(id, req.valid?.body as Record<string, unknown>));
  }),
  listChecklists: asyncHandler(async (_req: Request, res: Response) => ok(res, await productionService.listChecklists())),
  createChecklist: asyncHandler(async (req: Request, res: Response) =>
    created(res, await productionService.createChecklist(req.valid?.body as Record<string, unknown>))),
  listShifts: asyncHandler(async (_req: Request, res: Response) => ok(res, await productionService.listShifts())),
  createShift: asyncHandler(async (req: Request, res: Response) =>
    created(res, await productionService.createShift(req.valid?.body as Record<string, unknown>))),
};
