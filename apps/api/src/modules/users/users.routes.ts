import { Router } from 'express';

import { Permission } from '@ameen/domain';

import { validate } from '../../core/validation/index.js';
import { authenticate } from '../../core/middleware/auth.js';
import { requirePermission } from '../../core/middleware/rbac.js';
import { idParamSchema } from '../auth/auth.schema.js';
import { inviteUserSchema, listUsersSchema, updateUserSchema } from './users.schema.js';
import { usersController } from './users.controller.js';

export const usersRouter: Router = Router();

usersRouter.use(authenticate, requirePermission(Permission.UsersRead));

usersRouter.get('/', validate(listUsersSchema, 'query'), usersController.list);
usersRouter.post('/', validate(inviteUserSchema), usersController.invite);
usersRouter.get('/roles', usersController.roles);
usersRouter.get('/:id', validate(idParamSchema, 'params'), usersController.get);
usersRouter.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateUserSchema),
  usersController.update,
);
