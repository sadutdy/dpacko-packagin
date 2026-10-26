import { Link } from 'react-router-dom';
import { advance } from '@ameen/domain';

import { titleCase } from '../../../../lib/format.js';
import { longDate, money, qty } from '../../../documents/format.js';
import { LAYOUTS } from '../../../documents/layouts/index.js';
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

export function ReviewStep({ draft, ctx }: StepProps) {
  const doc = ctx.doc;
  const warnings: { text: string; to?: string }[] = [];
  if (ctx.seller && (!ctx.seller.name || !ctx.seller.gstin)) warnings.push({ text: 'Company name or GSTIN is missing from the profile.', to: '/settings' });
  if (doc && !doc.party.gstin) warnings.push({ text: 'The buyer has no GSTIN; the quote prints without one.' });
  if (doc && !doc.party.stateCode) warnings.push({ text: "The buyer's state is unknown, so CGST + SGST is assumed." });
  if (draft.lines.some((line) => line.rate.trim() === '0')) warnings.push({ text: 'Some items are priced at ₹0.' });
  const termCount = draft.terms.filter((term) => term.trim()).length;
  const adv = doc && draft.advancePct > 0 ? advance(doc.totals.grandTotalPaise, draft.advancePct) : null;

  return (
    <div className="space-y-4">
      <dl className="divide-y divide-app-border-soft">
        <Row label="Customer" value={doc?.party.name ?? '—'} step="party" goTo={ctx.goTo} />
        <Row
          label="Dates"
          value={`${longDate(doc?.quote.date)}${draft.validUntil ? ` · valid until ${longDate(doc?.quote.validUntil)}` : ''}`}
          step="details"
          goTo={ctx.goTo}
        />
        <Row
          label="Format"
          value={`${draft.title} · ${LAYOUTS[draft.layout].label} · ${titleCase(draft.status)}`}
          step="details"
          goTo={ctx.goTo}
        />
        <Row
          label="Items"
          value={`${draft.lines.length} line${draft.lines.length === 1 ? '' : 's'}${doc?.totals.unit ? ` · ${qty(doc.totals.quantity)} ${doc.totals.unit}` : ''}`}
          step="items"
          goTo={ctx.goTo}
        />
        <Row
          label="Supply"
          value={doc ? (doc.supply === 'intra' ? 'Intra-state (CGST + SGST)' : 'Inter-state (IGST)') : '—'}
          step="party"
          goTo={ctx.goTo}
        />
        <Row label="Grand total" value={doc ? money(doc.totals.grandTotalPaise) : '—'} step="items" goTo={ctx.goTo} />
        <Row label="Advance" value={adv ? `${adv.pct}% · ${money(adv.advancePaise)}` : 'Not requested'} step="terms" goTo={ctx.goTo} />
        <Row label="Terms" value={termCount === 0 ? 'None' : `${termCount} term${termCount === 1 ? '' : 's'}`} step="terms" goTo={ctx.goTo} />
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
