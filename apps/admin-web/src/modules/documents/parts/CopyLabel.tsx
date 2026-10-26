import { COPY_LABELS, type CopyKind } from '@ameen/domain';

/** "(ORIGINAL FOR RECIPIENT)" — which printed copy this sheet is. */
export function CopyLabel(props: { copy: CopyKind | null; className?: string }) {
  if (!props.copy) return null;
  return <span className={`text-[0.85em] italic uppercase ${props.className ?? ''}`}>({COPY_LABELS[props.copy]})</span>;
}
