import { AppError } from '../../core/errors/AppError.js';
import { buildPageMeta, parsePagination } from '../../core/http/pagination.js';
import { nextCounter } from '../counters/counter.model.js';
import { inventoryService } from '../inventory/inventory.service.js';
import { purchasingRepository, type GoodsReceiptDoc, type PurchaseOrderDoc, type VendorDoc } from './purchasing.repository.js';

const ISO_PERIOD = '25-26';

function toObject(doc: VendorDoc | PurchaseOrderDoc | GoodsReceiptDoc) {
  return doc.toObject({ versionKey: false });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function computeTotals(items: { quantity: number; unitCostPaise: number; taxRate: number }[]) {
  let totalPaise = 0;
  let taxPaise = 0;
  for (const item of items) {
    const lineTotal = Math.round(item.quantity * item.unitCostPaise);
    const lineTax = Math.round((lineTotal * item.taxRate) / 100);
    totalPaise += lineTotal;
    taxPaise += lineTax;
  }
  return { totalPaise, taxPaise, grandTotalPaise: totalPaise + taxPaise };
}

export const purchasingService = {
  async listVendors(query: Record<string, unknown>) {
    const params = parsePagination(query);
    const filter: Record<string, unknown> = { isActive: true };
    if (query.type) filter.type = query.type;
    if (query.search) {
      const rx = new RegExp(escapeRegex(String(query.search)), 'i');
      filter.$or = [{ name: rx }, { phone: rx }, { gstin: rx }];
    }
    const [vendors, total] = await Promise.all([
      purchasingRepository.listVendors(filter, params.skip, params.limit, params.sort as string | undefined),
      purchasingRepository.countVendors(filter),
    ]);
    return { vendors: vendors.map(toObject), meta: buildPageMeta(total, params) };
  },

  async getVendor(id: string) {
    const vendor = await purchasingRepository.findVendorById(id);
    if (!vendor) throw AppError.notFound('Vendor not found');
    return toObject(vendor);
  },

  async createVendor(input: Record<string, unknown>) {
    const code = `VEN-${String(await nextCounter('vendor', 'all')).padStart(4, '0')}`;
    return toObject(await purchasingRepository.createVendor({ ...input, vendorCode: code }));
  },

  async updateVendor(id: string, input: Record<string, unknown>) {
    const vendor = await purchasingRepository.updateVendor(id, input);
    if (!vendor) throw AppError.notFound('Vendor not found');
    return toObject(vendor);
  },

  async listPurchaseOrders(query: Record<string, unknown>) {
    const params = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.vendorId) filter.vendorId = query.vendorId;
    const [orders, total] = await Promise.all([
      purchasingRepository.listPurchaseOrders(filter, params.skip, params.limit, params.sort as string | undefined),
      purchasingRepository.countPurchaseOrders(filter),
    ]);
    return { orders: orders.map(toObject), meta: buildPageMeta(total, params) };
  },

  async getPurchaseOrder(id: string) {
    const order = await purchasingRepository.findPurchaseOrderById(id);
    if (!order) throw AppError.notFound('Purchase order not found');
    return toObject(order);
  },

  async createPurchaseOrder(
    input: {
      vendorId: string;
      items: { materialId: string; quantity: number; unit: string; unitCostPaise: number; taxRate: number }[];
      expectedDeliveryDate?: Date;
      notes?: string;
    },
    actorId: string,
  ) {
    const vendor = await purchasingRepository.findVendorById(input.vendorId);
    if (!vendor) throw AppError.notFound('Vendor not found');
    const poNumber = `PO-${ISO_PERIOD.replace('-', '')}-${String(await nextCounter('po', ISO_PERIOD)).padStart(5, '0')}`;
    const totals = computeTotals(input.items);
    const order = await purchasingRepository.createPurchaseOrder({
      poNumber,
      vendorId: input.vendorId,
      items: input.items.map((item) => ({
        ...item,
        receivedQty: 0,
        lineTotalPaise: Math.round(item.quantity * item.unitCostPaise),
      })),
      status: 'draft',
      ...totals,
      expectedDeliveryDate: input.expectedDeliveryDate ?? null,
      notes: input.notes ?? '',
      createdBy: actorId,
    });
    return toObject(order);
  },

  async sendPurchaseOrder(id: string) {
    const order = await purchasingRepository.findPurchaseOrderById(id);
    if (!order) throw AppError.notFound('Purchase order not found');
    if (order.status !== 'draft') throw AppError.conflict(`Only draft purchase orders can be sent (status: ${order.status})`);
    const updated = await purchasingRepository.updatePurchaseOrder(id, { status: 'sent', sentAt: new Date() });
    if (!updated) throw AppError.notFound('Purchase order not found');
    return toObject(updated);
  },

  async cancelPurchaseOrder(id: string) {
    const order = await purchasingRepository.findPurchaseOrderById(id);
    if (!order) throw AppError.notFound('Purchase order not found');
    if (order.status !== 'draft' && order.status !== 'sent') {
      throw AppError.conflict(`Cannot cancel a purchase order with status '${order.status}'`);
    }
    const updated = await purchasingRepository.updatePurchaseOrder(id, { status: 'cancelled' });
    if (!updated) throw AppError.notFound('Purchase order not found');
    return toObject(updated);
  },

  /**
   * Records a goods receipt: creates the GRN, applies stock receipts for the
   * accepted quantities and advances the purchase order status.
   */
  async receiveGoods(
    input: {
      purchaseOrderId: string;
      invoiceNumber?: string;
      invoiceDate?: Date;
      items: { materialId: string; receivedQty: number; rejectedQty: number; unitCostPaise: number; binLocation: string }[];
    },
    actorId: string,
  ) {
    const order = await purchasingRepository.findPurchaseOrderById(input.purchaseOrderId);
    if (!order) throw AppError.notFound('Purchase order not found');
    if (order.status === 'draft') throw AppError.conflict('Send the purchase order before receiving goods');
    if (order.status === 'received' || order.status === 'cancelled') {
      throw AppError.conflict(`This purchase order is already ${order.status}`);
    }

    // Guard: no line may exceed what is still outstanding.
    const outstanding = new Map(order.items.map((item) => [String(item.materialId), item.quantity - item.receivedQty]));
    for (const item of input.items) {
      const remaining = outstanding.get(item.materialId);
      if (remaining === undefined) throw AppError.validation('A received material is not on this purchase order');
      if (item.receivedQty + item.rejectedQty > remaining) {
        throw AppError.conflict(`Received quantity exceeds the outstanding quantity for one of the lines (${remaining} left)`);
      }
    }

    const grnNumber = `GRN-${ISO_PERIOD.replace('-', '')}-${String(await nextCounter('grn', ISO_PERIOD)).padStart(5, '0')}`;
    const receipt = await purchasingRepository.createGoodsReceipt({
      grnNumber,
      purchaseOrderId: order._id,
      vendorId: order.vendorId,
      items: input.items.map((item) => {
        const ordered = order.items.find((line) => String(line.materialId) === item.materialId);
        return {
          materialId: item.materialId,
          orderedQty: ordered?.quantity ?? 0,
          receivedQty: item.receivedQty,
          rejectedQty: item.rejectedQty,
          unitCostPaise: item.unitCostPaise || ordered?.unitCostPaise || 0,
          binLocation: item.binLocation,
        };
      }),
      invoiceNumber: input.invoiceNumber ?? '',
      invoiceDate: input.invoiceDate ?? null,
      status: 'posted',
      postedAt: new Date(),
      postedBy: actorId,
    });

    // Accepted quantities enter the warehouse.
    for (const item of input.items) {
      const accepted = item.receivedQty - item.rejectedQty;
      if (accepted <= 0) continue;
      await inventoryService.receive(
        {
          materialId: item.materialId,
          quantity: accepted,
          location: item.binLocation || 'STORE-1',
          unitCostPaise: item.unitCostPaise || 0,
          referenceType: 'purchase_order',
          referenceId: String(order._id),
          note: grnNumber,
        },
        actorId,
      );
    }

    // Advance the PO status and per-line received quantities.
    const receivedByMaterial = new Map<string, number>();
    for (const item of input.items) {
      receivedByMaterial.set(item.materialId, item.receivedQty - item.rejectedQty);
    }
    for (const item of order.items) {
      const accepted = receivedByMaterial.get(String(item.materialId)) ?? 0;
      if (accepted > 0) {
        item.receivedQty += accepted;
        if (item.unitCostPaise === 0) {
          const grnLine = input.items.find((line) => line.materialId === String(item.materialId));
          if (grnLine?.unitCostPaise) item.unitCostPaise = grnLine.unitCostPaise;
        }
      }
    }
    const updated = await purchasingRepository.updatePurchaseOrder(String(order._id), {
      items: order.items,
      status: order.items.every((item) => item.receivedQty >= item.quantity) ? 'received' : 'partially_received',
      receivedAt: new Date(),
    });

    return {
      grn: toObject(receipt),
      purchaseOrder: updated ? toObject(updated) : null,
    };
  },

  async listGoodsReceipts(query: Record<string, unknown>) {
    const params = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.vendorId) filter.vendorId = query.vendorId;
    if (query.purchaseOrderId) filter.purchaseOrderId = query.purchaseOrderId;
    const [receipts, total] = await Promise.all([
      purchasingRepository.listGoodsReceipts(filter, params.skip, params.limit, params.sort as string | undefined),
      purchasingRepository.countGoodsReceipts(filter),
    ]);
    return { receipts: receipts.map(toObject), meta: buildPageMeta(total, params) };
  },

  async getGoodsReceipt(id: string) {
    const receipt = await purchasingRepository.findGoodsReceiptById(id);
    if (!receipt) throw AppError.notFound('Goods receipt not found');
    return toObject(receipt);
  },
};

export { escapeRegex };
