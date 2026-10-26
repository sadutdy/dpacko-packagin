import type { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '../../core/http/asyncHandler.js';
import { created, ok, paginated } from '../../core/http/apiResponse.js';
import { inventoryService } from './inventory.service.js';

export const inventoryController: {
  listMaterials: RequestHandler;
  createMaterial: RequestHandler;
  getMaterial: RequestHandler;
  updateMaterial: RequestHandler;
  listStock: RequestHandler;
  lowStock: RequestHandler;
  listMovements: RequestHandler;
  adjust: RequestHandler;
  receive: RequestHandler;
  reserve: RequestHandler;
  release: RequestHandler;
  consume: RequestHandler;
  wastage: RequestHandler;
  wastageReport: RequestHandler;
  valuation: RequestHandler;
} = {
  listMaterials: asyncHandler(async (req: Request, res: Response) => {
    const result = await inventoryService.listMaterials(req.valid?.query as Record<string, unknown>);
    return paginated(res, result.materials, result.meta);
  }),
  createMaterial: asyncHandler(async (req: Request, res: Response) =>
    created(res, await inventoryService.createMaterial(req.valid?.body as Record<string, unknown>))),
  getMaterial: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await inventoryService.getMaterial(id));
  }),
  updateMaterial: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await inventoryService.updateMaterial(id, req.valid?.body as Record<string, unknown>));
  }),
  listStock: asyncHandler(async (req: Request, res: Response) => ok(res, await inventoryService.listStock(req.valid?.query as Record<string, unknown>))),
  lowStock: asyncHandler(async (_req: Request, res: Response) => ok(res, await inventoryService.lowStock())),
  listMovements: asyncHandler(async (req: Request, res: Response) => {
    const result = await inventoryService.listMovements(req.valid?.query as Record<string, unknown>);
    return paginated(res, result.movements, result.meta);
  }),
  adjust: asyncHandler(async (req: Request, res: Response) =>
    ok(res, await inventoryService.adjust(req.valid?.body as never, req.user!.id))),
  receive: asyncHandler(async (req: Request, res: Response) =>
    ok(res, await inventoryService.receive(req.valid?.body as never, req.user!.id))),
  reserve: asyncHandler(async (req: Request, res: Response) =>
    ok(res, await inventoryService.reserve(req.valid?.body as never, req.user!.id))),
  release: asyncHandler(async (req: Request, res: Response) =>
    ok(res, await inventoryService.release(req.valid?.body as never, req.user!.id))),
  consume: asyncHandler(async (req: Request, res: Response) =>
    ok(res, await inventoryService.consume(req.valid?.body as never, req.user!.id))),
  wastage: asyncHandler(async (req: Request, res: Response) =>
    ok(res, await inventoryService.wastage(req.valid?.body as never, req.user!.id))),
  wastageReport: asyncHandler(async (_req: Request, res: Response) => ok(res, await inventoryService.wastageReport())),
  valuation: asyncHandler(async (_req: Request, res: Response) => ok(res, await inventoryService.valuation())),
};
