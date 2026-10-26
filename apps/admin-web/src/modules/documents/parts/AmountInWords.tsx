/** "Amount Chargeable (in words)" line with an optional right-hand aside (E. & O.E). */
export function AmountInWords(props: { label: string; words: string; aside?: string; inline?: boolean; className?: string }) {
  const { label, words, aside, inline = false, className = '' } = props;
  if (inline) {
    return (
      <div className={className}>
        <span>{label} : </span>
        <span className="font-bold">{words}</span>
      </div>
    );
  }
  return (
    <div className={className}>
      <div className="flex justify-between">
        <span>{label}</span>
        {aside && <span className="italic">{aside}</span>}
      </div>
      <div className="font-bold">{words}</div>
    </div>
  );
}
