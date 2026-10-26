import type { Request, RequestHandler, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../../core/http/asyncHandler.js';
import { ok } from '../../core/http/apiResponse.js';
import { validate } from '../../core/validation/index.js';
import { Permission } from '@ameen/domain';
import { authenticate } from '../../core/middleware/auth.js';
import { requirePermission } from '../../core/middleware/rbac.js';
import { reportsService } from './reports.service.js';

const rangeQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const reportsController: {
  dashboard: RequestHandler;
  production: RequestHandler;
  sales: RequestHandler;
  receivables: RequestHandler;
} = {
  dashboard: asyncHandler(async (_req: Request, res: Response) => ok(res, await reportsService.dashboard())),
  production: asyncHandler(async (req: Request, res: Response) => ok(res, await reportsService.productionReport(req.valid?.query as never))),
  sales: asyncHandler(async (req: Request, res: Response) => ok(res, await reportsService.salesReport(req.valid?.query as never))),
  receivables: asyncHandler(async (req: Request, res: Response) => ok(res, await reportsService.receivablesReport())),
};

export const reportsRouter: Router = Router();

reportsRouter.use(authenticate);
reportsRouter.get('/dashboard', requirePermission(Permission.ReportsRead), reportsController.dashboard);
reportsRouter.get('/production', requirePermission(Permission.ReportsRead), validate(rangeQuerySchema, 'query'), reportsController.production);
reportsRouter.get('/sales', requirePermission(Permission.ReportsRead), validate(rangeQuerySchema, 'query'), reportsController.sales);
reportsRouter.get('/receivables', requirePermission(Permission.ReportsRead), reportsController.receivables);
