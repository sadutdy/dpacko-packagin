import type { DocumentSeller } from '@ameen/domain';

/** "Company's Bank Details" block; renders nothing without bank details. */
export function BankDetails(props: { seller: DocumentSeller; heading?: string; className?: string }) {
  const { seller, heading = "Company's Bank Details", className = '' } = props;
  const bank = seller.bank;
  if (!bank) return null;
  const rows: [string, string][] = [
    ["A/c Holder's Name", seller.name],
    ['Bank Name', bank.bankName],
    ['A/c No.', bank.accountNo],
    ['Branch & IFS Code', [bank.branch, bank.ifsc].filter(Boolean).join(' & ')],
  ];
  return (
    <div className={className}>
      <div>{heading}</div>
      <dl className="grid grid-cols-[auto_auto_1fr] gap-x-2">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt>{label}</dt>
            <dd>:</dd>
            <dd className="font-bold">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
