import { useState } from 'react';
import { GST_STATES, partyFromCustomer, resolvePartyState } from '@ameen/domain';

import { useList } from '../../../../lib/useList.js';
import { Chip, FormField } from '../FormField.js';
import type { CoreDraft, CustomerOption, PartyOverrideDraft } from '../core.js';
import type { StepProps } from '../types.js';

export function PartyStep<D extends CoreDraft>({ draft, update, errors, ctx }: StepProps<D>) {
  const [search, setSearch] = useState('');
  const [picking, setPicking] = useState(!draft.customerId);
  const override = draft.partyOverride;
  const hasOverride = Object.values(override).some((value) => value.trim() !== '');
  const [customise, setCustomise] = useState(hasOverride);
  const { rows, loading } = useList<CustomerOption>('/api/v1/crm/customers', { search: search.trim() || undefined }, 1, 12);

  const base = ctx.customer ? resolvePartyState(partyFromCustomer(ctx.customer)) : null;
  const setOverride = (patch: Partial<PartyOverrideDraft>) =>
    update((current) => ({ ...current, partyOverride: { ...current.partyOverride, ...patch } }));

  function choose(customer: CustomerOption) {
    ctx.setCustomer(customer);
    update((current) => ({ ...current, customerId: customer._id }));
    setPicking(false);
  }

  return (
    <div className="space-y-5">
      {ctx.customer && !picking ? (
        <div className="rounded-lg border border-app-accent bg-app-subtle p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm">
              <div className="font-semibold text-app-strong">{ctx.customer.businessName}</div>
              {base?.addressLines.map((line) => <div key={line} className="text-app-muted">{line}</div>)}
              <div className="mt-1 text-xs text-app-faint">
                {[ctx.customer.customerCode, base?.gstin && `GSTIN ${base.gstin}`, base?.stateName].filter(Boolean).join(' · ')}
              </div>
            </div>
            <button type="button" className="btn-small" onClick={() => setPicking(true)}>
              Change
            </button>
          </div>
        </div>
      ) : (
        <FormField label="Customer" error={errors.customerId}>
          <input
            className="field"
            placeholder="Search by name, phone or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="mt-2 max-h-72 divide-y divide-app-border-soft overflow-auto rounded-lg border border-app-border">
            {loading && <p className="p-3 text-sm text-app-muted">Searching…</p>}
            {!loading && rows.length === 0 && <p className="p-3 text-sm text-app-muted">No customers match.</p>}
            {!loading &&
              rows.map((customer) => {
                const party = partyFromCustomer(customer);
                const active = customer._id === draft.customerId;
                return (
                  <button
                    key={customer._id}
                    type="button"
                    onClick={() => choose(customer)}
                    className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-app-subtle ${active ? 'bg-app-subtle' : ''}`}
                  >
                    <span className="font-medium text-app-strong">{customer.businessName}</span>
                    <span className="ml-2 text-xs text-app-faint">{customer.customerCode}</span>
                    <span className="block truncate text-xs text-app-muted">
                      {[party.addressLines.join(', '), customer.gstin].filter(Boolean).join(' · ') || customer.phone}
                    </span>
                  </button>
                );
              })}
          </div>
          {ctx.customer && (
            <button type="button" className="mt-2 text-xs text-app-muted underline" onClick={() => setPicking(false)}>
              Keep {ctx.customer.businessName}
            </button>
          )}
        </FormField>
      )}

      <div>
        <div className="flex items-center justify-between">
          <span className="section-label">Buyer block on the quote</span>
          <Chip active={customise} onClick={() => setCustomise(!customise)}>
            {customise ? 'Customising' : 'Customise'}
          </Chip>
        </div>
        <p className="mt-1 text-xs text-app-faint">
          Leave a field blank to print the customer's own details. Overrides apply to this quote only.
        </p>

        {customise && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Printed name" className="sm:col-span-2">
              <input className="field" value={override.name} placeholder={base?.name} onChange={(e) => setOverride({ name: e.target.value })} />
            </FormField>
            <FormField label="Address (one line per row)" className="sm:col-span-2">
              <textarea
                className="field"
                rows={3}
                value={override.address}
                placeholder={base?.addressLines.join('\n')}
                onChange={(e) => setOverride({ address: e.target.value })}
              />
            </FormField>
            <FormField label="GSTIN" error={errors.gstin}>
              <input
                className="field uppercase"
                value={override.gstin}
                placeholder={base?.gstin || '32AAAAA0000A1Z5'}
                onChange={(e) => setOverride({ gstin: e.target.value })}
                spellCheck={false}
              />
            </FormField>
            <FormField label="State" hint="Decides CGST + SGST or IGST.">
              <select className="field" value={override.stateName} onChange={(e) => setOverride({ stateName: e.target.value })}>
                <option value="">{base?.stateName ? `Customer's (${base.stateName})` : 'From GSTIN / address'}</option>
                {GST_STATES.map((state) => (
                  <option key={state.code} value={state.name}>
                    {state.code} · {state.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Phone">
              <input className="field" value={override.phone} placeholder={base?.phone} onChange={(e) => setOverride({ phone: e.target.value })} />
            </FormField>
            {hasOverride && (
              <div className="flex items-end">
                <button
                  type="button"
                  className="btn-small"
                  onClick={() => setOverride({ name: '', address: '', gstin: '', stateName: '', phone: '' })}
                >
                  Clear overrides
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
