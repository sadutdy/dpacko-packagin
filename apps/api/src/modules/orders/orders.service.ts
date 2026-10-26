import {
  applyPartyOverride,
  assertTransition,
  buildQuoteDocument,
  DEFAULT_PRESENTATION,
  partyFromCustomer,
  percentOf,
  pricingFromDocument,
  QUOTE_TITLES,
  type DocumentSeller,
  type QuoteTitle,
  isOrderState,
  quote,
  RuleScope,
  type PriceRule,
  type QuoteItemResult,
  type Role,
} from '@ameen/domain';

import { AppError } from '../../core/errors/AppError.js';
import { ErrorCode } from '../../core/errors/ErrorCode.js';
import { buildPageMeta, parsePagination } from '../../core/http/pagination.js';
import { nextCounter } from '../counters/counter.model.js';
import { companyService } from '../company/company.service.js';
import { crmRepository } from '../crm/crm.repository.js';
import { deliveryService } from '../delivery/delivery.service.js';
import { productionService } from '../production/production.service.js';
import { PriceRule as PriceRuleModel } from '../pricing/pricing.model.js';
import { CatalogSku } from '../catalog/catalog.model.js';
import type { CustomerDoc } from '../crm/crm.repository.js';
import { ordersRepository, type OrderDoc, type QuoteDoc } from './orders.repository.js';
import type { SaveQuoteInput } from './orders.schema.js';

const ISO_PERIOD = '25-26';
const PLACE_OF_SUPPLY = '33';
const CUSTOMER_STATE = '33';
const QUOTE_STATUSES: readonly string[] = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'];

async function nextQuoteNumber(): Promise<string> {
  return `QT-${ISO_PERIOD.replace('-', '')}-${String(await nextCounter('quote', ISO_PERIOD)).padStart(5, '0')}`;
}

async function findScopedQuote(id: string, scopedCustomerId?: string): Promise<QuoteDoc> {
  const quote = await ordersRepository.findQuoteById(id);
  // Customers only see their own quotes; others' look like missing ones.
  if (!quote || (scopedCustomerId && String(quote.customerId) !== scopedCustomerId)) {
    throw AppError.notFound('Quote not found');
  }
  return quote;
}

/** Normalises stored quotes (incl. pre-editor v1 docs) into the editor shape. */
export function toEditableQuote(quote: QuoteDoc) {
  const override = quote.partyOverride ?? {};
  return {
    customerId: String(quote.customerId),
    refNo: quote.refNo ?? '',
    status: quote.status,
    title: (QUOTE_TITLES as readonly string[]).includes(quote.title ?? '') ? (quote.title as QuoteTitle) : DEFAULT_PRESENTATION.title,
    layout: quote.layout || DEFAULT_PRESENTATION.layout,
    advancePct: quote.advancePct ?? DEFAULT_PRESENTATION.advancePct,
    partyOverride: {
      name: override.name ?? '',
      addressLines: [...(override.addressLines ?? [])],
      gstin: override.gstin ?? '',
      stateName: override.stateName ?? '',
      phone: override.phone ?? '',
    },
    terms: [...(quote.terms ?? [])],
    notes: quote.notes ?? '',
    items: quote.items.map((item) => ({
      skuId: item.skuId ? String(item.skuId) : null,
      name: item.name || item.skuCode,
      description: item.description || (item.skuCode && item.name && item.skuCode !== item.name ? item.skuCode : ''),
      hsn: item.hsnCode || snapshotHsn(item.bomSnapshot),
      quantity: item.quantity,
      unit: item.unit || 'NOS',
      ratePaise: item.unitPricePaise,
      setupChargePaise: item.setupChargePaise,
      taxRate: item.taxRate,
    })),
  };
}

export function snapshotHsn(snapshot: unknown): string {
  const pricing = (snapshot as { pricing?: { hsnCode?: unknown } } | null)?.pricing;
  return typeof pricing?.hsnCode === 'string' ? pricing.hsnCode : '';
}

function toObject(doc: OrderDoc) {
  return doc.toObject({ versionKey: false });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveRole(actorRole: string): Role {
  return actorRole as Role;
}

async function loadPriceRules(now: Date): Promise<PriceRule[]> {
  const docs = await PriceRuleModel.find({ isActive: true })
    .or([{ validFrom: null }, { validFrom: { $lte: now } }])
    .and([{ $or: [{ validTo: null }, { validTo: { $gte: now } }] }])
    .lean()
    .exec();
  return docs.map((doc) => ({
    id: String(doc._id),
    scope: doc.scope as PriceRule['scope'],
    ruleType: doc.ruleType as PriceRule['ruleType'],
    value: doc.value,
    priority: doc.priority,
    skuId: doc.skuId ? String(doc.skuId) : undefined,
    category: doc.category ?? undefined,
    customerId: doc.customerId ? String(doc.customerId) : undefined,
    segment: doc.segment ?? undefined,
    minQty: doc.minQty ?? undefined,
    maxQty: doc.maxQty ?? undefined,
    validFrom: doc.validFrom ?? undefined,
    validTo: doc.validTo ?? undefined,
    isActive: doc.isActive,
  }));
}

interface PricingComputeInput {
  items: { skuId: string; quantity: number; printSpec?: { type: string; sides: number; colors: number; artworkUrl?: string; notes?: string } | null }[];
  customerId?: string;
  segment?: string;
  createdAt?: Date;
}

interface ComputedPricing {
  items: (QuoteItemResult & {
    printSpec: { type: string; sides: number; colors: number; artworkUrl: string; notes: string; plateChargePaise: number };
    taxRate: number;
    hsnCode: string;
    unit: string;
    bomSnapshot: unknown;
  })[];
  subtotalPaise: number;
  discountPaise: number;
  setupChargePaise: number;
  taxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  roundOffPaise: number;
  grandTotalPaise: number;
}

/** Computes order/quote pricing using the pure domain pricing engine. */
export async function computePricing(input: PricingComputeInput): Promise<ComputedPricing> {
  const now = input.createdAt ?? new Date();
  const [rules, skus] = await Promise.all([
    loadPriceRules(now),
    CatalogSku.find({ _id: { $in: input.items.map((item) => item.skuId) } }).exec(),
  ]);
  const skuById = new Map(skus.map((sku) => [String(sku._id), sku]));

  const quoteInputs = input.items.map((item) => {
    const sku = skuById.get(item.skuId);
    if (!sku) throw AppError.notFound(`Unknown SKU ${item.skuId}`);
    const print = item.printSpec && item.printSpec.type !== 'none'
      ? {
          type: item.printSpec.type as 'single' | 'multi',
          sides: item.printSpec.sides,
          colors: item.printSpec.colors,
          plateChargePaise: item.printSpec.type === 'single' ? 25_00 : item.printSpec.colors * 12_00,
        }
      : null;
    return {
      skuId: item.skuId,
      category: sku.category,
      quantity: item.quantity,
      basePricePaise: sku.pricing.basePricePaise,
      print,
      taxRate: sku.pricing.taxRate,
      customerId: input.customerId,
      segment: input.segment,
    };
  });

  const result = quote(quoteInputs, rules, { placeOfSupply: PLACE_OF_SUPPLY, customerState: CUSTOMER_STATE }, now);

  // Enrich each priced line with the catalog snapshot for the order document.
  const items = result.items.map((line, index) => {
    const spec = input.items[index]?.printSpec;
    return {
      ...line,
      printSpec: {
        type: spec?.type ?? 'none',
        sides: spec?.sides ?? 0,
        colors: spec?.colors ?? 0,
        artworkUrl: spec?.artworkUrl ?? '',
        notes: spec?.notes ?? '',
        plateChargePaise: line.setupChargePaise,
      },
      taxRate: skuById.get(line.skuId)?.pricing.taxRate ?? 0,
      hsnCode: skuById.get(line.skuId)?.pricing.hsnCode ?? '',
      unit: 'NOS',
      bomSnapshot: skuById.get(line.skuId)?.toObject({ versionKey: false }) ?? null,
    };
  });

  return {
    items,
    subtotalPaise: result.subtotalPaise,
    discountPaise: result.discountPaise,
    setupChargePaise: result.setupChargePaise,
    taxPaise: result.taxPaise,
    cgstPaise: result.cgstPaise,
    sgstPaise: result.sgstPaise,
    igstPaise: result.igstPaise,
    roundOffPaise: result.roundOffPaise,
    grandTotalPaise: result.grandTotalPaise,
  };
}

async function assertCreditAvailable(customer: CustomerDoc, orderTotalPaise: number) {
  const available = customer.creditLimit - customer.creditUsed;
  if (orderTotalPaise > available) {
    throw new AppError({
      code: ErrorCode.CREDIT_LIMIT_EXCEEDED,
      message: `Credit limit exceeded: order ${orderTotalPaise / 100} exceeds available ${available / 100}`,
      details: { orderTotalPaise, creditLimit: customer.creditLimit, creditUsed: customer.creditUsed },
    });
  }
}

export const ordersService = {
  async listOrders(query: Record<string, unknown>) {
    const params = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.customerId) filter.customerId = query.customerId;
    if (query.search) filter.orderNumber = new RegExp(escapeRegex(String(query.search)), 'i');
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) (filter.createdAt as Record<string, unknown>).$gte = query.from;
      if (query.to) (filter.createdAt as Record<string, unknown>).$lte = query.to;
    }
    const [orders, total] = await Promise.all([
      ordersRepository.listOrders(filter, params.skip, params.limit, params.sort as string | undefined),
      ordersRepository.countOrders(filter),
    ]);
    return { orders: orders.map(toObject), meta: buildPageMeta(total, params) };
  },

  async getOrder(id: string) {
    const order = await ordersRepository.findOrderById(id);
    if (!order) throw AppError.notFound('Order not found');
    return toObject(order);
  },

  /** Builds a quote preview (optionally persisted as a draft quote). */
  async previewQuote(input: { customerId: string; items: { skuId: string; quantity: number; printSpec?: { type: string; sides: number; colors: number; artworkUrl?: string; notes?: string } }[]; persist?: boolean }) {
    const customer = await crmRepository.findById(input.customerId);
    if (!customer) throw AppError.notFound('Customer not found');
    const pricing = await computePricing({
      items: input.items,
      customerId: input.customerId,
      segment: customer.segment,
    });
    if (!input.persist) {
      return { customerId: input.customerId, ...pricing, status: 'preview' };
    }
    const quoteNumber = await nextQuoteNumber();
    const doc = await ordersRepository.createQuote({
      quoteNumber,
      customerId: input.customerId,
      items: pricing.items,
      pricing: pricing,
      status: 'draft',
      validUntil: new Date(Date.now() + 14 * 86_400_000),
    });
    return doc.toObject({ versionKey: false });
  },

  async createOrder(
    input: {
      customerId: string;
      items: { skuId: string; quantity: number; printSpec?: { type: string; sides: number; colors: number; artworkUrl?: string; notes?: string } }[];
      paymentMethod: string;
      requestedDeliveryDate?: Date;
      deliveryAddress?: Record<string, unknown>;
      source?: string;
      isRepeat?: boolean;
      notes?: string;
      persistQuote?: boolean;
    },
    actorId: string,
  ) {
    const customer = await crmRepository.findById(input.customerId);
    if (!customer) throw AppError.notFound('Customer not found');
    if (customer.isBlacklisted) throw AppError.forbidden('This customer is blacklisted');

    const pricing = await computePricing({
      items: input.items,
      customerId: input.customerId,
      segment: customer.segment,
    });

    // Credit guard for on-credit orders.
    if (input.paymentMethod === 'credit') {
      await assertCreditAvailable(customer, pricing.grandTotalPaise);
    }

    // Snapshot the real SKU names/codes onto the items — invoices need the
    // description to pass validation, and customers need meaningful history.
    const skuDocs = await CatalogSku.find({ _id: { $in: pricing.items.map((item) => item.skuId) } })
      .select({ name: 1, skuCode: 1 })
      .lean();
    const skuById = new Map(skuDocs.map((doc) => [String(doc._id), doc]));

    const orderNumber = `ORD-${ISO_PERIOD.replace('-', '')}-${String(await nextCounter('order', ISO_PERIOD)).padStart(5, '0')}`;
    const status = input.paymentMethod === 'razorpay' ? 'payment_pending' : 'placed';
    const order = await ordersRepository.createOrder({
      orderNumber,
      customerId: input.customerId,
      status,
      stateHistory: [{ from: '', to: status, at: new Date(), by: actorId, reason: '', note: '' }],
      items: pricing.items.map((item) => ({
        skuId: item.skuId,
        skuCode: skuById.get(String(item.skuId))?.skuCode ?? '',
        name: skuById.get(String(item.skuId))?.name ?? '',
        quantity: item.quantity,
        dimensions: {},
        material: '',
        printSpec: item.printSpec,
        unitPricePaise: item.unitPricePaise,
        basePricePaise: item.basePricePaise,
        setupChargePaise: item.setupChargePaise,
        discountPaise: item.discountPaise,
        taxRate: item.taxRate,
        lineTotalPaise: item.lineTotalPaise,
        bomSnapshot: item.bomSnapshot,
      })),
      pricing: pricing,
      payment: { method: input.paymentMethod, status: 'pending', amountPaidPaise: 0 },
      deliveryAddress: input.deliveryAddress ?? customer.addresses[0] ?? {},
      requestedDeliveryDate: input.requestedDeliveryDate ?? null,
      notes: input.notes ?? '',
      source: input.source ?? 'admin',
      isRepeat: input.isRepeat ?? false,
      placedAt: status === 'placed' ? new Date() : null,
      createdBy: actorId,
    });

    // Denormalised customer statistics.
    await crmRepository.update(customer._id.toString(), {
      $inc: { orderCount: 1, totalOrderValue: pricing.grandTotalPaise },
    });
    if (input.paymentMethod === 'credit') {
      await crmRepository.update(customer._id.toString(), {
        $inc: { creditUsed: pricing.grandTotalPaise },
      });
    }

    return toObject(order);
  },

  /**
   * The single entry point for order state changes. The domain owns the rule
   * (assertTransition); this method handles side effects 'planned' → job,
   * 'ready' → delivery, 'dispatched' → invoice, 'delivered' → COD pay-in.
   */
  async transition(
    id: string,
    input: { to: string; reason?: string; note?: string },
    actorId: string,
    actorRole: string,
  ) {
    if (!isOrderState(input.to)) throw AppError.validation('Unknown order state');
    const order = await ordersRepository.findOrderById(id);
    if (!order) throw AppError.notFound('Order not found');
    const from = order.status;
    const role = resolveRole(actorRole);
    assertTransition(from as never, input.to as never, role);

    const stateHistoryEntry = { from, to: input.to, at: new Date(), by: actorId, reason: input.reason ?? '', note: input.note ?? '' };
    const update: Record<string, unknown> = {
      $push: { stateHistory: stateHistoryEntry },
      $set: { status: input.to },
    };

    let jobCreated = null;
    let deliveryCreated = null;
    if (input.to === 'cancelled') {
      (update.$set as Record<string, unknown>).cancelledAt = new Date();
      (update.$set as Record<string, unknown>).cancelReason = input.reason ?? '';
      if (order.payment.method === 'credit') {
        await crmRepository.update(order.customerId.toString(), {
          $inc: { creditUsed: -order.pricing.grandTotalPaise },
        });
      }
    }
    if (input.to === 'planned') {
      jobCreated = await productionService.createJob(
        {
          orderId: String(order._id),
          orderNumber: order.orderNumber,
          items: order.items.map((item) => ({ skuId: String(item.skuId), skuCode: item.skuCode, quantity: item.quantity })),
        },
        actorId,
      );
    }
    if (input.to === 'ready') {
      const { deliveryRepository } = await import('../delivery/delivery.repository.js');
      const existing = await deliveryRepository.findDeliveryByOrder(String(order._id));
      if (!existing) {
        deliveryCreated = await deliveryService.createForOrder(
          {
            orderId: String(order._id),
            customerId: String(order.customerId),
            address: order.deliveryAddress,
          },
          actorId,
        );
      }
    }
    if (input.to === 'dispatched') {
      // FIN-1: invoice cut when the order leaves the bay. The payments module
      // owns the invoice; import lazily to avoid a circular service import.
      const { paymentsService } = await import('../payments/payments.service.js');
      const invoice = await paymentsService.invoiceForOrder(String(order._id), actorId);
      (update.$set as Record<string, unknown>).invoiceId = String(invoice._id);
    }
    if (input.to === 'delivered' && order.payment.method === 'cod' && order.payment.status !== 'paid') {
      (update.$set as Record<string, unknown>).payment = {
        ...order.payment,
        status: 'paid',
        paidAt: new Date(),
        amountPaidPaise: order.pricing.grandTotalPaise,
      };
    }
    if (input.to === 'closed') {
      (update.$set as Record<string, unknown>).closedAt = new Date();
      if (order.pricing.grandTotalPaise > 0) {
        await crmRepository.update(order.customerId.toString(), {
          $inc: { creditUsed: 0 },
        });
      }
    }

    const updated = await ordersRepository.updateOrder(id, update);
    if (!updated) throw AppError.notFound('Order not found');
    return {
      ...toObject(updated),
      ...(jobCreated ? { jobCreated } : {}),
      ...(deliveryCreated ? { deliveryCreated } : {}),
    };
  },

  async listQuotes(query: Record<string, unknown>) {
    const params = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.customerId) filter.customerId = query.customerId;
    if (query.status) filter.status = query.status;
    const [quotes, total] = await Promise.all([
      ordersRepository.listQuotes(filter, params.skip, params.limit, params.sort as string | undefined),
      ordersRepository.countQuotes(filter),
    ]);
    return { quotes: quotes.map((doc) => doc.toObject({ versionKey: false })), meta: buildPageMeta(total, params) };
  },

  /** The seller block printed on every quote (company profile + defaults). */
  quoteSeller: (): Promise<DocumentSeller> => companyService.documentSeller(),

  /**
   * Denormalised printable quotation: seller (company profile), party
   * (customer + default address + per-quote overrides) and priced lines,
   * shaped by the domain builder.
   */
  async getQuoteDocument(id: string, scopedCustomerId?: string) {
    const quote = await findScopedQuote(id, scopedCustomerId);
    const [seller, customer] = await Promise.all([
      ordersService.quoteSeller(),
      crmRepository.findById(String(quote.customerId)),
    ]);
    const editable = toEditableQuote(quote);
    return buildQuoteDocument({
      quote: {
        id: String(quote._id),
        number: quote.quoteNumber,
        refNo: editable.refNo,
        date: (quote.issueDate ?? quote.createdAt).toISOString(),
        validUntil: quote.validUntil ? quote.validUntil.toISOString() : null,
        status: quote.status,
        title: editable.title,
        layout: editable.layout,
        advancePct: editable.advancePct,
        terms: editable.terms,
        notes: editable.notes,
      },
      seller,
      party: applyPartyOverride(
        customer ? partyFromCustomer(customer) : { name: 'Unknown customer', addressLines: [], phone: '', gstin: '', stateName: '', stateCode: '' },
        editable.partyOverride,
      ),
      lines: editable.items,
    });
  },

  /** A quote in the editor's shape (lines, presentation, party overrides). */
  async getQuoteForEdit(id: string, scopedCustomerId?: string) {
    const quote = await findScopedQuote(id, scopedCustomerId);
    return {
      _id: String(quote._id),
      quoteNumber: quote.quoteNumber,
      createdAt: quote.createdAt,
      ...toEditableQuote(quote),
      issueDate: quote.issueDate ?? quote.createdAt,
      validUntil: quote.validUntil ?? null,
    };
  },

  /** Creates (no id) or fully replaces a quote from the quote editor. */
  async saveQuote(input: SaveQuoteInput, actorId: string, id?: string) {
    const existing = id ? await ordersRepository.findQuoteById(id) : null;
    if (id && !existing) throw AppError.notFound('Quote not found');
    if (existing?.status === 'converted') throw AppError.conflict('Converted quotes cannot be changed');

    const [customer, seller] = await Promise.all([crmRepository.findById(input.customerId), ordersService.quoteSeller()]);
    if (!customer) throw AppError.notFound('Customer not found');

    // Price through the same builder the document uses so stored totals match the print.
    const doc = buildQuoteDocument({
      quote: { id: id ?? 'new', number: existing?.quoteNumber ?? 'new', date: new Date().toISOString(), status: input.status },
      seller,
      party: applyPartyOverride(partyFromCustomer(customer), input.partyOverride),
      lines: input.items,
    });

    const fields = {
      customerId: input.customerId,
      refNo: input.refNo,
      issueDate: input.issueDate,
      validUntil: input.validUntil,
      status: input.status,
      title: input.title,
      layout: input.layout,
      advancePct: input.advancePct,
      partyOverride: input.partyOverride,
      terms: input.terms,
      notes: input.notes,
      items: input.items.map((line, index) => {
        const amountPaise = doc.lines[index]?.amountPaise ?? 0;
        return {
          skuId: line.skuId,
          skuCode: '',
          name: line.name,
          description: line.description,
          quantity: line.quantity,
          unitPricePaise: line.ratePaise,
          basePricePaise: line.ratePaise,
          setupChargePaise: line.setupChargePaise,
          discountPaise: 0,
          taxRate: line.taxRate,
          hsnCode: line.hsn,
          unit: line.unit,
          lineTotalPaise: amountPaise + percentOf(amountPaise, line.taxRate),
        };
      }),
      pricing: pricingFromDocument(doc),
      schemaVersion: 2,
    };

    if (existing) {
      const updated = await ordersRepository.updateQuote(String(existing._id), fields);
      if (!updated) throw AppError.notFound('Quote not found');
      return updated.toObject({ versionKey: false });
    }
    const created = await ordersRepository.createQuote({ ...fields, quoteNumber: await nextQuoteNumber(), createdBy: actorId });
    return created.toObject({ versionKey: false });
  },

  /** Manual quote maintenance: status changes and expiry (converted is final). */
  async updateQuote(id: string, input: { status?: string; validUntil?: Date }) {
    const quote = await ordersRepository.findQuoteById(id);
    if (!quote) throw AppError.notFound('Quote not found');
    if (quote.status === 'converted') throw AppError.conflict('Converted quotes cannot be changed');
    const update: Record<string, unknown> = {};
    if (input.status) {
      if (!QUOTE_STATUSES.includes(input.status)) throw AppError.validation('Unknown quote status');
      if (input.status === 'converted') throw AppError.conflict('Use "convert" via an accepted quote instead');
      update.status = input.status;
    }
    if (input.validUntil !== undefined) update.validUntil = input.validUntil;
    const updated = await ordersRepository.updateQuote(id, update);
    if (!updated) throw AppError.notFound('Quote not found');
    return updated.toObject({ versionKey: false });
  },

  /** Deletes a quote (hard); converted quotes are financial history and stay. */
  async deleteQuote(id: string) {
    const quote = await ordersRepository.findQuoteById(id);
    if (!quote) throw AppError.notFound('Quote not found');
    if (quote.status === 'converted') throw AppError.conflict('Converted quotes cannot be deleted');
    await ordersRepository.deleteQuote(id);
    return { deleted: true };
  },

  /**
   * Manual order maintenance: notes, delivery dates and address. The status is
   * intentionally NOT editable here — that belongs to the state machine
   * (transition() or cancel via deleteOrder).
   */
  async updateOrder(
    id: string,
    input: {
      notes?: string;
      internalNotes?: string;
      requestedDeliveryDate?: Date;
      promisedDeliveryDate?: Date;
      deliveryAddress?: Record<string, unknown>;
    },
  ) {
    const order = await ordersRepository.findOrderById(id);
    if (!order) throw AppError.notFound('Order not found');
    const update: Record<string, unknown> = {};
    if (input.notes !== undefined) update.notes = input.notes;
    if (input.internalNotes !== undefined) update.internalNotes = input.internalNotes;
    if (input.requestedDeliveryDate !== undefined) update.requestedDeliveryDate = input.requestedDeliveryDate;
    if (input.promisedDeliveryDate !== undefined) update.promisedDeliveryDate = input.promisedDeliveryDate;
    if (input.deliveryAddress !== undefined) update.deliveryAddress = input.deliveryAddress;
    const updated = await ordersRepository.updateOrder(id, { $set: update });
    if (!updated) throw AppError.notFound('Order not found');
    return toObject(updated);
  },

  /**
   * 'Delete' is really a cancel: the order keeps its history and the credit
   * ledger is rolled back, exactly like a customer-initiated cancellation.
   */
  async deleteOrder(id: string, actorId: string, actorRole: string) {
    const order = await ordersRepository.findOrderById(id);
    if (!order) throw AppError.notFound('Order not found');
    if (order.status === 'cancelled') throw AppError.conflict('Order is already cancelled');
    return this.transition(id, { to: 'cancelled', reason: 'Deleted by staff' }, actorId, actorRole);
  },

  statusCounts() {
    return ordersRepository.statusCounts();
  },
};

export { RuleScope };
