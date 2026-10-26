import { Link } from 'react-router-dom';
import { COPY_LABELS } from '@ameen/domain';

import { titleCase } from '../../../../lib/format.js';
import { longDate, money } from '../../../documents/format.js';
import { INVOICE_LAYOUTS } from '../../../documents/invoice-layouts/index.js';
import type { InvoiceDocument } from '../../../documents/types.js';
import type { StepProps } from '../types.js';

function Row(props: { label: string; value: string; step: string; goTo: (step: string) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="text-sm text-app-muted">{props.label}</dt>
      <dd className="flex items-start gap-3 text-right text-sm text-app-strong">
        <span>{props.value}</span>
        <button type="button" className="text-xs text-app-accent" onClick={() => props.goTo(props.step)}>
          Edit
        </button>
      </dd>
    </div>
  );
}

export function InvoiceReviewStep({ draft, ctx }: StepProps) {
  const doc = ctx.doc as InvoiceDocument | null;
  const warnings: { text: string; to?: string }[] = [];
  if (ctx.seller && (!ctx.seller.name || !ctx.seller.gstin)) warnings.push({ text: 'Company name or GSTIN is missing from the profile.', to: '/settings' });
  if (ctx.seller && !ctx.seller.bank) warnings.push({ text: 'No bank details on the profile; the invoice prints without them.', to: '/settings' });
  if (doc && !doc.party.gstin) warnings.push({ text: 'The buyer has no GSTIN (B2C invoice).' });
  if (doc && !doc.invoice.placeOfSupply.code) warnings.push({ text: 'Place of supply is unknown, so CGST + SGST is assumed.' });
  if (doc && doc.totals.grandTotalPaise >= 5_000_000 && !draft.dispatch.ewayBillNo.trim()) {
    warnings.push({ text: 'Goods above ₹50,000 usually need an e-way bill number.' });
  }
  const d = draft.dispatch;
  const transport = [d.dispatchedThrough, d.vehicleNo, d.ewayBillNo && `e-Way ${d.ewayBillNo}`].filter(Boolean).join(' · ');

  return (
    <div className="space-y-4">
      <dl className="divide-y divide-app-border-soft">
        <Row label="Buyer" value={doc?.party.name ?? '—'} step="party" goTo={ctx.goTo} />
        <Row label="Ship to" value={doc?.invoice.shipTo?.name ?? 'Same as buyer'} step="party" goTo={ctx.goTo} />
        <Row
          label="Place of supply"
          value={doc ? `${doc.invoice.placeOfSupply.name || '—'} · ${doc.supply === 'intra' ? 'CGST + SGST' : 'IGST'}` : '—'}
          step="party"
          goTo={ctx.goTo}
        />
        <Row
          label="Dates"
          value={`${longDate(doc?.quote.date)}${draft.dueDate ? ` · due ${longDate(doc?.invoice.dueDate)}` : ''}`}
          step="details"
          goTo={ctx.goTo}
        />
        <Row
          label="Format"
          value={`${draft.title} · ${INVOICE_LAYOUTS[draft.layout].label} · ${titleCase(draft.status)}${draft.reverseCharge ? ' · reverse charge' : ''}`}
          step="details"
          goTo={ctx.goTo}
        />
        <Row label="Copies" value={draft.copies.map((copy) => COPY_LABELS[copy].split(' ')[0]).join(', ')} step="details" goTo={ctx.goTo} />
        <Row label="Items" value={`${draft.lines.length} line${draft.lines.length === 1 ? '' : 's'}`} step="items" goTo={ctx.goTo} />
        <Row label="Dispatch" value={transport || 'Not specified'} step="dispatch" goTo={ctx.goTo} />
        <Row label="Total" value={doc ? money(doc.totals.grandTotalPaise) : '—'} step="items" goTo={ctx.goTo} />
      </dl>

      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-app-subtle p-3 text-sm">
          {warnings.map((warning) => (
            <li key={warning.text} className="text-app-text">
              ⚠︎ {warning.text}{' '}
              {warning.to && (
                <Link to={warning.to} className="text-app-accent underline">
                  Fix
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
