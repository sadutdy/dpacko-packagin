import type { InvoiceDocument } from '@ameen/domain';

import { docDate } from '../format.js';

interface Cell {
  label: string;
  value: string;
  wide?: boolean;
}

/** Invoice facts as label/value cells (Tally's right-hand header block). */
export function invoiceMetaCells(doc: InvoiceDocument): Cell[] {
  const { invoice } = doc;
  const d = invoice.dispatch;
  return [
    { label: 'Invoice No.', value: doc.quote.number },
    { label: 'Dated', value: docDate(doc.quote.date) },
    { label: 'Delivery Note', value: d.deliveryNote },
    { label: 'Mode/Terms of Payment', value: d.paymentTerms },
    { label: "Buyer's Order No.", value: invoice.buyerOrderNo },
    { label: 'Dated', value: invoice.buyerOrderDate ? docDate(invoice.buyerOrderDate) : '' },
    { label: 'Dispatch Doc No.', value: d.dispatchDocNo },
    { label: 'Due Date', value: invoice.dueDate ? docDate(invoice.dueDate) : '' },
    { label: 'Dispatched through', value: d.dispatchedThrough },
    { label: 'Destination', value: d.destination },
    { label: 'Vehicle No.', value: d.vehicleNo },
    { label: 'e-Way Bill No.', value: d.ewayBillNo },
    { label: 'Terms of Delivery', value: d.termsOfDelivery, wide: true },
  ];
}

/** Ruled 2-column grid of invoice facts; empty values keep their cell. */
export function InvoiceMetaGrid(props: { doc: InvoiceDocument; className?: string }) {
  return (
    <div className={`grid grid-cols-2 ${props.className ?? ''}`}>
      {invoiceMetaCells(props.doc).map((cell, index) => (
        <div
          key={`${cell.label}-${index}`}
          className={`min-h-[2.6em] border-b border-black px-1.5 py-0.5 last:border-b-0 ${cell.wide ? 'col-span-2' : index % 2 === 0 ? 'border-r' : ''}`}
        >
          <div className="text-[0.85em]">{cell.label}</div>
          <div className="font-bold">{cell.value}</div>
        </div>
      ))}
    </div>
  );
}
