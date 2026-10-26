import { type Types } from 'mongoose';
import type { FilterQuery, HydratedDocument } from 'mongoose';

import { InventoryMovement, InventoryStock, Material } from './inventory.model.js';

export type MaterialDoc = HydratedDocument<
  {
    materialCode: string;
    name: string;
    nameTa: string;
    category: string;
    unit: string;
    packSize: number;
    unitCostPaise: number;
    taxRate: number;
    hsnCode: string;
    reorderPoint: number;
    reorderQuantity: number;
    leadTimeDays: number;
    vendorId?: Types.ObjectId | null;
    storageLocation: string;
    isActive: boolean;
    minQtyAlertAck?: { by: Types.ObjectId | null; at: Date | null; note: string } | null;
  },
  { createdAt: Date; updatedAt: Date }
>;

export type StockDoc = HydratedDocument<
  {
    materialId: Types.ObjectId;
    location: string;
    onHand: number;
    reserved: number;
    available: number;
    averageCostPaise: number;
    lastMovementAt?: Date | null;
  },
  { createdAt: Date; updatedAt: Date }
>;

export interface StockChange {
  onHand: number;
  reserved: number;
}

export interface StockGuard {
  onHand?: number;
  reserved?: number;
  available?: number;
}

export const materialRepository = {
  list(filter: FilterQuery<unknown>, skip: number, limit: number, sort?: string) {
    const query = Material.find(filter).skip(skip).limit(limit);
    if (sort) query.sort(sort);
    else query.sort({ createdAt: -1 });
    return query.exec() as Promise<MaterialDoc[]>;
  },
  count(filter: FilterQuery<unknown>) {
    return Material.countDocuments(filter).exec();
  },
  findById(id: string) {
    return Material.findById(id).exec() as Promise<MaterialDoc | null>;
  },
  findByCode(code: string) {
    return Material.findOne({ materialCode: code }).exec() as Promise<MaterialDoc | null>;
  },
  create(input: Record<string, unknown>) {
    return Material.create(input) as Promise<MaterialDoc>;
  },
  update(id: string, input: Record<string, unknown>) {
    return Material.findByIdAndUpdate(id, input, { new: true }).exec() as Promise<MaterialDoc | null>;
  },
};

export const stockRepository = {
  list(filter: FilterQuery<unknown>) {
    return InventoryStock.find(filter).sort({ location: 1 }).exec() as Promise<StockDoc[]>;
  },

  /** Ensures a zeroed stock row exists for (materialId, location). */
  async ensure(materialId: string, location: string): Promise<StockDoc> {
    const doc = await InventoryStock.findOneAndUpdate(
      { materialId, location },
      { $setOnInsert: { onHand: 0, reserved: 0, available: 0, averageCostPaise: 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();
    return doc as StockDoc;
  },

  /**
   * Atomic signed change on (onHand, reserved); `available` is kept in sync via
   * the invariant available = onHand - reserved. When a guard is given the
   * update only matches rows satisfying it, so concurrent oversell attempts
   * return null instead of corrupting the balance.
   */
  async change(
    materialId: string,
    location: string,
    delta: StockChange,
    guard?: StockGuard,
  ): Promise<StockDoc | null> {
    const filter: Record<string, unknown> = { materialId, location };
    if (guard?.onHand !== undefined) filter.onHand = { $gte: guard.onHand };
    if (guard?.reserved !== undefined) filter.reserved = { $gte: guard.reserved };
    if (guard?.available !== undefined) filter.available = { $gte: guard.available };
    const doc = await InventoryStock.findOneAndUpdate(
      filter,
      {
        $inc: {
          onHand: delta.onHand,
          reserved: delta.reserved,
          available: delta.onHand - delta.reserved,
        },
        $set: { lastMovementAt: new Date() },
      },
      { new: true, upsert: !guard, setDefaultsOnInsert: true },
    ).exec();
    return doc as StockDoc | null;
  },
};

export type MovementDoc = HydratedDocument<
  {
    materialId: Types.ObjectId;
    type: string;
    quantity: number;
    unitCostPaise: number;
    balanceAfter: number;
    referenceType: string;
    referenceId?: Types.ObjectId | null;
    location: string;
    note: string;
    performedBy?: Types.ObjectId | null;
  },
  { createdAt: Date; updatedAt: Date }
>;

export const movementRepository = {
  create(input: Record<string, unknown>) {
    return InventoryMovement.create(input) as Promise<MovementDoc>;
  },
  list(filter: FilterQuery<unknown>, skip: number, limit: number, sort?: string) {
    const query = InventoryMovement.find(filter).skip(skip).limit(limit);
    if (sort) query.sort(sort);
    else query.sort({ occurredAt: -1 });
    return query.exec() as Promise<MovementDoc[]>;
  },
  count(filter: FilterQuery<unknown>) {
    return InventoryMovement.countDocuments(filter).exec();
  },
  wastageByMaterial() {
    return InventoryMovement.aggregate([
      { $match: { type: 'wastage' } },
      { $group: { _id: '$materialId', totalQty: { $sum: '$quantity' }, count: { $sum: 1 } } },
    ]).exec();
  },
};
