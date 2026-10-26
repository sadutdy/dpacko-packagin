import { add, multiply } from '@ameen/domain';

import { amount, money } from '../../format.js';
import { FormField } from '../FormField.js';
import {
  GST_SLABS,
  UNITS,
  inputToPaise,
  inputToQty,
  lineFromSku,
  newLine,
  type LineDraft,
} from '../core.js';
import type { CoreDraft } from '../core.js';
import type { StepProps } from '../types.js';

function lineAmount(line: LineDraft): number | null {
  const qty = inputToQty(line.quantity);
  const rate = inputToPaise(line.rate);
  if (qty === null || rate === null) return null;
  return add(multiply(rate, qty), inputToPaise(line.setupCharge) ?? 0);
}

function IconButton(props: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: string }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className={`h-7 w-7 rounded-md border border-app-border text-sm leading-none disabled:opacity-30 ${
        props.danger ? 'text-app-danger-text hover:bg-app-subtle' : 'text-app-text hover:bg-app-subtle'
      }`}
    >
      {props.children}
    </button>
  );
}

export function ItemsStep<D extends CoreDraft>({ draft, update, errors, ctx }: StepProps<D>) {
  const lines = draft.lines;
  const setLines = (next: (current: LineDraft[]) => LineDraft[]) => update((d) => ({ ...d, lines: next(d.lines) }));
  const patchLine = (key: string, patch: Partial<LineDraft>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  const move = (index: number, delta: number) =>
    setLines((current) => {
      const next = [...current];
      const [line] = next.splice(index, 1);
      if (line) next.splice(index + delta, 0, line);
      return next;
    });

  function pickSku(line: LineDraft, skuId: string) {
    if (!skuId) {
      patchLine(line.key, { skuId: null, autoRate: false });
      return;
    }
    const sku = ctx.skus.find((option) => option._id === skuId);
    if (sku) setLines((current) => current.map((entry) => (entry.key === line.key ? lineFromSku(sku, entry) : entry)));
  }

  const err = (index: number, field: string) => errors[`lines.${index}.${field}`];

  return (
    <div className="space-y-4">
      {errors.lines && <p className="text-sm text-app-danger-text">{errors.lines}</p>}

      {lines.map((line, index) => {
        const lineTotal = lineAmount(line);
        return (
          <fieldset key={line.key} className="rounded-lg border border-app-border p-3">
            <legend className="sr-only">Item {index + 1}</legend>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-app-strong">
                {index + 1}. {line.name || 'New item'}
              </span>
              <span className="flex gap-1">
                <IconButton label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>↑</IconButton>
                <IconButton label="Move down" disabled={index === lines.length - 1} onClick={() => move(index, 1)}>↓</IconButton>
                <IconButton
                  label="Duplicate"
                  onClick={() => setLines((current) => [...current.slice(0, index + 1), newLine({ ...line, key: undefined }), ...current.slice(index + 1)])}
                >
                  ⧉
                </IconButton>
                <IconButton
                  label="Remove"
                  danger
                  disabled={lines.length === 1}
                  onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}
                >
                  ×
                </IconButton>
              </span>
            </div>

            <div className="grid grid-cols-6 gap-3">
              <FormField label="Catalog product" className="col-span-6">
                <select className="field" value={line.skuId ?? ''} onChange={(e) => pickSku(line, e.target.value)}>
                  <option value="">Custom item (not in catalog)</option>
                  {ctx.skus.map((sku) => (
                    <option key={sku._id} value={sku._id}>
                      {sku.name} · {sku.skuCode}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Name on quote" error={err(index, 'name')} className="col-span-6 sm:col-span-4">
                <input className="field" value={line.name} onChange={(e) => patchLine(line.key, { name: e.target.value })} />
              </FormField>
              <FormField label="HSN/SAC" className="col-span-3 sm:col-span-2">
                <input className="field" value={line.hsn} onChange={(e) => patchLine(line.key, { hsn: e.target.value })} inputMode="numeric" />
              </FormField>
              <FormField label="Description" className="col-span-6" hint="Size, print, material — printed under the name.">
                <input className="field" value={line.description} onChange={(e) => patchLine(line.key, { description: e.target.value })} />
              </FormField>
              <FormField label="Quantity" error={err(index, 'quantity')} className="col-span-3 sm:col-span-2">
                <input
                  className="field"
                  type="number"
                  min={1}
                  step={1}
                  value={line.quantity}
                  onChange={(e) => patchLine(line.key, { quantity: e.target.value })}
                />
              </FormField>
              <FormField label="Unit" className="col-span-3 sm:col-span-2">
                <input
                  className="field uppercase"
                  list="quote-units"
                  value={line.unit}
                  onChange={(e) => patchLine(line.key, { unit: e.target.value.toUpperCase() })}
                />
              </FormField>
              <FormField label="GST %" className="col-span-3 sm:col-span-2">
                <select className="field" value={line.taxRate} onChange={(e) => patchLine(line.key, { taxRate: Number(e.target.value) })}>
                  {GST_SLABS.map((slab) => (
                    <option key={slab} value={slab}>{slab}%</option>
                  ))}
                </select>
              </FormField>
              <FormField
                label="Rate ₹ / unit"
                error={err(index, 'rate')}
                className="col-span-3 sm:col-span-3"
                hint={
                  line.skuId ? (
                    line.autoRate ? (
                      'From price rules'
                    ) : (
                      <button type="button" className="underline" onClick={() => ctx.resetRate(line.key)}>
                        Use price rules
                      </button>
                    )
                  ) : undefined
                }
              >
                <input
                  className="field"
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.rate}
                  onChange={(e) => patchLine(line.key, { rate: e.target.value, autoRate: false })}
                />
              </FormField>
              <FormField label="Setup / plate ₹" error={err(index, 'setupCharge')} className="col-span-3 sm:col-span-3" hint="One-time, taxable.">
                <input
                  className="field"
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.setupCharge}
                  placeholder="0"
                  onChange={(e) => patchLine(line.key, { setupCharge: e.target.value })}
                />
              </FormField>
            </div>
            <div className="mt-2 text-right text-sm text-app-muted">
              Amount <span className="font-semibold tabular-nums text-app-strong">{lineTotal === null ? '—' : amount(lineTotal)}</span>
            </div>
          </fieldset>
        );
      })}

      <datalist id="quote-units">
        {UNITS.map((unit) => <option key={unit} value={unit} />)}
      </datalist>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={() => setLines((current) => [...current, newLine()])}>
          + Add item
        </button>
        {ctx.skus.length > 0 && (
          <select
            className="field w-auto"
            value=""
            aria-label="Add catalog product"
            onChange={(e) => {
              const sku = ctx.skus.find((option) => option._id === e.target.value);
              if (sku) setLines((current) => [...current, lineFromSku(sku)]);
            }}
          >
            <option value="">+ Add from catalog…</option>
            {ctx.skus.map((sku) => (
              <option key={sku._id} value={sku._id}>{sku.name}</option>
            ))}
          </select>
        )}
      </div>

      {ctx.doc && (
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-lg bg-app-subtle p-3 text-sm">
          <dt className="text-app-muted">Taxable value</dt>
          <dd className="text-right tabular-nums">{amount(ctx.doc.totals.taxablePaise)}</dd>
          {ctx.doc.taxes.map((tax) => (
            <div key={`${tax.label}-${tax.ratePct}`} className="contents">
              <dt className="text-app-muted">{tax.label} @ {tax.ratePct}%</dt>
              <dd className="text-right tabular-nums">{amount(tax.amountPaise)}</dd>
            </div>
          ))}
          <dt className="font-semibold text-app-strong">Grand total</dt>
          <dd className="text-right font-semibold tabular-nums text-app-strong">{money(ctx.doc.totals.grandTotalPaise)}</dd>
        </dl>
      )}
    </div>
  );
}
