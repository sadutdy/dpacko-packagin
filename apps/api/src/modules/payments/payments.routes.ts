import { Router } from 'express';
import { Permission } from '@ameen/domain';

import { validate } from '../../core/validation/index.js';
import { authenticate } from '../../core/middleware/auth.js';
import { requirePermission } from '../../core/middleware/rbac.js';
import { objectIdSchema } from '../auth/auth.schema.js';
import { paymentsController } from './payments.controller.js';
import {
  createInvoiceSchema,
  invoiceIdParamSchema,
  listInvoicesSchema,
  listPaymentsSchema,
  razorpayCaptureSchema,
  razorpayOrderSchema,
  recordPaymentSchema,
  saveInvoiceSchema,
  updateInvoiceSchema,
} from './payments.schema.js';

export const paymentsRouter: Router = Router();

paymentsRouter.use(authenticate);

const read = Permission.ReportsRead;
const write = Permission.SettingsWrite;

paymentsRouter.get('/invoices', requirePermission(Permission.OrdersReadAll), validate(listInvoicesSchema, 'query'), paymentsController.listInvoices);
paymentsRouter.post('/invoices', requirePermission(write), validate(createInvoiceSchema), paymentsController.createInvoice);
paymentsRouter.get('/invoices/seller', requirePermission(Permission.OrdersReadAll), paymentsController.invoiceSeller);
paymentsRouter.get('/invoices/:id/editable', requirePermission(Permission.OrdersReadAll), validate(invoiceIdParamSchema, 'params'), paymentsController.getInvoiceForEdit);
paymentsRouter.get('/invoices/:id/document', requirePermission(Permission.OrdersReadAll), validate(invoiceIdParamSchema, 'params'), paymentsController.getInvoiceDocument);
paymentsRouter.put('/invoices/:id', requirePermission(write), validate(invoiceIdParamSchema, 'params'), validate(saveInvoiceSchema), paymentsController.saveInvoice);
paymentsRouter.get('/invoices/:id', requirePermission(Permission.OrdersReadAll), validate(invoiceIdParamSchema, 'params'), paymentsController.getInvoice);
paymentsRouter.patch('/invoices/:id', requirePermission(write), validate(invoiceIdParamSchema, 'params'), validate(updateInvoiceSchema), paymentsController.updateInvoice);
paymentsRouter.delete('/invoices/:id', requirePermission(write), validate(invoiceIdParamSchema, 'params'), paymentsController.deleteInvoice);
paymentsRouter.get('/payments', requirePermission(Permission.OrdersReadAll), validate(listPaymentsSchema, 'query'), paymentsController.listPayments);
paymentsRouter.get('/payments/:id', requirePermission(Permission.OrdersReadAll), validate(objectIdSchema), paymentsController.getPayment);
paymentsRouter.post('/payments', requirePermission(write), validate(recordPaymentSchema), paymentsController.recordPayment);
paymentsRouter.get('/receivables', requirePermission(read), paymentsController.receivables);

paymentsRouter.post('/razorpay/order', requirePermission(Permission.OrdersWrite), validate(razorpayOrderSchema), paymentsController.createRazorpayOrder);
paymentsRouter.post('/razorpay/capture', requirePermission(write), validate(razorpayCaptureSchema), paymentsController.captureRazorpayPayment);
