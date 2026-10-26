import { Router } from 'express';
import { Permission } from '@ameen/domain';

import { validate } from '../../core/validation/index.js';
import { authenticate } from '../../core/middleware/auth.js';
import { requirePermission } from '../../core/middleware/rbac.js';
import { crmController } from './crm.controller.js';
import {
  addressSchema,
  createCustomerSchema,
  creditSchema,
  idParamSchema,
  listCustomersSchema,
  updateCustomerSchema,
} from './crm.schema.js';

export const crmRouter: Router = Router();

crmRouter.use(authenticate);

crmRouter.get(
  '/customers',
  requirePermission(Permission.CrmRead),
  validate(listCustomersSchema, 'query'),
  crmController.list,
);
crmRouter.post(
  '/customers',
  requirePermission(Permission.CrmWrite),
  validate(createCustomerSchema),
  crmController.create,
);
crmRouter.get('/customers/:id', requirePermission(Permission.CrmRead), validate(idParamSchema, 'params'), crmController.get);
crmRouter.patch(
  '/customers/:id',
  requirePermission(Permission.CrmWrite),
  validate(idParamSchema, 'params'),
  validate(updateCustomerSchema),
  crmController.update,
);
crmRouter.get('/customers/:id/orders', requirePermission(Permission.CrmRead), validate(idParamSchema, 'params'), crmController.orders);
crmRouter.get('/customers/:id/credit', requirePermission(Permission.CrmRead), validate(idParamSchema, 'params'), crmController.credit);
crmRouter.post('/customers/:id/credit', requirePermission(Permission.CrmWrite), validate(idParamSchema, 'params'), validate(creditSchema), crmController.adjustCredit);
crmRouter.get('/customers/:id/addresses', requirePermission(Permission.CrmRead), validate(idParamSchema, 'params'), crmController.addresses);
crmRouter.post('/customers/:id/addresses', requirePermission(Permission.CrmWrite), validate(idParamSchema, 'params'), validate(addressSchema), crmController.addAddress);
crmRouter.put('/addresses/:addressId', requirePermission(Permission.CrmWrite), validate(idParamSchema, 'params'), validate(addressSchema.partial()), crmController.updateAddress);
crmRouter.delete('/addresses/:addressId', requirePermission(Permission.CrmWrite), validate(idParamSchema, 'params'), crmController.removeAddress);
crmRouter.delete(
  '/customers/:id',
  requirePermission(Permission.CrmWrite),
  validate(idParamSchema, 'params'),
  crmController.remove,
);
crmRouter.get('/segments', requirePermission(Permission.CrmRead), crmController.segments);
crmRouter.get('/suggestions', requirePermission(Permission.CrmRead), crmController.suggestions);
