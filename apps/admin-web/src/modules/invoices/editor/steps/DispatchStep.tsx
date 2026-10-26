import type { InvoiceDispatch } from '@ameen/domain';

import { Chip, FormField } from '../../../documents/editor/FormField.js';
import type { StepProps } from '../types.js';

const PAYMENT_TERMS = ['Immediate', '15 days credit', '30 days credit', 'Against delivery', 'Advance received'];
const CARRIERS = ['Own vehicle', 'By hand', 'Courier', 'Transport'];

/** Delivery and transport facts printed in the invoice header block. All optional. */
export function DispatchStep({ draft, update, errors }: StepProps) {
  const d = draft.dispatch;
  const set = (patch: Partial<InvoiceDispatch>) => update((current) => ({ ...current, dispatch: { ...current.dispatch, ...patch } }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Mode / terms of payment" className="sm:col-span-2">
          <input className="field" value={d.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} />
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {PAYMENT_TERMS.map((term) => (
              <Chip key={term} active={d.paymentTerms === term} onClick={() => set({ paymentTerms: term })}>
                {term}
              </Chip>
            ))}
          </span>
        </FormField>
        <FormField label="Delivery note">
          <input className="field" value={d.deliveryNote} onChange={(e) => set({ deliveryNote: e.target.value })} placeholder="Challan / DN no." />
        </FormField>
        <FormField label="Dispatch doc no.">
          <input className="field" value={d.dispatchDocNo} onChange={(e) => set({ dispatchDocNo: e.target.value })} placeholder="LR / docket no." />
        </FormField>
        <FormField label="Dispatched through">
          <input className="field" value={d.dispatchedThrough} onChange={(e) => set({ dispatchedThrough: e.target.value })} />
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {CARRIERS.map((carrier) => (
              <Chip key={carrier} active={d.dispatchedThrough === carrier} onClick={() => set({ dispatchedThrough: carrier })}>
                {carrier}
              </Chip>
            ))}
          </span>
        </FormField>
        <FormField label="Destination">
          <input className="field" value={d.destination} onChange={(e) => set({ destination: e.target.value })} />
        </FormField>
        <FormField label="Vehicle no.">
          <input className="field uppercase" value={d.vehicleNo} onChange={(e) => set({ vehicleNo: e.target.value.toUpperCase() })} placeholder="KL-10-AB-1234" />
        </FormField>
        <FormField label="e-Way bill no." error={errors.ewayBillNo} hint="Needed above the e-way bill threshold.">
          <input className="field" inputMode="numeric" value={d.ewayBillNo} onChange={(e) => set({ ewayBillNo: e.target.value })} />
        </FormField>
        <FormField label="Terms of delivery" className="sm:col-span-2">
          <textarea className="field" rows={2} value={d.termsOfDelivery} onChange={(e) => set({ termsOfDelivery: e.target.value })} placeholder="Door delivery, freight paid…" />
        </FormField>
      </div>
    </div>
  );
}
