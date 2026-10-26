import { AppError } from '../../core/errors/AppError.js';
import { ErrorCode } from '../../core/errors/ErrorCode.js';
import { buildPageMeta, parsePagination } from '../../core/http/pagination.js';
import type { StockChange } from './inventory.repository.js';
import { materialRepository, movementRepository, stockRepository, type MaterialDoc, type MovementDoc, type StockDoc } from './inventory.repository.js';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toObject(doc: MaterialDoc | StockDoc | MovementDoc) {
  return doc.toObject({ versionKey: false });
}

function snapshot(stock: StockDoc) {
  return { onHand: stock.onHand, reserved: stock.reserved, available: stock.available };
}

/** Applies a stock change and writes the append-only movement for it. */
async function apply(params: {
  materialId: string;
  location: string;
  delta: StockChange;
  guard?: Parameters<typeof stockRepository.change>[3];
  type: string;
  movementQuantity: number;
  unitCostPaise?: number;
  referenceType?: string;
  referenceId?: string;
  note?: string;
  performedBy?: string;
}) {
  const stock = await stockRepository.change(params.materialId, params.location, params.delta, params.guard);
  if (!stock) throw AppError.conflict('Stock operation rejected: the requested quantity is not available');
  await movementRepository.create({
    materialId: params.materialId,
    type: params.type,
    quantity: params.movementQuantity,
    unitCostPaise: params.unitCostPaise ?? 0,
    balanceAfter: stock.onHand,
    referenceType: params.referenceType ?? 'manual',
    referenceId: params.referenceId ?? null,
    location: params.location,
    note: params.note ?? '',
    performedBy: params.performedBy ?? null,
  });
  // E4: a restock that lifts stock back over the reorder point clears any
  // pending low-stock acknowledgement.
  if (deltaIsRestock(params.delta) && stock.onHand > 0) {
    const material = await materialRepository.findById(params.materialId);
    if (material && stock.onHand > (material.reorderPoint ?? 0)) {
      await materialRepository.update(params.materialId, { minQtyAlertAck: null });
    }
  }
  return snapshot(stock);
}

/** True when the movement adds stock (the "restock" direction). */
function deltaIsRestock(delta: StockChange): boolean {
  return (delta.onHand ?? 0) > 0;
}

export const inventoryService = {
  async listMaterials(query: Record<string, unknown>) {
    const params = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.category) filter.category = query.category;
    if (query.search) {
      const rx = new RegExp(escapeRegex(String(query.search)), 'i');
      filter.$or = [{ name: rx }, { materialCode: rx }];
    }
    const [materials, total] = await Promise.all([
      materialRepository.list(filter, params.skip, params.limit, params.sort as string | undefined),
      materialRepository.count(filter),
    ]);
    return { materials: materials.map(toObject), meta: buildPageMeta(total, params) };
  },

  async createMaterial(input: Record<string, unknown>) {
    const existing = await materialRepository.findByCode(String(input.materialCode));
    if (existing) throw AppError.conflict('A material with this code already exists');
    return toObject(await materialRepository.create(input));
  },

  async getMaterial(id: string) {
    const material = await materialRepository.findById(id);
    if (!material) throw AppError.notFound('Material not found');
    const stock = await stockRepository.list({ materialId: id });
    return { ...toObject(material), stock: stock.map(toObject) };
  },

  async updateMaterial(id: string, input: Record<string, unknown>) {
    const material = await materialRepository.update(id, input);
    if (!material) throw AppError.notFound('Material not found');
    return toObject(material);
  },

  async listStock(query: Record<string, unknown>) {
    const filter: Record<string, unknown> = {};
    if (query.materialId) filter.materialId = query.materialId;
    if (query.location) filter.location = query.location;
    const stock = await stockRepository.list(filter);
    return stock.map((entry) => ({ ...toObject(entry), material: entry.materialId }));
  },

  async lowStock() {
    const materials = await materialRepository.list({}, 0, 1000);
    const stock = await stockRepository.list({});
    const byMaterial = new Map(stock.map((entry) => [String(entry.materialId), entry]));
    return materials
      .map((material) => {
        const entry = byMaterial.get(String(material._id));
        const onHand = entry?.onHand ?? 0;
        const reorderPoint = material.reorderPoint ?? 0;
        return {
          materialId: String(material._id),
          materialCode: material.materialCode,
          name: material.name,
          unit: material.unit,
          onHand,
          available: entry?.available ?? 0,
          reorderPoint,
          reorderQuantity: material.reorderQuantity,
          isLow: onHand <= reorderPoint,
        };
      })
      .filter((row) => row.isLow);
  },

  async listMovements(query: Record<string, unknown>) {
    const params = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.materialId) filter.materialId = query.materialId;
    if (query.type) filter.type = query.type;
    if (query.from || query.to) {
      filter.occurredAt = {};
      if (query.from) (filter.occurredAt as Record<string, unknown>).$gte = query.from;
      if (query.to) (filter.occurredAt as Record<string, unknown>).$lte = query.to;
    }
    const [movements, total] = await Promise.all([
      movementRepository.list(filter, params.skip, params.limit, params.sort as string | undefined),
      movementRepository.count(filter),
    ]);
    return { movements: movements.map((m) => toObject(m)), meta: buildPageMeta(total, params) };
  },

  async adjust(
    input: { materialId: string; quantity: number; location: string; reason: string; unitCostPaise?: number },
    actorId: string,
  ) {
    if (input.quantity === 0) throw AppError.validation('Adjustment quantity must be non-zero');
    return apply({
      materialId: input.materialId,
      location: input.location,
      delta: { onHand: input.quantity, reserved: 0 },
      type: 'adjustment',
      movementQuantity: input.quantity,
      unitCostPaise: input.unitCostPaise,
      note: input.reason,
      performedBy: actorId,
    });
  },

  async receive(
    input: {
      materialId: string;
      quantity: number;
      location: string;
      unitCostPaise: number;
      referenceType?: string;
      referenceId?: string;
      note?: string;
    },
    actorId: string,
  ) {
    const result = await apply({
      materialId: input.materialId,
      location: input.location,
      delta: { onHand: input.quantity, reserved: 0 },
      type: 'receipt',
      movementQuantity: input.quantity,
      unitCostPaise: input.unitCostPaise,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      note: input.note,
      performedBy: actorId,
    });
    // Moving-average cost: blend the receipt cost into the current average.
    const stock = await stockRepository.ensure(input.materialId, input.location);
    const material = await materialRepository.findById(input.materialId);
    if (material) {
      const priorQty = Math.max(0, stock.onHand - input.quantity);
      const priorCost = material.unitCostPaise ?? 0;
      const blended = priorQty + input.quantity > 0
        ? Math.round((priorQty * priorCost + input.quantity * input.unitCostPaise) / (priorQty + input.quantity))
        : input.unitCostPaise;
      await materialRepository.update(input.materialId, { unitCostPaise: blended });
    }
    return result;
  },

  async reserve(
    input: {
      materialId: string;
      quantity: number;
      location: string;
      referenceType?: string;
      referenceId?: string;
      note?: string;
    },
    actorId: string,
  ) {
    const existing = await stockRepository.ensure(input.materialId, input.location);
    if (existing.available < input.quantity) {
      throw new AppError({
        code: ErrorCode.INSUFFICIENT_STOCK,
        message: `Insufficient stock: requested ${input.quantity}, available ${existing.available}`,
        details: { requested: input.quantity, available: existing.available },
      });
    }
    return apply({
      materialId: input.materialId,
      location: input.location,
      delta: { onHand: 0, reserved: input.quantity },
      guard: { available: input.quantity },
      type: 'reservation',
      movementQuantity: input.quantity,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      note: input.note,
      performedBy: actorId,
    });
  },

  async release(
    input: {
      materialId: string;
      quantity: number;
      location: string;
      referenceType?: string;
      referenceId?: string;
      note?: string;
    },
    actorId: string,
  ) {
    const existing = await stockRepository.ensure(input.materialId, input.location);
    if (existing.reserved < input.quantity) {
      throw AppError.validation(`Cannot release more than reserved: requested ${input.quantity}, reserved ${existing.reserved}`);
    }
    return apply({
      materialId: input.materialId,
      location: input.location,
      delta: { onHand: 0, reserved: -input.quantity },
      guard: { reserved: input.quantity },
      type: 'release',
      movementQuantity: -input.quantity,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      note: input.note,
      performedBy: actorId,
    });
  },

  /** Consumes reserved material — physical stock and the reservation both drop. */
  async consume(
    input: {
      materialId: string;
      quantity: number;
      location: string;
      referenceType?: string;
      referenceId?: string;
      note?: string;
    },
    actorId: string,
  ) {
    const existing = await stockRepository.ensure(input.materialId, input.location);
    if (existing.reserved < input.quantity) {
      throw new AppError({
        code: ErrorCode.INSUFFICIENT_STOCK,
        message: `Consumption cannot exceed the reservation: requested ${input.quantity}, reserved ${existing.reserved}`,
        details: { requested: input.quantity, reserved: existing.reserved },
      });
    }
    return apply({
      materialId: input.materialId,
      location: input.location,
      delta: { onHand: -input.quantity, reserved: -input.quantity },
      guard: { reserved: input.quantity },
      type: 'consumption',
      movementQuantity: -input.quantity,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      note: input.note,
      performedBy: actorId,
    });
  },

  async wastage(
    input: {
      materialId: string;
      quantity: number;
      location: string;
      referenceType?: string;
      referenceId?: string;
      note?: string;
    },
    actorId: string,
  ) {
    const existing = await stockRepository.ensure(input.materialId, input.location);
    if (existing.onHand < input.quantity) {
      throw AppError.conflict(`Wastage cannot exceed on-hand stock: requested ${input.quantity}, on hand ${existing.onHand}`);
    }
    return apply({
      materialId: input.materialId,
      location: input.location,
      delta: { onHand: -input.quantity, reserved: 0 },
      guard: { onHand: input.quantity },
      type: 'wastage',
      movementQuantity: -input.quantity,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      note: input.note,
      performedBy: actorId,
    });
  },

  async wastageReport() {
    const rows = await movementRepository.wastageByMaterial();
    return rows.map((row) => ({
      materialId: String(row._id),
      totalQty: row.totalQty,
      count: row.count,
    }));
  },

  async valuation() {
    const stock = await stockRepository.list({});
    const materials = await materialRepository.list({}, 0, 1000);
    const costByMaterial = new Map(materials.map((m) => [String(m._id), m.unitCostPaise]));
    const lines = stock.map((entry) => ({
      materialId: String(entry.materialId),
      location: entry.location,
      onHand: entry.onHand,
      reserved: entry.reserved,
      available: entry.available,
      averageCostPaise: entry.averageCostPaise,
      valuePaise: Math.round(entry.onHand * (costByMaterial.get(String(entry.materialId)) ?? 0)),
    }));
    return {
      lines,
      totalValuePaise: lines.reduce((sum, line) => sum + line.valuePaise, 0),
    };
  },
};
