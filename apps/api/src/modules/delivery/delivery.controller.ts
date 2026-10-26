import type { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '../../core/http/asyncHandler.js';
import { created, ok, paginated } from '../../core/http/apiResponse.js';
import { deliveryService } from './delivery.service.js';

export const deliveryController: {
  listDrivers: RequestHandler;
  createDriver: RequestHandler;
  driverLocation: RequestHandler;
  listVehicles: RequestHandler;
  createVehicle: RequestHandler;
  listDeliveries: RequestHandler;
  myDeliveries: RequestHandler;
  getDelivery: RequestHandler;
  assign: RequestHandler;
  pickup: RequestHandler;
  markInTransit: RequestHandler;
  track: RequestHandler;
  deliver: RequestHandler;
  fail: RequestHandler;
  reschedule: RequestHandler;
  statusCounts: RequestHandler;
  createRoute: RequestHandler;
  listRoutes: RequestHandler;
} = {
  listDrivers: asyncHandler(async (_req: Request, res: Response) => ok(res, await deliveryService.listDrivers())),
  createDriver: asyncHandler(async (req: Request, res: Response) =>
    created(res, await deliveryService.createDriver(req.valid?.body as Record<string, unknown>))),
  driverLocation: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await deliveryService.updateDriverLocation(id, req.valid?.body as never));
  }),
  listVehicles: asyncHandler(async (_req: Request, res: Response) => ok(res, await deliveryService.listVehicles())),
  createVehicle: asyncHandler(async (req: Request, res: Response) =>
    created(res, await deliveryService.createVehicle(req.valid?.body as Record<string, unknown>))),
  listDeliveries: asyncHandler(async (req: Request, res: Response) => {
    const result = await deliveryService.listDeliveries(req.valid?.query as Record<string, unknown>);
    return paginated(res, result.deliveries, result.meta);
  }),
  myDeliveries: asyncHandler(async (req: Request, res: Response) => {
    const result = await deliveryService.myDeliveries(req.user!.id, req.valid?.query as Record<string, unknown>);
    return paginated(res, result.deliveries, result.meta);
  }),
  getDelivery: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await deliveryService.getDelivery(id));
  }),
  assign: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await deliveryService.assign(id, req.valid?.body as never));
  }),
  pickup: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await deliveryService.pickup(id, req.user!.id));
  }),
  markInTransit: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await deliveryService.markInTransit(id));
  }),
  track: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await deliveryService.track(id, req.valid?.body as never));
  }),
  deliver: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await deliveryService.deliver(id, req.valid?.body as never));
  }),
  fail: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await deliveryService.fail(id, req.valid?.body as never));
  }),
  reschedule: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.valid?.params as { id: string };
    return ok(res, await deliveryService.reschedule(id, req.valid?.body as never));
  }),
  statusCounts: asyncHandler(async (_req: Request, res: Response) => ok(res, await deliveryService.statusCounts())),
  createRoute: asyncHandler(async (req: Request, res: Response) =>
    created(res, await deliveryService.createRoute(req.valid?.body as never))),
  listRoutes: asyncHandler(async (req: Request, res: Response) => {
    const result = await deliveryService.listRoutes(req.valid?.query as Record<string, unknown>);
    return paginated(res, result.routes, result.meta);
  }),
};
