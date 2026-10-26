import { Router } from 'express';
import { Permission } from '@ameen/domain';

import { validate } from '../../core/validation/index.js';
import { authenticate } from '../../core/middleware/auth.js';
import { requirePermission } from '../../core/middleware/rbac.js';
import { objectIdSchema } from '../auth/auth.schema.js';
import { inventoryController } from './inventory.controller.js';
import {
  adjustmentSchema,
  listMaterialsSchema,
  materialSchema,
  movementQuerySchema,
  receiveSchema,
  releaseSchema,
  reserveSchema,
  stockQuerySchema,
  updateMaterialSchema,
  wastageSchema,
} from './inventory.schema.js';

export const inventoryRouter: Router = Router();

inventoryRouter.use(authenticate);

const inv = Permission.InventoryRead;
const invWrite = Permission.InventoryWrite;

inventoryRouter.get('/materials', requirePermission(inv), validate(listMaterialsSchema, 'query'), inventoryController.listMaterials);
inventoryRouter.post('/materials', requirePermission(invWrite), validate(materialSchema), inventoryController.createMaterial);
inventoryRouter.get('/materials/:id', requirePermission(inv), validate(objectIdSchema, 'params'), inventoryController.getMaterial);
inventoryRouter.patch('/materials/:id', requirePermission(invWrite), validate(objectIdSchema, 'params'), validate(updateMaterialSchema), inventoryController.updateMaterial);
inventoryRouter.get('/stock', requirePermission(inv), validate(stockQuerySchema, 'query'), inventoryController.listStock);
inventoryRouter.get('/stock/low', requirePermission(inv), inventoryController.lowStock);
inventoryRouter.get('/movements', requirePermission(inv), validate(movementQuerySchema, 'query'), inventoryController.listMovements);
inventoryRouter.post('/adjustments', requirePermission(invWrite), validate(adjustmentSchema), inventoryController.adjust);
inventoryRouter.post('/receive', requirePermission(invWrite), validate(receiveSchema), inventoryController.receive);
inventoryRouter.post('/reserve', requirePermission(invWrite), validate(reserveSchema), inventoryController.reserve);
inventoryRouter.post('/release', requirePermission(invWrite), validate(releaseSchema), inventoryController.release);
inventoryRouter.post('/consume', requirePermission(invWrite), validate(reserveSchema), inventoryController.consume);
inventoryRouter.get('/wastage', requirePermission(inv), inventoryController.wastageReport);
inventoryRouter.post('/wastage', requirePermission(invWrite), validate(wastageSchema), inventoryController.wastage);
inventoryRouter.get('/valuation', requirePermission(Permission.ReportsRead), inventoryController.valuation);
