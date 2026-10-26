import { assertStageTransition, isProductionStage, isRole, type ProductionStage, type Role } from '@ameen/domain';

import { AppError } from '../../core/errors/AppError.js';
import { buildPageMeta, parsePagination } from '../../core/http/pagination.js';
import { nextCounter } from '../counters/counter.model.js';
import { inventoryService } from '../inventory/inventory.service.js';
import { productionRepository, type ProductionJobDoc } from './production.repository.js';

function toObject(doc: ProductionJobDoc) {
  return doc.toObject({ versionKey: false });
}

interface JobTransitionResult {
  jobId: string;
  from: string;
  to: string;
  accepted: boolean;
  error?: string;
}

function resolveRole(actorRole: string): Role {
  if (isRole(actorRole)) return actorRole;
  throw AppError.forbidden('Unknown role for a production transition');
}

export const productionService = {
  async listJobs(query: Record<string, unknown>) {
    const params = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.stage) filter.stage = query.stage;
    if (query.orderId) filter.orderId = query.orderId;
    if (query.machineId) filter.machineId = query.machineId;
    if (query.scheduledDate && query.scheduledDate instanceof Date) {
      const from = new Date(query.scheduledDate);
      from.setUTCHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setUTCDate(to.getUTCDate() + 1);
      filter.scheduledDate = { $gte: from, $lt: to };
    }
    const [jobs, total] = await Promise.all([
      productionRepository.listJobs(filter, params.skip, params.limit, params.sort as string | undefined),
      productionRepository.countJobs(filter),
    ]);
    return { jobs: jobs.map(toObject), meta: buildPageMeta(total, params) };
  },

  async getJob(id: string) {
    const job = await productionRepository.findJobById(id);
    if (!job) throw AppError.notFound('Job not found');
    return toObject(job);
  },

  async createJob(
    input: {
      orderId: string;
      orderNumber?: string;
      items: { skuId: string; skuCode?: string; quantity: number }[];
      priority?: number;
      scheduledDate?: Date;
      machineId?: string;
      operatorId?: string;
      offline?: boolean;
    },
    actorId: string,
  ) {
    const isoPeriod = '25-26';
    const jobNumber = `JOB-${isoPeriod.replace('-', '')}-${String(await nextCounter('job', isoPeriod)).padStart(5, '0')}`;
    const job = await productionRepository.createJob({
      jobNumber,
      orderId: input.orderId,
      orderNumber: input.orderNumber ?? '',
      items: input.items.map((item) => ({
        skuId: item.skuId,
        skuCode: item.skuCode ?? '',
        quantity: item.quantity,
        completedQty: 0,
        wastedQty: 0,
      })),
      stage: 'queued',
      stageHistory: [{ stage: 'queued', at: new Date(), by: actorId, deviceId: '', offline: input.offline ?? false }],
      priority: input.priority ?? 100,
      scheduledDate: input.scheduledDate ?? null,
      machineId: input.machineId ?? null,
      operatorId: input.operatorId ?? null,
      materialReservations: [],
      quantityCompleted: 0,
      quantityScrapped: 0,
    });
    return toObject(job);
  },

  async transition(
    id: string,
    input: { to: string; note?: string; deviceId?: string; offline?: boolean; occurredAt?: Date },
    actorId: string,
    actorRole: string,
  ) {
    if (!isProductionStage(input.to)) throw AppError.validation('Unknown stage');
    const job = await productionRepository.findJobById(id);
    if (!job) throw AppError.notFound('Job not found');
    const role = resolveRole(actorRole);
    const from = job.stage as ProductionStage;

    // Domain owns the rule; a violation surfaces as a DomainError and the
    // global error handler maps it onto a 409 problem+json envelope.
    assertStageTransition(from, input.to as ProductionStage, role);

    const at = input.occurredAt instanceof Date ? input.occurredAt : new Date();
    const update: Record<string, unknown> = {
      $push: {
        stageHistory: {
          stage: input.to,
          at,
          by: actorId,
          deviceId: input.deviceId ?? '',
          offline: input.offline ?? false,
        },
      },
      $set: { stage: input.to },
    };
    if (input.to === 'ready') {
      update.$set = {
        ...((update.$set as Record<string, unknown>) ?? {}),
        quantityCompleted: job.items.reduce((sum, item) => sum + item.quantity, 0),
      };
    }
    const updated = await productionRepository.updateJob(id, update);
    if (!updated) throw AppError.notFound('Job not found');
    return toObject(updated);
  },

  async recordQc(
    id: string,
    input: { result: 'pass' | 'fail' | 'reject'; checklist: unknown[]; notes?: string },
    actorId: string,
  ) {
    const job = await productionRepository.findJobById(id);
    if (!job) throw AppError.notFound('Job not found');
    if (job.stage !== 'qc') throw AppError.conflict('QC results can only be recorded while the job is at the qc stage');
    const update: Record<string, unknown> = {
      $set: {
        'qc.checklist': input.checklist,
        'qc.result': input.result,
        'qc.checkedBy': actorId,
        'qc.checkedAt': new Date(),
        'qc.notes': input.notes ?? '',
      },
    };
    if (input.result === 'fail') update.$inc = { 'qc.reworkCount': 1 };
    const updated = await productionRepository.updateJob(id, update);
    if (!updated) throw AppError.notFound('Job not found');
    return toObject(updated);
  },

  async reserveMaterials(
    id: string,
    input: { location: string; materials: { materialId: string; quantity: number }[] },
    actorId: string,
  ) {
    const job = await productionRepository.findJobById(id);
    if (!job) throw AppError.notFound('Job not found');
    const reserved: { materialId: string; quantity: number }[] = [];
    try {
      for (const line of input.materials) {
        await inventoryService.reserve(
          {
            materialId: line.materialId,
            quantity: line.quantity,
            location: input.location,
            referenceType: 'production_job',
            referenceId: id,
            note: `Job ${job.jobNumber}`,
          },
          actorId,
        );
        reserved.push({ materialId: line.materialId, quantity: line.quantity });
      }
    } catch (error) {
      for (const line of reserved) {
        await inventoryService.release(
          {
            materialId: line.materialId,
            quantity: line.quantity,
            location: input.location,
            referenceType: 'production_job',
            referenceId: id,
            note: 'Rollback after reservation failure',
          },
          actorId,
        );
      }
      throw error;
    }
    const updated = await productionRepository.updateJob(id, {
      materialReservations: reserved.map((line) => ({
        materialId: line.materialId,
        quantity: line.quantity,
        consumedQty: 0,
      })),
    });
    if (!updated) throw AppError.notFound('Job not found');
    return toObject(updated);
  },

  async consumeMaterials(id: string, location: string, actorId: string) {
    const job = await productionRepository.findJobById(id);
    if (!job) throw AppError.notFound('Job not found');
    for (const line of job.materialReservations) {
      const remaining = line.quantity - line.consumedQty;
      if (remaining <= 0) continue;
      await inventoryService.consume(
        {
          materialId: String(line.materialId),
          quantity: remaining,
          location,
          referenceType: 'production_job',
          referenceId: id,
          note: `Job ${job.jobNumber}`,
        },
        actorId,
      );
    }
    const updated = await productionRepository.updateJob(id, {
      $set: {
        materialReservations: job.materialReservations.map((line) => ({
          ...line.toObject(),
          consumedQty: line.quantity,
        })),
      },
    });
    if (!updated) throw AppError.notFound('Job not found');
    return toObject(updated);
  },

  async stageCounts() {
    const rows = await productionRepository.stageCounts();
    const counts = new Map(rows.map((row) => [row.stage, row.count]));
    const stages = [
      'queued',
      'received',
      'cutting',
      'creasing',
      'assembly',
      'printing',
      'qc',
      'rework',
      'labelling',
      'packing',
      'ready',
      'scrapped',
      'cancelled',
    ];
    return stages.map((stage) => ({ stage, count: counts.get(stage) ?? 0 }));
  },

  /** Batched offline wall-board sync. Invalid events are reported, not fatal. */
  async sync(input: { events: { jobId: string; to: string; at: Date; deviceId?: string }[] }, actorId: string, actorRole: string) {
    const results: JobTransitionResult[] = [];
    for (const event of input.events) {
      try {
        const job = await productionRepository.findJobById(event.jobId);
        if (!job) {
          results.push({ jobId: event.jobId, from: '?', to: event.to, accepted: false, error: 'Job not found' });
          continue;
        }
        if (!isProductionStage(event.to)) {
          results.push({ jobId: event.jobId, from: job.stage, to: event.to, accepted: false, error: 'Unknown stage' });
          continue;
        }
        const from = job.stage as ProductionStage;
        const role = resolveRole(actorRole);
        assertStageTransition(from, event.to as ProductionStage, role);
        await productionRepository.updateJob(event.jobId, {
          $push: {
            stageHistory: {
              stage: event.to,
              at: event.at,
              by: actorId,
              deviceId: event.deviceId ?? '',
              offline: true,
            },
          },
          $set: { stage: event.to, offlineCompleted: true },
        });
        results.push({ jobId: event.jobId, from, to: event.to, accepted: true });
      } catch (error) {
        results.push({
          jobId: event.jobId,
          from: '?',
          to: event.to,
          accepted: false,
          error: error instanceof Error ? error.message : 'Unknown failure',
        });
      }
    }
    return { results };
  },

  async listMachines() {
    const machines = await productionRepository.listMachines();
    return machines.map((machine) => machine.toObject({ versionKey: false }));
  },

  async createMachine(input: Record<string, unknown>) {
    const existing = await productionRepository.findMachineByCode(String(input.code));
    if (existing) throw AppError.conflict('A machine with this code already exists');
    return productionRepository.createMachine(input).then((doc) => doc.toObject({ versionKey: false }));
  },

  async updateMachine(id: string, input: Record<string, unknown>) {
    const machine = await productionRepository.updateMachine(id, input);
    if (!machine) throw AppError.notFound('Machine not found');
    return machine.toObject({ versionKey: false });
  },

  async listChecklists() {
    const checklists = await productionRepository.listChecklists();
    return checklists.map((checklist) => checklist.toObject({ versionKey: false }));
  },

  async createChecklist(input: Record<string, unknown>) {
    return productionRepository.createChecklist(input).then((doc) => doc.toObject({ versionKey: false }));
  },

  async updateChecklist(id: string, input: Record<string, unknown>) {
    const checklist = await productionRepository.updateChecklist(id, input);
    if (!checklist) throw AppError.notFound('Checklist not found');
    return checklist.toObject({ versionKey: false });
  },

  async listShifts() {
    const shifts = await productionRepository.listShifts();
    return shifts.map((shift) => shift.toObject({ versionKey: false }));
  },

  async createShift(input: Record<string, unknown>) {
    return productionRepository.createShift(input).then((doc) => doc.toObject({ versionKey: false }));
  },
};
