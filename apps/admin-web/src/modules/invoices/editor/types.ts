import type { DraftUpdate as SharedDraftUpdate, StepProps as SharedStepProps } from '../../documents/editor/types.js';
import type { InvoiceDraft } from './draft.js';

export type { EditorContext } from '../../documents/editor/types.js';
export type DraftUpdate = SharedDraftUpdate<InvoiceDraft>;
export type StepProps = SharedStepProps<InvoiceDraft>;
