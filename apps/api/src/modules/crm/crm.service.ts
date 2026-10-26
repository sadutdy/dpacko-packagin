import { Order } from '../orders/orders.model.js';
import { AppError } from '../../core/errors/AppError.js';
import { buildPageMeta, parsePagination } from '../../core/http/pagination.js';
import { crmRepository, type CustomerDoc } from './crm.repository.js';

function toObject(doc: CustomerDoc) {
  return doc.toObject({ versionKey: false });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Strips empty/invalid geo points — the 2dsphere index rejects them. */
function sanitizeAddresses(input: Record<string, unknown>): Record<string, unknown> {
  const addresses = input.addresses;
  if (!Array.isArray(addresses)) return input;
  return {
    ...input,
    addresses: addresses.map((address) => {
      const geo = (address as { geo?: { coordinates?: unknown[] } }).geo;
      const valid = geo && Array.isArray(geo.coordinates) && geo.coordinates.length === 2 && geo.coordinates.every(Number.isFinite);
      if (valid) return address;
      const { geo: _ignored, ...rest } = address as Record<string, unknown>;
      return rest;
    }),
  };
}

export const crmService = {
  async list(query: Record<string, unknown>) {
    const params = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.segment) filter.segment = query.segment;
    if (query.city) filter['addresses.city'] = query.city;
    if (query.hasOverdue) filter.creditUsed = { $gt: 0 };
    if (query.search) {
      const rx = new RegExp(escapeRegex(String(query.search)), 'i');
      filter.$or = [{ businessName: rx }, { contactName: rx }, { phone: rx }];
    }

    const [customers, total] = await Promise.all([
      crmRepository.list(filter, params.skip, params.limit, params.sort as string | undefined),
      crmRepository.count(filter),
    ]);

    return { customers: customers.map(toObject), meta: buildPageMeta(total, params) };
  },

  async create(input: Record<string, unknown>) {
    const existing = await crmRepository.findByPhone(String(input.phone));
    if (existing) throw AppError.conflict('A customer with this phone already exists');
    const customer = await crmRepository.create(sanitizeAddresses(input));
    return toObject(customer);
  },

  async get(id: string) {
    const customer = await crmRepository.findById(id);
    if (!customer) throw AppError.notFound('Customer not found');
    const orders = await Order.find({ customerId: id }).sort({ createdAt: -1 }).limit(5).exec();
    return {
      ...toObject(customer),
      recentOrders: orders.map((order) => ({
        id: String(order._id),
        orderNumber: order.orderNumber,
        status: order.status,
        grandTotalPaise: order.pricing.grandTotalPaise,
        createdAt: order.createdAt,
      })),
    };
  },

  async update(id: string, input: Record<string, unknown>) {
    const customer = await crmRepository.update(id, sanitizeAddresses(input));
    if (!customer) throw AppError.notFound('Customer not found');
    return toObject(customer);
  },

  /** Hard-deletes a customer; refused while orders still reference them. */
  async remove(id: string) {
    const customer = await crmRepository.findById(id);
    if (!customer) throw AppError.notFound('Customer not found');
    const orderCount = await Order.countDocuments({ customerId: id }).exec();
    if (orderCount > 0) {
      throw AppError.conflict(`Customer has ${orderCount} order(s); cancel or delete those first`);
    }
    await crmRepository.remove(id);
    return { deleted: true };
  },

  async listOrders(id: string, query: Record<string, unknown>) {
    const params = parsePagination(query);
    const [orders, total] = await Promise.all([
      Order.find({ customerId: id }).sort({ createdAt: -1 }).skip(params.skip).limit(params.limit).exec(),
      Order.countDocuments({ customerId: id }).exec(),
    ]);
    return { orders: orders.map((o) => o.toObject({ versionKey: false })), meta: buildPageMeta(total, params) };
  },

  async creditSummary(id: string) {
    const customer = await crmRepository.findById(id);
    if (!customer) throw AppError.notFound('Customer not found');
    return {
      creditLimit: customer.creditLimit,
      creditUsed: customer.creditUsed,
      availableCredit: Math.max(0, customer.creditLimit - customer.creditUsed),
      paymentTermsDays: customer.paymentTermsDays,
      totalOrderValue: customer.totalOrderValue,
      orderCount: customer.orderCount,
    };
  },

  async adjustCredit(id: string, input: { creditLimit: number; paymentTermsDays?: number }) {
    const customer = await crmRepository.update(id, {
      creditLimit: input.creditLimit,
      ...(input.paymentTermsDays !== undefined ? { paymentTermsDays: input.paymentTermsDays } : {}),
    });
    if (!customer) throw AppError.notFound('Customer not found');
    return toObject(customer);
  },

  async listAddresses(id: string) {
    const customer = await crmRepository.findById(id);
    if (!customer) throw AppError.notFound('Customer not found');
    return customer.addresses.map((address) => address.toObject());
  },

  async addAddress(id: string, input: Record<string, unknown>) {
    const customer = await crmRepository.findById(id);
    if (!customer) throw AppError.notFound('Customer not found');
    customer.addresses.push(input as never);
    if (input.isDefault) {
      customer.addresses.forEach((address, index) => {
        if (index < customer.addresses.length - 1) address.isDefault = false;
      });
    }
    await customer.save();
    return customer.addresses.map((address) => address.toObject());
  },

  async updateAddress(customerId: string, addressId: string, input: Record<string, unknown>) {
    const customer = await crmRepository.findById(customerId);
    if (!customer) throw AppError.notFound('Customer not found');
    const address = customer.addresses.id(addressId);
    if (!address) throw AppError.notFound('Address not found');
    Object.assign(address, input);
    await customer.save();
    return address.toObject();
  },

  async removeAddress(customerId: string, addressId: string) {
    const customer = await crmRepository.findById(customerId);
    if (!customer) throw AppError.notFound('Customer not found');
    const address = customer.addresses.id(addressId);
    if (!address) throw AppError.notFound('Address not found');
    address.deleteOne();
    await customer.save();
    return { removed: true };
  },

  async segments() {
    const rows = await crmRepository.segments();
    const counts = new Map(rows.map((row) => [row.segment, row.count]));
    return ['walk_in', 'small', 'mid', 'large', 'enterprise'].map((segment) => ({
      segment,
      count: counts.get(segment) ?? 0,
    }));
  },

  /**
   * Reorder suggestions: customers whose most recent order is older than their
   * average order interval (or 30 days for one-off buyers).
   */
  async suggestions() {
    const rows = await Order.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$customerId',
          lastOrderAt: { $first: '$createdAt' },
          orderCount: { $sum: 1 },
          totalValue: { $sum: '$pricing.grandTotalPaise' },
        },
      },
    ]).exec();

    const now = Date.now();
    return rows
      .map((row) => {
        const daysSince = Math.floor((now - new Date(row.lastOrderAt).getTime()) / 86_400_000);
        const expectedInterval = row.orderCount > 1 ? Math.max(7, 30) : 30;
        return {
          customerId: String(row._id),
          lastOrderAt: row.lastOrderAt,
          orderCount: row.orderCount,
          totalValue: row.totalValue,
          daysSinceLastOrder: daysSince,
          likelyToReorder: daysSince >= expectedInterval,
        };
      })
      .sort((a, b) => Number(b.likelyToReorder) - Number(a.likelyToReorder));
  },
};
