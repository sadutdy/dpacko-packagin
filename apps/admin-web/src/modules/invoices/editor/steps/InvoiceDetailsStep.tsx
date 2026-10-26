import { COPY_KINDS, COPY_LABELS, INVOICE_TITLES } from '@ameen/domain';

import { Segmented } from '../../../../components/Segmented.js';
import { titleCase } from '../../../../lib/format.js';
import { Chip, FormField } from '../../../documents/editor/FormField.js';
import { isoDay } from '../../../documents/editor/core.js';
import { INVOICE_LAYOUTS, INVOICE_LAYOUT_IDS } from '../../../documents/invoice-layouts/index.js';
import { INVOICE_EDITABLE_STATUSES, type InvoiceEditableStatus } from '../draft.js';
import type { StepProps } from '../types.js';

const DUE_DAYS = [0, 7, 15, 30, 45];

export function InvoiceDetailsStep({ draft, update, errors, ctx }: StepProps) {
  const set = (patch: Partial<typeof draft>) => update(patch);
  const base = draft.issueDate ? new Date(`${draft.issueDate}T00:00:00`) : new Date();
  const customerTerms = ctx.customer?.paymentTermsDays || undefined;
  const dueOptions = customerTerms && !DUE_DAYS.includes(customerTerms) ? [...DUE_DAYS, customerTerms].sort((a, b) => a - b) : DUE_DAYS;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Invoice number" hint={ctx.documentNumber ? 'Fixed once saved.' : 'Next number in the series, assigned on save.'}>
          <input className="field" value={ctx.documentNumber ?? 'Auto'} disabled />
        </FormField>
        <FormField label="Status" hint="Paid / partial follow recorded payments.">
          <select className="field" value={draft.status} onChange={(e) => set({ status: e.target.value as InvoiceEditableStatus })}>
            {INVOICE_EDITABLE_STATUSES.map((status) => (
              <option key={status} value={status}>{titleCase(status)}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Invoice date" error={errors.issueDate}>
          <input className="field" type="date" value={draft.issueDate} onChange={(e) => set({ issueDate: e.target.value })} />
        </FormField>
        <FormField label="Due date" error={errors.dueDate}>
          <input className="field" type="date" value={draft.dueDate} min={draft.issueDate} onChange={(e) => set({ dueDate: e.target.value })} />
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {dueOptions.map((days) => {
              const value = isoDay(days, base);
              return (
                <Chip key={days} active={draft.dueDate === value} onClick={() => set({ dueDate: value })} title={days === customerTerms ? "Customer's credit terms" : undefined}>
                  {days === 0 ? 'On receipt' : `${days} days`}
                  {days === customerTerms ? ' ★' : ''}
                </Chip>
              );
            })}
          </span>
        </FormField>
        <FormField label="Buyer's order no.">
          <input className="field" value={draft.buyerOrderNo} onChange={(e) => set({ buyerOrderNo: e.target.value })} placeholder="PO / work order" />
        </FormField>
        <FormField label="Buyer's order date">
          <input className="field" type="date" value={draft.buyerOrderDate} onChange={(e) => set({ buyerOrderDate: e.target.value })} />
        </FormField>
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <div>
          <span className="section-label mb-1 block">Document title</span>
          <Segmented label="Document title" value={draft.title} options={INVOICE_TITLES.map((value) => ({ value, label: value }))} onChange={(title) => set({ title })} />
        </div>
        <label className="flex items-center gap-2 text-sm text-app-text">
          <input type="checkbox" checked={draft.reverseCharge} onChange={(e) => set({ reverseCharge: e.target.checked })} />
          Tax payable on reverse charge
        </label>
      </div>

      <div>
        <span className="section-label mb-1 block">Copies to print</span>
        <div className="flex flex-wrap gap-4">
          {COPY_KINDS.map((copy) => (
            <label key={copy} className="flex items-center gap-2 text-sm text-app-text">
              <input
                type="checkbox"
                checked={draft.copies.includes(copy)}
                onChange={(e) =>
                  update((d) => ({
                    ...d,
                    copies: COPY_KINDS.filter((kind) => (kind === copy ? e.target.checked : d.copies.includes(kind))),
                  }))
                }
              />
              {COPY_LABELS[copy]}
            </label>
          ))}
        </div>
        {errors.copies && <p className="mt-1 text-xs text-app-danger-text">{errors.copies}</p>}
      </div>

      <div>
        <span className="section-label mb-2 block">Layout</span>
        <div role="radiogroup" aria-label="Layout" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {INVOICE_LAYOUT_IDS.map((id) => {
            const active = draft.layout === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set({ layout: id })}
                className={`rounded-lg border p-3 text-left transition-colors ${active ? 'border-app-accent bg-app-subtle' : 'border-app-border hover:bg-app-subtle'}`}
              >
                <span className="block text-sm font-semibold text-app-strong">{INVOICE_LAYOUTS[id].label}</span>
                <span className="block text-xs text-app-muted">{INVOICE_LAYOUTS[id].description}</span>
                <span className="mt-1 block text-[10px] uppercase tracking-wide text-app-faint">{INVOICE_LAYOUTS[id].pageSize}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
