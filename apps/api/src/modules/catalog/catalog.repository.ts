import { type Types } from 'mongoose';
import type { FilterQuery, HydratedDocument } from 'mongoose';

import { BomTemplate, CatalogSku } from './catalog.model.js';

export interface SkuDimensionsShape {
  length: number;
  width: number;
  height: number;
  unit: string;
}

export interface SkuPrintShape {
  type: string;
  sides: number;
  colors: number;
}

export interface SkuPricingShape {
  basePricePaise: number;
  minQty: number;
  taxRate: number;
  hsnCode: string;
}

export type SkuDoc = HydratedDocument<
  {
    skuCode: string;
    name: string;
    nameTa: string;
    category: string;
    material: string;
    dimensions: SkuDimensionsShape;
    flute?: string | null;
    gsm?: number | null;
    print: SkuPrintShape;
    pricing: SkuPricingShape;
    leadTimeDays: number;
    tags: string[];
    isActive: boolean;
  },
  { createdAt: Date; updatedAt: Date }
>;

export type BomDoc = HydratedDocument<
  {
    skuId: Types.ObjectId;
    materialId: Types.ObjectId;
    quantityPerUnit: number;
    unit: string;
    wastagePct: number;
    isPrimary: boolean;
  },
  { createdAt: Date; updatedAt: Date }
>;

export const catalogRepository = {
  listSkus(filter: FilterQuery<unknown>, skip: number, limit: number, sort?: string) {
    const query = CatalogSku.find(filter).skip(skip).limit(limit);
    if (sort) query.sort(sort);
    else query.sort({ createdAt: -1 });
    return query.exec() as Promise<SkuDoc[]>;
  },

  countSkus(filter: FilterQuery<unknown>) {
    return CatalogSku.countDocuments(filter).exec();
  },

  findSkuById(id: string) {
    return CatalogSku.findById(id).exec() as Promise<SkuDoc | null>;
  },

  findSkuByCode(code: string) {
    return CatalogSku.findOne({ skuCode: code }).exec() as Promise<SkuDoc | null>;
  },

  createSku(input: Record<string, unknown>) {
    return CatalogSku.create(input) as Promise<SkuDoc>;
  },

  updateSku(id: string, input: Record<string, unknown>) {
    return CatalogSku.findByIdAndUpdate(id, input, { new: true }).exec() as Promise<SkuDoc | null>;
  },

  deleteSku(id: string) {
    return CatalogSku.findByIdAndUpdate(id, { isActive: false }, { new: true }).exec() as Promise<SkuDoc | null>;
  },

  categories() {
    return CatalogSku.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $project: { _id: 0, category: '$_id', count: 1 } },
    ]).exec();
  },

  bom(skuId: string) {
    return BomTemplate.find({ skuId }).sort({ isPrimary: -1 }).exec() as Promise<BomDoc[]>;
  },

  async replaceBom(skuId: string, lines: Record<string, unknown>[]) {
    await BomTemplate.deleteMany({ skuId }).exec();
    if (lines.length === 0) return [] as BomDoc[];
    return BomTemplate.insertMany(
      lines.map((line) => ({ ...line, skuId })),
    ) as unknown as Promise<BomDoc[]>;
  },
};
