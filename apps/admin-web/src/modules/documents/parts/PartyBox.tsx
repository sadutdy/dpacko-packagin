import type { DocumentParty } from '@ameen/domain';

/** Tally-style buyer/consignee cell: small heading, bold name, GSTIN and state. */
export function PartyBox(props: { heading: string; party: DocumentParty; className?: string }) {
  const { heading, party, className = '' } = props;
  return (
    <div className={className}>
      <div className="text-[0.9em]">{heading}</div>
      <div className="font-bold uppercase">{party.name}</div>
      {party.addressLines.map((line) => (
        <div key={line}>{line}</div>
      ))}
      {party.gstin && <div>GSTIN/UIN : {party.gstin}</div>}
      {party.stateName && (
        <div>
          State Name : {party.stateName}, Code : {party.stateCode}
        </div>
      )}
    </div>
  );
}
