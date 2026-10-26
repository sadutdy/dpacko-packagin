import type { DocumentSeller } from '@ameen/domain';

import { localPhone } from '../format.js';

/** Seller identity: name, address, phone, GSTIN and state. */
export function SellerBlock(props: { seller: DocumentSeller; align?: 'center' | 'left' | 'right'; showLogo?: boolean; className?: string }) {
  const { seller, align = 'center', showLogo = false, className = '' } = props;
  const alignClass = align === 'center' ? 'text-center items-center' : align === 'right' ? 'text-right items-end' : 'text-left items-start';
  return (
    <div className={`flex flex-col ${alignClass} ${className}`}>
      {showLogo && seller.logo && <img src={seller.logo} alt="" crossOrigin="anonymous" className="mb-2 h-12 max-w-[10rem] object-contain" />}
      <div className="font-bold uppercase">{seller.name || 'Company name not set'}</div>
      {seller.addressLines.map((line) => (
        <div key={line}>{line}</div>
      ))}
      {seller.phone && <div>MOB:{localPhone(seller.phone)}</div>}
      {seller.gstin && <div>GSTIN/UIN: {seller.gstin}</div>}
      {seller.stateName && (
        <div className="underline">
          State Name : {seller.stateName}, Code : {seller.stateCode}
        </div>
      )}
    </div>
  );
}
