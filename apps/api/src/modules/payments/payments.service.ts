import {
  amountInWords,
  applyPartyOverride,
  buildInvoiceDocument,
  COPY_KINDS,
  EMPTY_DISPATCH,
  INVOICE_TITLES,
  partyFromCustomer,
  percentOf,
  pricingFromDocument,
  type CopyKind,
  type DocumentParty,
  type InvoiceTitle,
} from '@ameen/domain';

import { AppError } from '../../core/errors/AppError.js';
import { buildPageMeta, parsePagination } from '../../core/http/pagination.js';
import { companyService } from '../company/company.service.js';
import { crmRepository } from '../crm/crm.repository.js';
import { nextCounter } from '../counters/counter.model.js';
import { ordersRepository } from '../orders/orders.repository.js';
import { paymentsRepository, type InvoiceDoc, type PaymentDoc } from './payments.repository.js';
import type { SaveInvoiceInput } from './payments.schema.js';

const ISO_PERIOD = '25-26';
const SUPPLIER_GSTIN = '33AAECA0000L1ZP';
const INVOICE_STATUSES: readonly string[] = ['unpaid', 'partial', 'paid', 'overdue', 'cancelled', 'credited'];

function toObject(doc: InvoiceDoc | PaymentDoc) {
  return doc.toObject({ versionKey: false });
}

/** Statuses the invoice editor may set or edit; paid/partial/credited are books-kept. */
const EDITABLE_INVOICE_STATUSES: readonly string[] = ['unpaid', 'overdue', 'cancelled'];

async function nextInvoiceNumber(): Promise<string> {
  return `INV-${ISO_PERIOD.replace('-', '')}-${String(await nextCounter('invoice', ISO_PERIOD)).padStart(5, '0')}`;
}

function blankOverride(source: { name?: string; addressLines?: string[]; gstin?: string; stateName?: string; phone?: string } | null | undefined) {
  return {
    name: source?.name ?? '',
    addressLines: [...(source?.addressLines ?? [])],
    gstin: source?.gstin ?? '',
    stateName: source?.stateName ?? '',
    phone: source?.phone ?? '',
  };
}

/** Normalises stored invoices (incl. order-cut v1 docs) into the editor shape. */
function toEditableInvoice(invoice: InvoiceDoc) {
  const copies = (invoice.copies ?? []).filter((copy): copy is CopyKind => (COPY_KINDS as string[]).includes(copy));
  return {
    customerId: String(invoice.customerId),
    orderId: invoice.orderId ? String(invoice.orderId) : null,
    quoteId: invoice.quoteId ? String(invoice.quoteId) : null,
    status: invoice.status,
    title: (INVOICE_TITLES as readonly string[]).includes(invoice.title ?? '') ? (invoice.title as InvoiceTitle) : 'Tax Invoice',
    layout: invoice.layout || 'tally',
    copies: copies.length > 0 ? copies : (['original'] as CopyKind[]),
    reverseCharge: invoice.reverseCharge ?? false,
    buyerOrderNo: invoice.buyerOrderNo ?? '',
    buyerOrderDate: invoice.buyerOrderDate ?? null,
    // Read known keys: entries of a Mongoose subdocument are its internals.
    dispatch: Object.fromEntries(
      (Object.keys(EMPTY_DISPATCH) as (keyof typeof EMPTY_DISPATCH)[]).map((key) => [key, invoice.dispatch?.[key] ?? '']),
    ) as unknown as typeof EMPTY_DISPATCH,
    partyOverride: blankOverride(invoice.partyOverride),
    shipTo: { enabled: invoice.shipTo?.enabled ?? false, ...blankOverride(invoice.shipTo) },
    terms: [...(invoice.terms ?? [])],
    notes: invoice.notes ?? '',
    items: invoice.items.map((item) => ({
      skuId: item.skuId ? String(item.skuId) : null,
      name: item.name || item.description,
      description: item.details ?? '',
      hsn: item.hsnCode,
      quantity: item.qty,
      unit: (item.unit || 'NOS').toUpperCase(),
      ratePaise: item.unitPricePaise,
      setupChargePaise: item.setupChargePaise ?? 0,
      taxRate: item.taxRate,
    })),
  };
}

type EditableInvoice = ReturnType<typeof toEditableInvoice>;

/** Consignee block, or null when ship-to is off. Blank name = buyer's name. */
function shipToParty(shipTo: EditableInvoice['shipTo'], buyer: DocumentParty): DocumentParty | null {
  if (!shipTo.enabled) return null;
  return {
    name: shipTo.name || buyer.name,
    addressLines: shipTo.addressLines.length > 0 ? shipTo.addressLines : buyer.addressLines,
    phone: shipTo.phone,
    gstin: shipTo.gstin.toUpperCase(),
    stateName: shipTo.stateName || (shipTo.addressLines.length > 0 ? '' : buyer.stateName),
    stateCode: '',
  };
}

async function invoiceDocumentFor(
  editable: Pick<EditableInvoice, 'customerId' | 'copies' | 'title' | 'layout' | 'status' | 'reverseCharge' | 'buyerOrderNo' | 'dispatch' | 'partyOverride' | 'shipTo' | 'terms' | 'notes' | 'items'> & {
    buyerOrderDate: Date | null;
  },
  meta: { id: string; number: string; date: Date; dueDate: Date | null; amountPaidPaise: number },
) {
  const [seller, customer] = await Promise.all([companyService.documentSeller(), crmRepository.findById(editable.customerId)]);
  const buyer = applyPartyOverride(
    customer ? partyFromCustomer(customer) : { name: 'Unknown customer', addressLines: [], phone: '', gstin: '', stateName: '', stateCode: '' },
    editable.partyOverride,
  );
  return buildInvoiceDocument({
    quote: {
      id: meta.id,
      number: meta.number,
      date: meta.date.toISOString(),
      status: editable.status,
      title: editable.title,
      layout: editable.layout,
      terms: editable.terms,
      notes: editable.notes,
    },
    seller,
    party: buyer,
    lines: editable.items,
    invoice: {
      dueDate: meta.dueDate ? meta.dueDate.toISOString() : null,
      reverseCharge: editable.reverseCharge,
      buyerOrderNo: editable.buyerOrderNo,
      buyerOrderDate: editable.buyerOrderDate ? editable.buyerOrderDate.toISOString() : null,
      dispatch: editable.dispatch,
      shipTo: shipToParty(editable.shipTo, buyer),
      amountPaidPaise: meta.amountPaidPaise,
      copies: editable.copies,
    },
  });
}

/** Captured payments against an invoice (its own id or its order's). */
async function amountPaidFor(invoice: InvoiceDoc): Promise<number> {
  const payments = await paymentsRepository.listPayments(
    { $or: [{ invoiceId: invoice._id }, ...(invoice.orderId ? [{ orderId: invoice.orderId }] : [])], status: 'captured' },
    0,
    500,
  );
  return payments.reduce((sum, payment) => sum + (payment.amountPaise ?? 0), 0);
}

export const paymentsService = {
  /**
   * FIN-1: cuts the tax invoice when an order leaves the bay. Idempotent —
   * returning the existing invoice if one was already issued.
   */
  async invoiceForOrder(orderId: string, _actorId: string) {
    const existing = await paymentsRepository.findInvoiceByOrderId(orderId);
    if (existing) return existing;

    const order = await ordersRepository.findOrderById(orderId);
    if (!order) throw AppError.notFound('Order not found');
    const customer = await crmRepository.findById(String(order.customerId));
    if (!customer) throw AppError.notFound('Customer not found');

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + Math.max(0, customer.paymentTermsDays));

    const invoice = await paymentsRepository.createInvoice({
      invoiceNumber: await nextInvoiceNumber(),
      orderId: order._id,
      customerId: order.customerId,
      financialYear: ISO_PERIOD,
      items: order.items.map((item) => ({
        description: item.skuCode ? `${item.name} (${item.skuCode})`.trim() : item.name,
        hsnCode: '4819',
        qty: item.quantity,
        unit: 'pcs',
        unitPricePaise: item.unitPricePaise,
        taxRate: item.taxRate,
        cgstPaise: Math.round(item.lineTotalPaise === 0 ? 0 : item.lineTotalPaise * (item.taxRate / 2) / (100 + item.taxRate)),
        sgstPaise: Math.round(item.lineTotalPaise === 0 ? 0 : item.lineTotalPaise * (item.taxRate / 2) / (100 + item.taxRate)),
        igstPaise: 0,
        lineTotalPaise: item.lineTotalPaise,
      })),
      placeOfSupply: '33',
      supplierGstin: SUPPLIER_GSTIN,
      customerGstin: customer.gstin ?? '',
      subtotalPaise: order.pricing.subtotalPaise,
      discountPaise: order.pricing.discountPaise,
      cgstPaise: order.pricing.cgstPaise,
      sgstPaise: order.pricing.sgstPaise,
      igstPaise: order.pricing.igstPaise,
      roundOffPaise: order.pricing.roundOffPaise,
      grandTotalPaise: order.pricing.grandTotalPaise,
      amountInWords: amountInWords(order.pricing.grandTotalPaise),
      status: 'unpaid',
      issuedAt: new Date(),
      dueDate,
    });

    await ordersRepository.updateOrder(String(order._id), { invoiceId: invoice._id, 'payment.amountPaidPaise': 0 });
    return invoice;
  },

  /** Records a captured payment and syncs the invoice and order payment state. */
  async recordPayment(
    input: {
      orderId: string;
      amountPaise: number;
      provider: 'razorpay' | 'cash' | 'bank_transfer' | 'cheque';
      method: 'upi' | 'card' | 'netbanking' | 'cod' | 'credit';
      providerOrderId?: string;
      providerPaymentId?: string;
      note?: string;
    },
    _actorId: string,
  ) {
    const order = await ordersRepository.findOrderById(input.orderId);
    if (!order) throw AppError.notFound('Order not found');
    if (input.amountPaise <= 0) throw AppError.validation('Payment amount must be positive');

    const outstanding = order.pricing.grandTotalPaise - order.payment.amountPaidPaise;
    if (input.amountPaise > outstanding + 100) {
      throw AppError.conflict(`Payment of ₹${input.amountPaise / 100} exceeds the outstanding ₹${outstanding / 100}`);
    }

    const payment = await paymentsRepository.createPayment({
      paymentNumber: `PMT-${ISO_PERIOD.replace('-', '')}-${String(await nextCounter('payment', ISO_PERIOD)).padStart(5, '0')}`,
      orderId: order._id,
      invoiceId: order.invoiceId ?? null,
      customerId: order.customerId,
      provider: input.provider,
      method: input.method,
      amountPaise: input.amountPaise,
      status: 'captured',
      providerOrderId: input.providerOrderId ?? '',
      providerPaymentId: input.providerPaymentId ?? '',
      reconciled: true,
      reconciledAt: new Date(),
      methodDetails: input.note ? { note: input.note } : {},
    });

    await this.applyPaymentToOrder(String(order._id), input.amountPaise, payment._id.toString());
    return toObject(payment);
  },

  async applyPaymentToOrder(orderId: string, amountPaise: number, paymentId: string) {
    const order = await ordersRepository.findOrderById(orderId);
    if (!order) throw AppError.notFound('Order not found');
    const totalPaid = order.payment.amountPaidPaise + amountPaise;
    const status = totalPaid >= order.pricing.grandTotalPaise ? 'paid' : 'partial';
    if (order.invoiceId) {
      await paymentsRepository.updateInvoice(String(order.invoiceId), {
        status,
        $addToSet: { paymentIds: paymentId },
      });
    }
    await ordersRepository.updateOrder(orderId, {
      $set: {
        'payment.status': status,
        'payment.paidAt': new Date(),
        'payment.amountPaidPaise': totalPaid,
      },
    });
    return { totalPaid, status };
  },

  async listInvoices(query: Record<string, unknown>) {
    const params = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.customerId) filter.customerId = query.customerId;
    const [invoices, total] = await Promise.all([
      paymentsRepository.listInvoices(filter, params.skip, params.limit, params.sort as string | undefined),
      paymentsRepository.countInvoices(filter),
    ]);
    return { invoices: invoices.map(toObject), meta: buildPageMeta(total, params) };
  },

  async getInvoice(id: string) {
    const invoice = await paymentsRepository.findInvoiceById(id);
    if (!invoice) throw AppError.notFound('Invoice not found');
    return toObject(invoice);
  },

  invoiceSeller: () => companyService.documentSeller(),

  /** An invoice in the editor's shape (lines, dispatch, party/ship-to overrides). */
  async getInvoiceForEdit(id: string) {
    const invoice = await paymentsRepository.findInvoiceById(id);
    if (!invoice) throw AppError.notFound('Invoice not found');
    return {
      _id: String(invoice._id),
      invoiceNumber: invoice.invoiceNumber,
      editable: EDITABLE_INVOICE_STATUSES.includes(invoice.status) && invoice.paymentIds.length === 0,
      ...toEditableInvoice(invoice),
      issueDate: invoice.issuedAt ?? invoice.createdAt,
      dueDate: invoice.dueDate ?? null,
    };
  },

  /** Denormalised printable tax invoice. */
  async getInvoiceDocument(id: string) {
    const invoice = await paymentsRepository.findInvoiceById(id);
    if (!invoice) throw AppError.notFound('Invoice not found');
    return invoiceDocumentFor(toEditableInvoice(invoice), {
      id: String(invoice._id),
      number: invoice.invoiceNumber,
      date: invoice.issuedAt ?? invoice.createdAt,
      dueDate: invoice.dueDate ?? null,
      amountPaidPaise: await amountPaidFor(invoice),
    });
  },

  /** Creates (no id) or fully replaces an invoice from the invoice editor. */
  async saveInvoice(input: SaveInvoiceInput, actorId: string, id?: string) {
    const existing = id ? await paymentsRepository.findInvoiceById(id) : null;
    if (id && !existing) throw AppError.notFound('Invoice not found');
    if (existing && (!EDITABLE_INVOICE_STATUSES.includes(existing.status) || existing.paymentIds.length > 0)) {
      throw AppError.conflict('Invoices with payments recorded cannot be edited; raise a credit note instead');
    }
    const customer = await crmRepository.findById(input.customerId);
    if (!customer) throw AppError.notFound('Customer not found');

    const issuedAt = input.issueDate ?? existing?.issuedAt ?? new Date();
    const doc = await invoiceDocumentFor(input, {
      id: id ?? 'new',
      number: existing?.invoiceNumber ?? 'new',
      date: issuedAt,
      dueDate: input.dueDate,
      amountPaidPaise: 0,
    });
    const pricing = pricingFromDocument(doc);
    const intra = doc.supply === 'intra';

    const fields = {
      customerId: input.customerId,
      orderId: input.orderId,
      quoteId: input.quoteId,
      financialYear: ISO_PERIOD,
      title: input.title,
      layout: input.layout,
      copies: input.copies,
      reverseCharge: input.reverseCharge,
      buyerOrderNo: input.buyerOrderNo,
      buyerOrderDate: input.buyerOrderDate,
      dispatch: input.dispatch,
      partyOverride: input.partyOverride,
      shipTo: input.shipTo,
      terms: input.terms,
      notes: input.notes,
      items: input.items.map((line, index) => {
        const taxable = doc.lines[index]?.amountPaise ?? 0;
        const half = intra ? percentOf(taxable, line.taxRate / 2) : 0;
        const igst = intra ? 0 : percentOf(taxable, line.taxRate);
        return {
          description: line.name,
          name: line.name,
          details: line.description,
          skuId: line.skuId,
          hsnCode: line.hsn,
          qty: line.quantity,
          unit: line.unit,
          unitPricePaise: line.ratePaise,
          setupChargePaise: line.setupChargePaise,
          taxRate: line.taxRate,
          cgstPaise: half,
          sgstPaise: half,
          igstPaise: igst,
          lineTotalPaise: taxable + half * 2 + igst,
        };
      }),
      placeOfSupply: doc.invoice.placeOfSupply.code,
      supplierGstin: doc.seller.gstin,
      customerGstin: doc.party.gstin,
      subtotalPaise: pricing.subtotalPaise,
      discountPaise: 0,
      cgstPaise: pricing.cgstPaise,
      sgstPaise: pricing.sgstPaise,
      igstPaise: pricing.igstPaise,
      roundOffPaise: pricing.roundOffPaise,
      grandTotalPaise: pricing.grandTotalPaise,
      amountInWords: amountInWords(pricing.grandTotalPaise),
      status: input.status,
      issuedAt,
      dueDate: input.dueDate,
      schemaVersion: 2,
    };

    if (existing) {
      const updated = await paymentsRepository.updateInvoice(String(existing._id), fields);
      if (!updated) throw AppError.notFound('Invoice not found');
      return toObject(updated);
    }
    const created = await paymentsRepository.createInvoice({ ...fields, invoiceNumber: await nextInvoiceNumber(), createdBy: actorId });
    return toObject(created);
  },

  /** Manual invoice creation for an order — FIN-1 is idempotent, so this just
   * delegates; the invoice is cut by the payments module itself. */
  async createInvoice(orderId: string, actorId: string) {
    return this.invoiceForOrder(orderId, actorId);
  },

  /** OFF-2: desk bill printing. Cuts the invoice if missing, then tracks each
   * print run (copies) on the invoice. */
  async printInvoiceForOrder(orderId: string, actorId: string, copies = 2) {
    const invoice = await this.invoiceForOrder(orderId, actorId);
    const printed = await paymentsRepository.markInvoicePrinted(String(invoice._id), actorId, copies);
    if (!printed) throw AppError.notFound('Invoice not found');
    return toObject(printed);
  },

  /** OFF-2: whether the bill is cut and how many times it was printed. */
  async getBillStatus(invoiceId: string) {
    const invoice = await paymentsRepository.findInvoiceById(invoiceId);
    if (!invoice) return null;
    return { id: String(invoice._id), printCount: invoice.printCount ?? 0 };
  },

  /** Manual invoice maintenance: due-date changes and status corrections. */
  async updateInvoice(id: string, input: { dueDate?: Date; status?: string }) {
    const invoice = await paymentsRepository.findInvoiceById(id);
    if (!invoice) throw AppError.notFound('Invoice not found');
    const update: Record<string, unknown> = {};
    if (input.dueDate !== undefined) update.dueDate = input.dueDate;
    if (input.status !== undefined) {
      if (!INVOICE_STATUSES.includes(input.status)) throw AppError.validation('Unknown invoice status');
      update.status = input.status;
    }
    const updated = await paymentsRepository.updateInvoice(id, update);
    if (!updated) throw AppError.notFound('Invoice not found');
    return toObject(updated);
  },

  /** Deletes an invoice. Paid/credited invoices are books-kept and protected. */
  async deleteInvoice(id: string) {
    const invoice = await paymentsRepository.findInvoiceById(id);
    if (!invoice) throw AppError.notFound('Invoice not found');
    if (!['unpaid', 'cancelled'].includes(invoice.status)) {
      throw AppError.conflict(`Invoice with status '${invoice.status}' cannot be deleted`);
    }
    await paymentsRepository.deleteInvoice(id);
    return { deleted: true };
  },

  async listPayments(query: Record<string, unknown>) {
    const params = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.orderId) filter.orderId = query.orderId;
    if (query.status) filter.status = query.status;
    const [payments, total] = await Promise.all([
      paymentsRepository.listPayments(filter, params.skip, params.limit, params.sort as string | undefined),
      paymentsRepository.countPayments(filter),
    ]);
    return { payments: payments.map(toObject), meta: buildPageMeta(total, params) };
  },

  async getPayment(id: string) {
    const payment = await paymentsRepository.findPaymentById(id);
    if (!payment) throw AppError.notFound('Payment not found');
    return toObject(payment);
  },

  /** Aging buckets for the finance dashboard. */
  async receivables() {
    const unpaid = await paymentsRepository.listInvoices({ status: { $in: ['unpaid', 'partial', 'overdue'] } }, 0, 1000);
    const today = new Date();
    const buckets = { current: 0, d1_30: 0, d31_60: 0, d60p: 0 };
    for (const invoice of unpaid) {
      const due = invoice.dueDate;
      const days = due ? Math.floor((today.getTime() - due.getTime()) / 86_400_000) : 0;
      if (days <= 0) buckets.current += invoice.grandTotalPaise;
      else if (days <= 30) buckets.d1_30 += invoice.grandTotalPaise;
      else if (days <= 60) buckets.d31_60 += invoice.grandTotalPaise;
      else buckets.d60p += invoice.grandTotalPaise;
    }
    return { buckets, total: totalPaise(buckets) };
  },

  /** Dev-mode Razorpay simulation: creates a provider order id for an order. */
  async createRazorpayOrder(orderId: string) {
    const order = await ordersRepository.findOrderById(orderId);
    if (!order) throw AppError.notFound('Order not found');
    if (order.payment.razorpayOrderId) return { razorpayOrderId: order.payment.razorpayOrderId };
    const razorpayOrderId = `rzp_test_${Math.random().toString(36).slice(2, 12).toUpperCase()}`;
    await ordersRepository.updateOrder(orderId, {
      'payment.razorpayOrderId': razorpayOrderId,
      'payment.method': 'razorpay',
      'payment.status': 'pending',
    });
    return { razorpayOrderId };
  },

  /**
   * Dev-mode capture (what the real webhook does): idempotent cascade that
   * marks the payment captured and pushes the order payment state to paid —
   * without going through the role-restricted domain transition.
   */
  async captureRazorpayPayment(input: { razorpayOrderId: string; razorpayPaymentId: string }, eventId?: string) {
    if (eventId) {
      const existing = await paymentsRepository.findWebhookByEventId(eventId);
      if (existing) return { duplicate: true };
    }
    const order = (await ordersRepository.listOrders({ 'payment.razorpayOrderId': input.razorpayOrderId }, 0, 1))[0];
    if (!order) throw AppError.notFound('No order for this Razorpay order id');
    await paymentsRepository.createPayment({
      paymentNumber: `PMT-${ISO_PERIOD.replace('-', '')}-${String(await nextCounter('payment', ISO_PERIOD)).padStart(5, '0')}`,
      orderId: order._id,
      invoiceId: order.invoiceId ?? null,
      customerId: order.customerId,
      provider: 'razorpay',
      method: 'upi',
      amountPaise: order.pricing.grandTotalPaise,
      status: 'captured',
      providerOrderId: input.razorpayOrderId,
      providerPaymentId: input.razorpayPaymentId,
      reconciled: true,
      reconciledAt: new Date(),
    });
    if (order.invoiceId) {
      await paymentsRepository.updateInvoice(String(order.invoiceId), { status: 'paid', $addToSet: { paymentIds: [] } });
    }
    await ordersRepository.updateOrder(String(order._id), {
      'payment.status': 'paid',
      'payment.paidAt': new Date(),
      'payment.razorpayPaymentId': input.razorpayPaymentId,
      'payment.amountPaidPaise': order.pricing.grandTotalPaise,
      $push: { stateHistory: { from: order.status, to: 'paid', at: new Date(), by: null, reason: 'razorpay payment captured', note: '' } },
      $set: { status: 'paid' },
    });
    return { captured: true };
  },
};

function totalPaise(buckets: { current: number; d1_30: number; d31_60: number; d60p: number }): number {
  return buckets.current + buckets.d1_30 + buckets.d31_60 + buckets.d60p;
}
