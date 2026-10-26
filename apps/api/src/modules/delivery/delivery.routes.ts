import { Router } from 'express';
import { Permission } from '@ameen/domain';

import { validate } from '../../core/validation/index.js';
import { authenticate } from '../../core/middleware/auth.js';
import { requirePermission } from '../../core/middleware/rbac.js';
import { objectIdSchema } from '../auth/auth.schema.js';
import { deliveryController } from './delivery.controller.js';
import {
  assignSchema,
  createRouteSchema,
  deliverSchema,
  driverSchema,
  failDeliverySchema,
  listDeliveriesSchema,
  listRoutesSchema,
  rescheduleSchema,
  trackPointSchema,
  updateDriverLocationSchema,
  vehicleSchema,
} from './delivery.schema.js';

export const deliveryRouter: Router = Router();

deliveryRouter.use(authenticate);

const admin = Permission.DeliveryRead;
const write = Permission.DeliveryWrite;
const driver = Permission.DriverRead;
const driverWrite = Permission.DriverWrite;

deliveryRouter.get('/drivers', requirePermission(admin), deliveryController.listDrivers);
deliveryRouter.post('/drivers', requirePermission(write), validate(driverSchema), deliveryController.createDriver);
deliveryRouter.post('/drivers/:id/location', requirePermission(driverWrite), validate(updateDriverLocationSchema), deliveryController.driverLocation);
deliveryRouter.get('/vehicles', requirePermission(admin), deliveryController.listVehicles);
deliveryRouter.post('/vehicles', requirePermission(write), validate(vehicleSchema), deliveryController.createVehicle);

deliveryRouter.get('/deliveries', requirePermission(admin), validate(listDeliveriesSchema, 'query'), deliveryController.listDeliveries);
deliveryRouter.get('/deliveries/counts', requirePermission(admin), deliveryController.statusCounts);
deliveryRouter.get('/deliveries/mine', requirePermission(driver), validate(listDeliveriesSchema, 'query'), deliveryController.myDeliveries);
deliveryRouter.get('/deliveries/:id', requirePermission(admin), validate(objectIdSchema, 'params'), deliveryController.getDelivery);
deliveryRouter.post('/deliveries/:id/assign', requirePermission(write), validate(objectIdSchema, 'params'), validate(assignSchema), deliveryController.assign);
deliveryRouter.post('/deliveries/:id/pickup', requirePermission(driverWrite), validate(objectIdSchema, 'params'), deliveryController.pickup);
deliveryRouter.post('/deliveries/:id/in-transit', requirePermission(driverWrite), validate(objectIdSchema, 'params'), deliveryController.markInTransit);
deliveryRouter.post('/deliveries/:id/track', requirePermission(driverWrite), validate(objectIdSchema, 'params'), validate(trackPointSchema), deliveryController.track);
deliveryRouter.post('/deliveries/:id/deliver', requirePermission(driverWrite), validate(objectIdSchema, 'params'), validate(deliverSchema), deliveryController.deliver);
deliveryRouter.post('/deliveries/:id/fail', requirePermission(driverWrite), validate(objectIdSchema, 'params'), validate(failDeliverySchema), deliveryController.fail);
deliveryRouter.post('/deliveries/:id/reschedule', requirePermission(write), validate(objectIdSchema, 'params'), validate(rescheduleSchema), deliveryController.reschedule);

deliveryRouter.post('/routes', requirePermission(write), validate(createRouteSchema), deliveryController.createRoute);
deliveryRouter.get('/routes', requirePermission(admin), validate(listRoutesSchema, 'query'), deliveryController.listRoutes);
