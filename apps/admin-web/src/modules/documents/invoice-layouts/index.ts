import type { InvoiceLayoutProps, LayoutDefinition } from '../types.js';
import { CompactInvoiceLayout } from './CompactInvoiceLayout.js';
import { ModernInvoiceLayout } from './ModernInvoiceLayout.js';
import { TallyInvoiceLayout } from './TallyInvoiceLayout.js';

/**
 * Invoice layout registry. A new layout is one component file plus one entry
 * here; the invoice view, editor picker, print and PDF all read this map.
 */
export const INVOICE_LAYOUTS = {
  tally: {
    label: 'Tally',
    description: 'Boxed GST tax invoice, ruled grid, monochrome.',
    pageSize: 'A4',
    Component: TallyInvoiceLayout,
  },
  modern: {
    label: 'Modern',
    description: 'Logo, accent title, dispatch card, balance due.',
    pageSize: 'A4',
    Component: ModernInvoiceLayout,
  },
  compact: {
    label: 'Compact',
    description: 'Counter bill on A5.',
    pageSize: 'A5',
    Component: CompactInvoiceLayout,
  },
} as const satisfies Record<string, LayoutDefinition<InvoiceLayoutProps>>;

export type InvoiceLayoutId = keyof typeof INVOICE_LAYOUTS;

export const INVOICE_LAYOUT_IDS = Object.keys(INVOICE_LAYOUTS) as InvoiceLayoutId[];

export function isInvoiceLayoutId(value: unknown): value is InvoiceLayoutId {
  return typeof value === 'string' && value in INVOICE_LAYOUTS;
}
