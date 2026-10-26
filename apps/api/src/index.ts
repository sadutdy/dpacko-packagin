import { Router } from 'express';

import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { companyRouter } from './modules/company/company.routes.js';
import { crmRouter } from './modules/crm/crm.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { purchasingRouter } from './modules/purchasing/purchasing.routes.js';
import { productionRouter } from './modules/production/production.routes.js';
import { deliveryRouter } from './modules/delivery/delivery.routes.js';
import { ordersRouter } from './modules/orders/orders.routes.js';
import { paymentsRouter } from './modules/payments/payments.routes.js';
import { officeRouter } from './modules/office/office.routes.js';
import { reportsRouter } from './modules/reports/reports.controller.js';

export { healthRouter };
export { createApp } from './app.js';

/** The v1 module registry. New modules are wired in here. */
export function buildV1Router(): Router {
  const router = Router();

  router.use('/auth', authRouter);
  router.use('/company', companyRouter);
  router.use('/users', usersRouter);
  router.use('/crm', crmRouter);
  router.use('/catalog', catalogRouter);
  router.use('/inventory', inventoryRouter);
  router.use('/purchasing', purchasingRouter);
  router.use('/production', productionRouter);
  router.use('/delivery', deliveryRouter);
  router.use('/orders', ordersRouter);
  router.use('/payments', paymentsRouter);
  router.use('/office', officeRouter);
  router.use('/reports', reportsRouter);

  return router;
}
