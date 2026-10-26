/** Declaration (left) and "for <company> / Authorised Signatory" (right). */
export function SignatureBlock(props: { sellerName: string; declaration?: string; className?: string }) {
  const { sellerName, declaration, className = '' } = props;
  return (
    <div className={`flex items-start justify-between gap-8 ${className}`}>
      <div className="max-w-[55%]">
        {declaration && (
          <>
            <div className="underline">Declaration</div>
            <p>{declaration}</p>
          </>
        )}
      </div>
      <div className="flex min-h-[5.5em] flex-col items-end justify-between text-right">
        <div className="font-bold">for <span className="uppercase">{sellerName}</span></div>
        <div>Authorised Signatory</div>
      </div>
    </div>
  );
}
