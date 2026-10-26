import type { FC } from 'react';

import { ItemsStep } from '../../../documents/editor/steps/ItemsStep.js';
import type { StepProps } from '../types.js';
import { DispatchStep } from './DispatchStep.js';
import { InvoiceDetailsStep } from './InvoiceDetailsStep.js';
import { InvoicePartyStep } from './InvoicePartyStep.js';
import { InvoiceReviewStep } from './InvoiceReviewStep.js';
import { InvoiceTermsStep } from './InvoiceTermsStep.js';

export interface StepDefinition {
  id: string;
  label: string;
  hint: string;
  Component: FC<StepProps>;
}

/** Invoice wizard steps; validation lives in `validateStep` under the same ids. */
export const INVOICE_STEPS: StepDefinition[] = [
  { id: 'party', label: 'Customer', hint: 'Buyer, printed buyer block and consignee.', Component: InvoicePartyStep },
  { id: 'details', label: 'Details', hint: 'Number, dates, buyer order, title, copies and layout.', Component: InvoiceDetailsStep },
  { id: 'items', label: 'Items', hint: 'Goods, quantities, rates and GST.', Component: ItemsStep },
  { id: 'dispatch', label: 'Dispatch', hint: 'Payment terms, transport and e-way bill (all optional).', Component: DispatchStep },
  { id: 'terms', label: 'Terms', hint: 'Terms and remarks.', Component: InvoiceTermsStep },
  { id: 'review', label: 'Review', hint: 'Check everything, then save.', Component: InvoiceReviewStep },
];
