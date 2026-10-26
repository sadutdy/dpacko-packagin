import { Router } from 'express';
import { Permission } from '@ameen/domain';

import { validate } from '../../core/validation/index.js';
import { authenticate } from '../../core/middleware/auth.js';
import { requirePermission } from '../../core/middleware/rbac.js';
import { companyController } from './company.controller.js';
import { updateCompanySchema } from './company.schema.js';

export const companyRouter: Router = Router();

companyRouter.use(authenticate);

companyRouter.get('/', requirePermission(Permission.SettingsRead), companyController.get);
companyRouter.put('/', requirePermission(Permission.SettingsWrite), validate(updateCompanySchema), companyController.update);
