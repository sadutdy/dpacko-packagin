import { GST_STATES } from '@ameen/domain';

import { Chip, FormField } from '../../../documents/editor/FormField.js';
import { PartyStep } from '../../../documents/editor/steps/PartyStep.js';
import type { ShipToDraft } from '../draft.js';
import type { StepProps } from '../types.js';

/** Buyer (shared party step) plus an optional consignee / ship-to block. */
export function InvoicePartyStep(props: StepProps) {
  const { draft, update, errors } = props;
  const ship = draft.shipTo;
  const setShip = (patch: Partial<ShipToDraft>) => update((d) => ({ ...d, shipTo: { ...d.shipTo, ...patch } }));

  return (
    <div className="space-y-6">
      <PartyStep {...props} />

      <div className="border-t border-app-border-soft pt-4">
        <div className="flex items-center justify-between">
          <span className="section-label">Consignee (ship to)</span>
          <Chip active={ship.enabled} onClick={() => setShip({ enabled: !ship.enabled })}>
            {ship.enabled ? 'Different address' : 'Same as buyer'}
          </Chip>
        </div>
        <p className="mt-1 text-xs text-app-faint">
          When goods go elsewhere, the consignee's state becomes the place of supply (decides CGST + SGST or IGST).
        </p>
        {ship.enabled && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Consignee name" className="sm:col-span-2" hint="Blank prints the buyer's name.">
              <input className="field" value={ship.name} onChange={(e) => setShip({ name: e.target.value })} />
            </FormField>
            <FormField label="Delivery address (one line per row)" className="sm:col-span-2">
              <textarea className="field" rows={3} value={ship.address} onChange={(e) => setShip({ address: e.target.value })} />
            </FormField>
            <FormField label="GSTIN" error={errors['shipTo.gstin']}>
              <input className="field uppercase" value={ship.gstin} onChange={(e) => setShip({ gstin: e.target.value })} spellCheck={false} />
            </FormField>
            <FormField label="State">
              <select className="field" value={ship.stateName} onChange={(e) => setShip({ stateName: e.target.value })}>
                <option value="">From GSTIN / buyer</option>
                {GST_STATES.map((state) => (
                  <option key={state.code} value={state.name}>
                    {state.code} · {state.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Phone">
              <input className="field" value={ship.phone} onChange={(e) => setShip({ phone: e.target.value })} />
            </FormField>
          </div>
        )}
      </div>
    </div>
  );
}
