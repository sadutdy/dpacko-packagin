import type { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '../../core/http/asyncHandler.js';
import { created, ok, paginated } from '../../core/http/apiResponse.js';
import { catalogService } from './catalog.service.js';

export const catalogController: {
  list: RequestHandler;
  get: RequestHandler;
  categories: RequestHandler;
  templates: RequestHandler;
  bom: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  remove: RequestHandler;
  replaceBom: RequestHandler;
} = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await catalogService.listSkus(req.valid?.query as Record<string, unknown>);
    return paginated(res, result.skus, result.meta);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await catalogService.getSku(id));
  }),

  categories: asyncHandler(async (_req: Request, res: Response) => ok(res, await catalogService.categories())),

  templates: asyncHandler(async (_req: Request, res: Response) => ok(res, await catalogService.templates())),

  bom: asyncHandler(async (req: Request, res: Response) => {
    const { skuId } = req.valid?.params as { skuId: string };
    return ok(res, await catalogService.bom(skuId));
  }),

  create: asyncHandler(async (req: Request, res: Response) =>
    created(res, await catalogService.createSku(req.valid?.body as Record<string, unknown>))),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await catalogService.updateSku(id, req.valid?.body as Record<string, unknown>));
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await catalogService.deleteSku(id));
  }),

  replaceBom: asyncHandler(async (req: Request, res: Response) => {
    const { skuId } = req.valid?.params as { skuId: string };
    const { lines } = req.valid?.body as { lines: Record<string, unknown>[] };
    return ok(res, await catalogService.replaceBom(skuId, lines));
  }),
};
