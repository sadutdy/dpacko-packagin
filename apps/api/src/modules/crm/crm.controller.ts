import type { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '../../core/http/asyncHandler.js';
import { created, ok, paginated } from '../../core/http/apiResponse.js';
import { crmService } from './crm.service.js';

const id = (req: Request) => (req.valid?.params as { id: string }).id;
const addressId = (req: Request) => (req.valid?.params as { addressId: string }).addressId;

export const crmController: {
  list: RequestHandler;
  create: RequestHandler;
  get: RequestHandler;
  update: RequestHandler;
  remove: RequestHandler;
  orders: RequestHandler;
  credit: RequestHandler;
  adjustCredit: RequestHandler;
  addresses: RequestHandler;
  addAddress: RequestHandler;
  updateAddress: RequestHandler;
  removeAddress: RequestHandler;
  segments: RequestHandler;
  suggestions: RequestHandler;
} = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await crmService.list(req.valid?.query as Record<string, unknown>);
    return paginated(res, result.customers, result.meta);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const customer = await crmService.create(req.valid?.body as Record<string, unknown>);
    return created(res, customer);
  }),

  get: asyncHandler(async (req: Request, res: Response) => ok(res, await crmService.get(id(req)))),

  update: asyncHandler(async (req: Request, res: Response) =>
    ok(res, await crmService.update(id(req), req.valid?.body as Record<string, unknown>))),

  remove: asyncHandler(async (req: Request, res: Response) => ok(res, await crmService.remove(id(req)))),

  orders: asyncHandler(async (req: Request, res: Response) => {
    const result = await crmService.listOrders(id(req), req.valid?.query as Record<string, unknown>);
    return paginated(res, result.orders, result.meta);
  }),

  credit: asyncHandler(async (req: Request, res: Response) => ok(res, await crmService.creditSummary(id(req)))),

  adjustCredit: asyncHandler(async (req: Request, res: Response) =>
    ok(res, await crmService.adjustCredit(id(req), req.valid?.body as { creditLimit: number }))),

  addresses: asyncHandler(async (req: Request, res: Response) => ok(res, await crmService.listAddresses(id(req)))),

  addAddress: asyncHandler(async (req: Request, res: Response) =>
    created(res, await crmService.addAddress(id(req), req.valid?.body as Record<string, unknown>))),

  updateAddress: asyncHandler(async (req: Request, res: Response) =>
    ok(res, await crmService.updateAddress(id(req), addressId(req), req.valid?.body as Record<string, unknown>))),

  removeAddress: asyncHandler(async (req: Request, res: Response) =>
    ok(res, await crmService.removeAddress(id(req), addressId(req)))),

  segments: asyncHandler(async (_req: Request, res: Response) => ok(res, await crmService.segments())),

  suggestions: asyncHandler(async (_req: Request, res: Response) => ok(res, await crmService.suggestions())),
};
