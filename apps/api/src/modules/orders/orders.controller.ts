import type { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '../../core/http/asyncHandler.js';
import { created, ok, paginated } from '../../core/http/apiResponse.js';
import { User } from '../auth/auth.model.js';
import { paymentsService } from '../payments/payments.service.js';
import { ordersService } from './orders.service.js';

/** Customer-role requests are scoped to their own customer record. */
async function customerIdForScoping(req: Request): Promise<string | undefined> {
  if (req.user?.role !== 'customer') return undefined;
  const user = await User.findById(req.user.id).lean<{ customerId?: string | null }>().exec();
  return user?.customerId ? String(user.customerId) : '__none__';
}

export const ordersController: {
  list: RequestHandler;
  get: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  transition: RequestHandler;
  remove: RequestHandler;
  quotes: RequestHandler;
  updateQuote: RequestHandler;
  deleteQuote: RequestHandler;
  previewQuote: RequestHandler;
  quoteDocument: RequestHandler;
  quoteSeller: RequestHandler;
  getQuote: RequestHandler;
  createQuote: RequestHandler;
  saveQuote: RequestHandler;
  myInvoice: RequestHandler;
} = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const scopedCustomerId = await customerIdForScoping(req);
    const query = scopedCustomerId ? { ...(req.valid?.query as object), customerId: scopedCustomerId } : (req.valid?.query as object);
    const result = await ordersService.listOrders(query as Record<string, unknown>);
    return paginated(res, result.orders, result.meta);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    const order = await ordersService.getOrder(id);
    const scopedCustomerId = await customerIdForScoping(req);
    if (scopedCustomerId && String((order as { customerId: unknown }).customerId) !== scopedCustomerId) {
      return ok(res, null);
    }
    return ok(res, order);
  }),

  create: asyncHandler(async (req: Request, res: Response) =>
    created(res, await ordersService.createOrder(req.valid?.body as never, req.user!.id))),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await ordersService.updateOrder(id, req.valid?.body as never));
  }),

  transition: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await ordersService.transition(id, req.valid?.body as never, req.user!.id, req.user!.role));
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await ordersService.deleteOrder(id, req.user!.id, req.user!.role));
  }),

  quotes: asyncHandler(async (req: Request, res: Response) => {
    const scopedCustomerId = await customerIdForScoping(req);
    const query = scopedCustomerId ? { ...(req.valid?.query as object), customerId: scopedCustomerId } : (req.valid?.query as object);
    const result = await ordersService.listQuotes(query as Record<string, unknown>);
    return paginated(res, result.quotes, result.meta);
  }),

  updateQuote: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await ordersService.updateQuote(id, req.valid?.body as never));
  }),

  deleteQuote: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await ordersService.deleteQuote(id));
  }),

  previewQuote: asyncHandler(async (req: Request, res: Response) =>
    created(res, await ordersService.previewQuote(req.valid?.body as never))),

  quoteSeller: asyncHandler(async (_req: Request, res: Response) => ok(res, await ordersService.quoteSeller())),

  getQuote: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await ordersService.getQuoteForEdit(id, await customerIdForScoping(req)));
  }),

  createQuote: asyncHandler(async (req: Request, res: Response) =>
    created(res, await ordersService.saveQuote(req.valid?.body as never, req.user!.id))),

  saveQuote: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await ordersService.saveQuote(req.valid?.body as never, req.user!.id, id));
  }),

  quoteDocument: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await ordersService.getQuoteDocument(id, await customerIdForScoping(req)));
  }),

  myInvoice: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    const order = await ordersService.getOrder(id);
    const scopedCustomerId = await customerIdForScoping(req);
    if (scopedCustomerId && String((order as { customerId: unknown }).customerId) !== scopedCustomerId) {
      return ok(res, null);
    }
    if (!order.invoiceId) return ok(res, null);
    return ok(res, await paymentsService.getInvoice(String(order.invoiceId)));
  }),
};
