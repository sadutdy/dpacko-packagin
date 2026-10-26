import type { RequestHandler } from 'express';

import { asyncHandler } from '../../core/http/asyncHandler.js';
import { ok } from '../../core/http/apiResponse.js';
import { companyService } from './company.service.js';

export const companyController: {
  get: RequestHandler;
  update: RequestHandler;
} = {
  get: asyncHandler(async (_req, res) => ok(res, await companyService.get())),

  update: asyncHandler(async (req, res) =>
    ok(res, await companyService.update(req.valid?.body as Record<string, unknown>))),
};
