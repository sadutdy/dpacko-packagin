import { AppError } from '../../core/errors/AppError.js';
import { buildPageMeta, parsePagination } from '../../core/http/pagination.js';
import { catalogRepository, type SkuDoc } from './catalog.repository.js';

function toObject(doc: SkuDoc) {
  return doc.toObject({ versionKey: false });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const catalogService = {
  async listSkus(query: Record<string, unknown>) {
    const params = parsePagination(query);
    const filter: Record<string, unknown> = { isActive: true };
    if (query.category) filter.category = query.category;
    if (query.material) filter.material = query.material;
    if (query.minPrice !== undefined) filter['pricing.basePricePaise'] = { $gte: query.minPrice };
    if (query.maxPrice !== undefined) {
      filter['pricing.basePricePaise'] = {
        ...((filter['pricing.basePricePaise'] as object) ?? {}),
        $lte: query.maxPrice,
      };
    }
    if (query.search) filter.$text = { $search: String(query.search) };

    const [skus, total] = await Promise.all([
      catalogRepository.listSkus(filter, params.skip, params.limit, params.sort as string | undefined),
      catalogRepository.countSkus(filter),
    ]);

    return { skus: skus.map(toObject), meta: buildPageMeta(total, params) };
  },

  async getSku(id: string) {
    const sku = await catalogRepository.findSkuById(id);
    if (!sku) throw AppError.notFound('SKU not found');
    const bom = await catalogRepository.bom(id);
    return { ...toObject(sku), bom: bom.map((line) => line.toObject({ versionKey: false })) };
  },

  async createSku(input: Record<string, unknown>) {
    const existing = await catalogRepository.findSkuByCode(String(input.skuCode));
    if (existing) throw AppError.conflict('A SKU with this code already exists');
    const sku = await catalogRepository.createSku(input);
    return toObject(sku);
  },

  async updateSku(id: string, input: Record<string, unknown>) {
    const sku = await catalogRepository.updateSku(id, input);
    if (!sku) throw AppError.notFound('SKU not found');
    return toObject(sku);
  },

  async deleteSku(id: string) {
    const sku = await catalogRepository.deleteSku(id);
    if (!sku) throw AppError.notFound('SKU not found');
    return { deactivated: true };
  },

  async categories() {
    const rows = await catalogRepository.categories();
    const counts = new Map(rows.map((row) => [row.category, row.count]));
    const all = ['parcel_box', 'cake_box', 'burger_box', 'chicken_basket', 'tray', 'liner'];
    return all.map((category) => ({ category, count: counts.get(category) ?? 0 }));
  },

  async templates() {
    const skus = await catalogRepository.listSkus({ isActive: true }, 0, 200);
    return skus.map((sku) => ({
      id: String(sku._id),
      skuCode: sku.skuCode,
      name: sku.name,
      category: sku.category,
      material: sku.material,
      dimensions: sku.dimensions,
      print: sku.print,
      pricing: sku.pricing,
    }));
  },

  async bom(skuId: string) {
    const sku = await catalogRepository.findSkuById(skuId);
    if (!sku) throw AppError.notFound('SKU not found');
    const bom = await catalogRepository.bom(skuId);
    return bom.map((line) => line.toObject({ versionKey: false }));
  },

  async replaceBom(skuId: string, lines: Record<string, unknown>[]) {
    const sku = await catalogRepository.findSkuById(skuId);
    if (!sku) throw AppError.notFound('SKU not found');
    await catalogRepository.replaceBom(skuId, lines);
    return this.bom(skuId);
  },
};

export { escapeRegex };
