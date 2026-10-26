import { Router } from 'express';
import { Permission } from '@ameen/domain';

import { validate } from '../../core/validation/index.js';
import { authenticate } from '../../core/middleware/auth.js';
import { requirePermission } from '../../core/middleware/rbac.js';
import { objectIdSchema } from '../auth/auth.schema.js';
import { catalogController } from './catalog.controller.js';
import {
  createSkuSchema,
  listSkusSchema,
  replaceBomSchema,
  updateSkuSchema,
} from './catalog.schema.js';

export const catalogRouter: Router = Router();

catalogRouter.use(authenticate);

catalogRouter.get('/skus', requirePermission(Permission.CatalogRead), validate(listSkusSchema, 'query'), catalogController.list);
catalogRouter.get('/skus/:id', requirePermission(Permission.CatalogRead), validate(objectIdSchema, 'params'), catalogController.get);
catalogRouter.get('/categories', requirePermission(Permission.CatalogRead), catalogController.categories);
catalogRouter.get('/templates', requirePermission(Permission.CatalogRead), catalogController.templates);
catalogRouter.get('/bom/:skuId', requirePermission(Permission.CatalogRead), validate(objectIdSchema, 'params'), catalogController.bom);

catalogRouter.post('/skus', requirePermission(Permission.CatalogWrite), validate(createSkuSchema), catalogController.create);
catalogRouter.patch('/skus/:id', requirePermission(Permission.CatalogWrite), validate(objectIdSchema, 'params'), validate(updateSkuSchema), catalogController.update);
catalogRouter.delete('/skus/:id', requirePermission(Permission.CatalogWrite), validate(objectIdSchema, 'params'), catalogController.remove);
catalogRouter.put('/bom/:skuId', requirePermission(Permission.CatalogWrite), validate(objectIdSchema, 'params'), validate(replaceBomSchema), catalogController.replaceBom);
