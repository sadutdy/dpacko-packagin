import type { QuoteDocument } from '@ameen/domain';

/** Quote terms and remarks from the editor; renders nothing when both are empty. */
export function TermsBlock(props: { doc: QuoteDocument; heading?: string; className?: string }) {
  const { doc, heading = 'Terms & Conditions', className = '' } = props;
  const { terms, notes } = doc.quote;
  if (terms.length === 0 && !notes) return null;
  return (
    <div className={className}>
      {terms.length > 0 && (
        <>
          <div className="underline">{heading}</div>
          <ol className="list-decimal pl-5">
            {terms.map((term, index) => (
              <li key={`${index}-${term}`}>{term}</li>
            ))}
          </ol>
        </>
      )}
      {notes && (
        <p className={terms.length > 0 ? 'mt-1' : ''}>
          <span className="font-bold">Remarks: </span>
          <span className="whitespace-pre-line">{notes}</span>
        </p>
      )}
    </div>
  );
}
