import type { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '../../core/http/asyncHandler.js';
import { created, ok, paginated } from '../../core/http/apiResponse.js';
import { purchasingService } from './purchasing.service.js';

export const purchasingController: {
  listVendors: RequestHandler;
  getVendor: RequestHandler;
  createVendor: RequestHandler;
  updateVendor: RequestHandler;
  listPurchaseOrders: RequestHandler;
  getPurchaseOrder: RequestHandler;
  createPurchaseOrder: RequestHandler;
  sendPurchaseOrder: RequestHandler;
  cancelPurchaseOrder: RequestHandler;
  receiveGoods: RequestHandler;
  listGoodsReceipts: RequestHandler;
  getGoodsReceipt: RequestHandler;
} = {
  listVendors: asyncHandler(async (req: Request, res: Response) => {
    const result = await purchasingService.listVendors(req.valid?.query as Record<string, unknown>);
    return paginated(res, result.vendors, result.meta);
  }),

  getVendor: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await purchasingService.getVendor(id));
  }),

  createVendor: asyncHandler(async (req: Request, res: Response) =>
    created(res, await purchasingService.createVendor(req.valid?.body as Record<string, unknown>))),

  updateVendor: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await purchasingService.updateVendor(id, req.valid?.body as Record<string, unknown>));
  }),

  listPurchaseOrders: asyncHandler(async (req: Request, res: Response) => {
    const result = await purchasingService.listPurchaseOrders(req.valid?.query as Record<string, unknown>);
    return paginated(res, result.orders, result.meta);
  }),

  getPurchaseOrder: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await purchasingService.getPurchaseOrder(id));
  }),

  createPurchaseOrder: asyncHandler(async (req: Request, res: Response) =>
    created(res, await purchasingService.createPurchaseOrder(req.valid?.body as never, req.user!.id))),

  sendPurchaseOrder: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await purchasingService.sendPurchaseOrder(id));
  }),

  cancelPurchaseOrder: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await purchasingService.cancelPurchaseOrder(id));
  }),

  receiveGoods: asyncHandler(async (req: Request, res: Response) =>
    created(res, await purchasingService.receiveGoods(req.valid?.body as never, req.user!.id))),

  listGoodsReceipts: asyncHandler(async (req: Request, res: Response) => {
    const result = await purchasingService.listGoodsReceipts(req.valid?.query as Record<string, unknown>);
    return paginated(res, result.receipts, result.meta);
  }),

  getGoodsReceipt: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await purchasingService.getGoodsReceipt(id));
  }),
};
