import { QUOTE_TITLES } from '@ameen/domain';

import { Segmented } from '../../../../components/Segmented.js';
import { titleCase } from '../../../../lib/format.js';
import { LAYOUTS, LAYOUT_IDS } from '../../../documents/layouts/index.js';
import { Chip, FormField } from '../../../documents/editor/FormField.js';
import { EDITABLE_STATUSES, isoDay, type EditableStatus } from '../draft.js';
import type { StepProps } from '../types.js';

const VALIDITY_DAYS = [7, 15, 30, 45];

export function DetailsStep({ draft, update, errors, ctx }: StepProps) {
  const base = draft.issueDate ? new Date(`${draft.issueDate}T00:00:00`) : new Date();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Quote number" hint={ctx.documentNumber ? 'Fixed once saved.' : 'Assigned when you save.'}>
          <input className="field" value={ctx.documentNumber ?? 'Auto'} disabled />
        </FormField>
        <FormField label="Ref. No." hint="Customer PO, enquiry or tender number.">
          <input className="field" value={draft.refNo} onChange={(e) => update({ refNo: e.target.value })} placeholder="Optional" />
        </FormField>
        <FormField label="Quote date" error={errors.issueDate}>
          <input className="field" type="date" value={draft.issueDate} onChange={(e) => update({ issueDate: e.target.value })} />
        </FormField>
        <FormField label="Valid until" error={errors.validUntil}>
          <input className="field" type="date" value={draft.validUntil} min={draft.issueDate} onChange={(e) => update({ validUntil: e.target.value })} />
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {VALIDITY_DAYS.map((days) => {
              const value = isoDay(days, base);
              return (
                <Chip key={days} active={draft.validUntil === value} onClick={() => update({ validUntil: value })}>
                  {days} days
                </Chip>
              );
            })}
            <Chip active={!draft.validUntil} onClick={() => update({ validUntil: '' })}>
              No expiry
            </Chip>
          </span>
        </FormField>
        <FormField label="Status">
          <select className="field" value={draft.status} onChange={(e) => update({ status: e.target.value as EditableStatus })}>
            {EDITABLE_STATUSES.map((status) => (
              <option key={status} value={status}>{titleCase(status)}</option>
            ))}
          </select>
        </FormField>
      </div>

      <div>
        <span className="section-label mb-1 block">Document title</span>
        <Segmented
          label="Document title"
          value={draft.title}
          options={QUOTE_TITLES.map((value) => ({ value, label: value }))}
          onChange={(title) => update({ title })}
        />
      </div>

      <div>
        <span className="section-label mb-2 block">Layout</span>
        <div role="radiogroup" aria-label="Layout" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {LAYOUT_IDS.map((id) => {
            const active = draft.layout === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => update({ layout: id })}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  active ? 'border-app-accent bg-app-subtle' : 'border-app-border hover:bg-app-subtle'
                }`}
              >
                <span className="block text-sm font-semibold text-app-strong">{LAYOUTS[id].label}</span>
                <span className="block text-xs text-app-muted">{LAYOUTS[id].description}</span>
                <span className="mt-1 block text-[10px] uppercase tracking-wide text-app-faint">{LAYOUTS[id].pageSize}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
