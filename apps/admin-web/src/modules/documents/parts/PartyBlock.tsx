import type { DocumentParty } from '@ameen/domain';

/** Buyer block. `tally` mirrors the "Party :" key/value grid of the reference. */
export function PartyBlock(props: { party: DocumentParty; variant?: 'tally' | 'stacked'; label?: string; className?: string }) {
  const { party, variant = 'stacked', label = 'Bill to', className = '' } = props;

  if (variant === 'tally') {
    return (
      <div className={`grid grid-cols-[auto_auto_1fr] gap-x-2 ${className}`}>
        <span>Party</span>
        <span>:</span>
        <div>
          <div className="font-bold uppercase">{party.name}</div>
          {party.addressLines.map((line, index) => (
            <div key={line} className={index === party.addressLines.length - 1 ? 'underline' : ''}>{line}</div>
          ))}
        </div>
        {party.gstin && (
          <>
            <span>GSTIN/UIN</span>
            <span>:</span>
            <span>{party.gstin}</span>
          </>
        )}
        {party.stateName && (
          <>
            <span>State Name</span>
            <span>:</span>
            <span>
              {party.stateName}, Code : {party.stateCode}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-60">{label}</div>
      <div className="font-bold">{party.name}</div>
      {party.addressLines.map((line) => (
        <div key={line}>{line}</div>
      ))}
      {party.gstin && <div>GSTIN: {party.gstin}</div>}
      {party.stateName && (
        <div>
          {party.stateName} ({party.stateCode})
        </div>
      )}
    </div>
  );
}
