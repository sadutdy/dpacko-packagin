import type { FC } from 'react';

import type { StepProps } from '../types.js';
import { DetailsStep } from './DetailsStep.js';
import { ItemsStep } from '../../../documents/editor/steps/ItemsStep.js';
import { PartyStep } from '../../../documents/editor/steps/PartyStep.js';
import { ReviewStep } from './ReviewStep.js';
import { TermsStep } from './TermsStep.js';

export interface StepDefinition {
  id: string;
  label: string;
  hint: string;
  Component: FC<StepProps>;
}

/**
 * Wizard steps, in order. Each step's validation lives in `validateStep`
 * under the same id; adding a step is one component plus one entry here.
 */
export const STEPS: StepDefinition[] = [
  { id: 'party', label: 'Customer', hint: 'Who the quote is for and how the buyer block prints.', Component: PartyStep },
  { id: 'details', label: 'Details', hint: 'Number, dates, status, title and layout.', Component: DetailsStep },
  { id: 'items', label: 'Items', hint: 'Products, quantities, rates and GST.', Component: ItemsStep },
  { id: 'terms', label: 'Terms', hint: 'Advance, terms and remarks.', Component: TermsStep },
  { id: 'review', label: 'Review', hint: 'Check everything, then save.', Component: ReviewStep },
];
