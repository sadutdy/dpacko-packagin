import { Router } from 'express';
import { Permission } from '@ameen/domain';

import { validate } from '../../core/validation/index.js';
import { authenticate } from '../../core/middleware/auth.js';
import { requirePermission } from '../../core/middleware/rbac.js';
import { ordersController } from './orders.controller.js';
import {
  createOrderSchema,
  listOrdersSchema,
  listQuotesSchema,
  objectIdParamSchema,
  orderIdParamSchema,
  quotePreviewSchema,
  saveQuoteSchema,
  transitionSchema,
  updateOrderSchema,
  updateQuoteSchema,
} from './orders.schema.js';

export const ordersRouter: Router = Router();

ordersRouter.use(authenticate);

const read = Permission.OrdersRead;
const readAll = Permission.OrdersReadAll;
const write = Permission.OrdersWrite;

ordersRouter.get('/', requirePermission(read), validate(listOrdersSchema, 'query'), ordersController.list);
ordersRouter.post('/', requirePermission(write), validate(createOrderSchema), ordersController.create);
ordersRouter.get('/quotes', requirePermission(read), validate(listQuotesSchema, 'query'), ordersController.quotes);
ordersRouter.get('/quotes/seller', requirePermission(read), ordersController.quoteSeller);
ordersRouter.post('/quotes', requirePermission(write), validate(saveQuoteSchema), ordersController.createQuote);
ordersRouter.get('/quotes/:id', requirePermission(read), validate(objectIdParamSchema, 'params'), ordersController.getQuote);
ordersRouter.put('/quotes/:id', requirePermission(write), validate(objectIdParamSchema, 'params'), validate(saveQuoteSchema), ordersController.saveQuote);
ordersRouter.get('/quotes/:id/document', requirePermission(read), validate(objectIdParamSchema, 'params'), ordersController.quoteDocument);
ordersRouter.post('/quotes/preview', requirePermission(read), validate(quotePreviewSchema), ordersController.previewQuote);
ordersRouter.get('/:id', requirePermission(read), validate(orderIdParamSchema, 'params'), ordersController.get);
ordersRouter.get('/:id/invoice', requirePermission(read), validate(orderIdParamSchema, 'params'), ordersController.myInvoice);
ordersRouter.patch('/:id', requirePermission(write), validate(orderIdParamSchema, 'params'), validate(updateOrderSchema), ordersController.update);
ordersRouter.post('/:id/transition', requirePermission(readAll), validate(orderIdParamSchema, 'params'), validate(transitionSchema), ordersController.transition);
ordersRouter.delete('/:id', requirePermission(write), validate(orderIdParamSchema, 'params'), ordersController.remove);
ordersRouter.patch('/quotes/:id', requirePermission(write), validate(objectIdParamSchema, 'params'), validate(updateQuoteSchema), ordersController.updateQuote);
ordersRouter.delete('/quotes/:id', requirePermission(write), validate(objectIdParamSchema, 'params'), ordersController.deleteQuote);
