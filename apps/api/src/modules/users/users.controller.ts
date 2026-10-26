import type { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '../../core/http/asyncHandler.js';
import { created, ok, paginated } from '../../core/http/apiResponse.js';
import { usersService } from './users.service.js';

export const usersController: {
  list: RequestHandler;
  get: RequestHandler;
  invite: RequestHandler;
  update: RequestHandler;
  roles: RequestHandler;
} = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await usersService.list(req.valid?.query as never);
    return paginated(res, result.users, result.meta);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    const user = await usersService.getById(id);
    return ok(res, user);
  }),

  invite: asyncHandler(async (req: Request, res: Response) => {
    const result = await usersService.invite(req.valid?.body as never);
    return created(res, result);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    const user = await usersService.update(id, req.valid?.body as never);
    return ok(res, user);
  }),

  roles: asyncHandler(async (_req: Request, res: Response) => {
    return ok(res, usersService.roles());
  }),
};
