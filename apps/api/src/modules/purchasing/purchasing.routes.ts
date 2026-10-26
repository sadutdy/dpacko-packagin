import { Router } from 'express';
import { Permission } from '@ameen/domain';

import { validate } from '../../core/validation/index.js';
import { authenticate } from '../../core/middleware/auth.js';
import { requirePermission } from '../../core/middleware/rbac.js';
import { purchasingController } from './purchasing.controller.js';
import {
  createGrnSchema,
  createPoSchema,
  listPosSchema,
  listVendorsSchema,
  updateVendorSchema,
  vendorIdParamSchema,
  vendorSchema,
} from './purchasing.schema.js';

export const purchasingRouter: Router = Router();

purchasingRouter.use(authenticate);

const read = Permission.PurchasingRead;
const write = Permission.PurchasingWrite;

purchasingRouter.get('/vendors', requirePermission(read), validate(listVendorsSchema, 'query'), purchasingController.listVendors);
purchasingRouter.post('/vendors', requirePermission(write), validate(vendorSchema), purchasingController.createVendor);
purchasingRouter.get('/vendors/:id', requirePermission(read), validate(vendorIdParamSchema, 'params'), purchasingController.getVendor);
purchasingRouter.patch('/vendors/:id', requirePermission(write), validate(vendorIdParamSchema, 'params'), validate(updateVendorSchema), purchasingController.updateVendor);

purchasingRouter.get('/purchase-orders', requirePermission(read), validate(listPosSchema, 'query'), purchasingController.listPurchaseOrders);
purchasingRouter.post('/purchase-orders', requirePermission(write), validate(createPoSchema), purchasingController.createPurchaseOrder);
purchasingRouter.get('/purchase-orders/:id', requirePermission(read), validate(vendorIdParamSchema, 'params'), purchasingController.getPurchaseOrder);
purchasingRouter.post('/purchase-orders/:id/send', requirePermission(write), validate(vendorIdParamSchema, 'params'), purchasingController.sendPurchaseOrder);
purchasingRouter.post('/purchase-orders/:id/cancel', requirePermission(write), validate(vendorIdParamSchema, 'params'), purchasingController.cancelPurchaseOrder);
purchasingRouter.post('/goods-receipts', requirePermission(write), validate(createGrnSchema), purchasingController.receiveGoods);
purchasingRouter.get('/goods-receipts', requirePermission(read), purchasingController.listGoodsReceipts);
purchasingRouter.get('/goods-receipts/:id', requirePermission(read), validate(vendorIdParamSchema, 'params'), purchasingController.getGoodsReceipt);
