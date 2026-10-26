import type { DraftUpdate as SharedDraftUpdate, StepProps as SharedStepProps } from '../../documents/editor/types.js';
import type { QuoteDraft } from './draft.js';

export type { EditorContext } from '../../documents/editor/types.js';
export type DraftUpdate = SharedDraftUpdate<QuoteDraft>;
export type StepProps = SharedStepProps<QuoteDraft>;
