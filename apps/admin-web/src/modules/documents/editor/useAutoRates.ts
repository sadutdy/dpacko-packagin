import { useEffect, type Dispatch, type SetStateAction } from 'react';

import { api } from '../../../lib/api.js';
import { inputToQty, paiseToInput, type CoreDraft } from './core.js';

/**
 * Keeps catalog lines on "auto" priced by the customer's price rules for
 * their quantity (debounced). Manual rates are never touched.
 */
export function useAutoRates<D extends CoreDraft>(draft: D | null, setDraft: Dispatch<SetStateAction<D | null>>): void {
  const autoKey = draft
    ? `${draft.customerId}|${draft.lines
        .filter((line) => line.skuId && line.autoRate)
        .map((line) => `${line.key}:${line.skuId}:${line.quantity}`)
        .join(',')}`
    : '';

  useEffect(() => {
    if (!draft?.customerId) return;
    const auto = draft.lines.filter((line) => line.skuId && line.autoRate && inputToQty(line.quantity) !== null);
    if (auto.length === 0) return;
    const timer = window.setTimeout(() => {
      api
        .post<{ items: { unitPricePaise: number }[] }>('/api/v1/orders/quotes/preview', {
          customerId: draft.customerId,
          items: auto.map((line) => ({ skuId: line.skuId, quantity: inputToQty(line.quantity) })),
        })
        .then((priced) =>
          setDraft((current) =>
            current && {
              ...current,
              lines: current.lines.map((line) => {
                const index = auto.findIndex((entry) => entry.key === line.key);
                const paise = priced.items[index]?.unitPricePaise;
                return index >= 0 && line.autoRate && paise !== undefined ? { ...line, rate: paiseToInput(paise) } : line;
              }),
            },
          ),
        )
        .catch(() => {
          // Keep the catalog list price when price rules can't be applied.
        });
    }, 400);
    return () => window.clearTimeout(timer);
    // Keyed on autoKey only: it captures every input that changes the request.
  }, [autoKey]);
}
