import { Router } from 'express';
import { Permission } from '@ameen/domain';

import { validate } from '../../core/validation/index.js';
import { authenticate } from '../../core/middleware/auth.js';
import { requirePermission } from '../../core/middleware/rbac.js';
import { productionController } from './production.controller.js';
import {
  createJobSchema,
  idParamSchema,
  listJobsSchema,
  machineSchema,
  qcChecklistSchema,
  qcResultSchema,
  reserveMaterialsSchema,
  shiftSchema,
  syncEventsSchema,
  transitionSchema,
  updateMachineSchema,
} from './production.schema.js';

export const productionRouter: Router = Router();

productionRouter.use(authenticate);

const read = Permission.ProductionRead;
const write = Permission.ProductionWrite;

productionRouter.get('/jobs', requirePermission(read), validate(listJobsSchema, 'query'), productionController.listJobs);
productionRouter.get('/jobs/counts', requirePermission(read), productionController.stageCounts);
productionRouter.post('/jobs', requirePermission(write), validate(createJobSchema), productionController.createJob);
productionRouter.get('/jobs/:id', requirePermission(read), validate(idParamSchema, 'params'), productionController.getJob);
productionRouter.post('/jobs/:id/transition', requirePermission(write), validate(idParamSchema, 'params'), validate(transitionSchema), productionController.transition);
productionRouter.post('/jobs/:id/qc', requirePermission(write), validate(idParamSchema, 'params'), validate(qcResultSchema), productionController.recordQc);
productionRouter.post('/jobs/:id/reserve-materials', requirePermission(write), validate(idParamSchema, 'params'), validate(reserveMaterialsSchema), productionController.reserveMaterials);
productionRouter.post('/jobs/:id/consume-materials', requirePermission(write), validate(idParamSchema, 'params'), validate(reserveMaterialsSchema), productionController.consumeMaterials);
productionRouter.post('/sync', requirePermission(write), validate(syncEventsSchema), productionController.sync);

productionRouter.get('/machines', requirePermission(read), productionController.listMachines);
productionRouter.post('/machines', requirePermission(write), validate(machineSchema), productionController.createMachine);
productionRouter.patch('/machines/:id', requirePermission(write), validate(updateMachineSchema), productionController.updateMachine);
productionRouter.get('/qc-checklists', requirePermission(read), productionController.listChecklists);
productionRouter.post('/qc-checklists', requirePermission(write), validate(qcChecklistSchema), productionController.createChecklist);
productionRouter.get('/shifts', requirePermission(read), productionController.listShifts);
productionRouter.post('/shifts', requirePermission(write), validate(shiftSchema), productionController.createShift);
