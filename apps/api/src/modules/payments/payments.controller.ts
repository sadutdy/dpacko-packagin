import type { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '../../core/http/asyncHandler.js';
import { created, ok, paginated } from '../../core/http/apiResponse.js';
import type { SaveInvoiceInput } from './payments.schema.js';
import { paymentsService } from './payments.service.js';

export const paymentsController: {
  listInvoices: RequestHandler;
  getInvoice: RequestHandler;
  createInvoice: RequestHandler;
  invoiceSeller: RequestHandler;
  getInvoiceForEdit: RequestHandler;
  getInvoiceDocument: RequestHandler;
  saveInvoice: RequestHandler;
  updateInvoice: RequestHandler;
  deleteInvoice: RequestHandler;
  listPayments: RequestHandler;
  getPayment: RequestHandler;
  recordPayment: RequestHandler;
  receivables: RequestHandler;
  createRazorpayOrder: RequestHandler;
  captureRazorpayPayment: RequestHandler;
} = {
  listInvoices: asyncHandler(async (req: Request, res: Response) => {
    const result = await paymentsService.listInvoices(req.valid?.query as Record<string, unknown>);
    return paginated(res, result.invoices, result.meta);
  }),
  getInvoice: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await paymentsService.getInvoice(id));
  }),
  createInvoice: asyncHandler(async (req: Request, res: Response) => {
    const body = req.valid?.body as SaveInvoiceInput | { orderId: string };
    // Editor payloads carry items; a bare { orderId } cuts the order's invoice (FIN-1).
    if ('items' in body) return created(res, await paymentsService.saveInvoice(body, req.user!.id));
    return created(res, await paymentsService.createInvoice(body.orderId, req.user!.id));
  }),
  invoiceSeller: asyncHandler(async (_req: Request, res: Response) => ok(res, await paymentsService.invoiceSeller())),
  getInvoiceForEdit: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await paymentsService.getInvoiceForEdit(id));
  }),
  getInvoiceDocument: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await paymentsService.getInvoiceDocument(id));
  }),
  saveInvoice: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await paymentsService.saveInvoice(req.valid?.body as SaveInvoiceInput, req.user!.id, id));
  }),
  updateInvoice: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await paymentsService.updateInvoice(id, req.valid?.body as never));
  }),
  deleteInvoice: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await paymentsService.deleteInvoice(id));
  }),
  listPayments: asyncHandler(async (req: Request, res: Response) => {
    const result = await paymentsService.listPayments(req.valid?.query as Record<string, unknown>);
    return paginated(res, result.payments, result.meta);
  }),
  getPayment: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await paymentsService.getPayment(id));
  }),
  recordPayment: asyncHandler(async (req: Request, res: Response) =>
    created(res, await paymentsService.recordPayment(req.valid?.body as never, req.user!.id))),
  receivables: asyncHandler(async (_req: Request, res: Response) => ok(res, await paymentsService.receivables())),
  createRazorpayOrder: asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.valid?.body as { orderId: string };
    return ok(res, await paymentsService.createRazorpayOrder(orderId));
  }),
  captureRazorpayPayment: asyncHandler(async (req: Request, res: Response) =>
    ok(res, await paymentsService.captureRazorpayPayment(req.valid?.body as never))),
};
