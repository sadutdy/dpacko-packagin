import { AnimatePresence, motion } from 'motion/react';
import { useState, type FormEvent } from 'react';

interface Props {
  whatsapp: string;
  products: string[];
}

// Phase 1: no API yet — the enquiry is composed into a WhatsApp message.
export default function EnquiryForm({ whatsapp, products }: Props) {
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = [
      `Hi D PACKO, I'd like a quote.`,
      `Name: ${String(f.get('name') ?? '')}`,
      `Shop/Business: ${String(f.get('business') ?? '')}`,
      `Product: ${String(f.get('product') ?? '')}`,
      `Quantity: ${String(f.get('qty') ?? '')}`,
      `Type: ${String(f.get('type') ?? '')}`,
      `District: ${String(f.get('district') ?? '')}`,
    ].join('\n');
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    setSent(true);
  }

  const field = 'w-full rounded-lg border border-stone-300 bg-white px-3 py-2';
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Your name</span>
        <input name="name" required className={field} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Shop / business</span>
        <input name="business" className={field} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Product</span>
          <select name="product" className={field}>
            {products.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Quantity</span>
          <input name="qty" required placeholder="e.g. 1000" className={field} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Buying as</span>
          <select name="type" className={field}>
            <option>Wholesale</option>
            <option>Retail</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">District</span>
          <input name="district" className={field} />
        </label>
      </div>
      <motion.button
        type="submit"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="rounded-full bg-brand-600 px-6 py-3 font-semibold text-white"
      >
        Send enquiry on WhatsApp
      </motion.button>
      <AnimatePresence>
        {sent && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="font-medium text-green-700"
          >
            Opening WhatsApp — press send to reach us.
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}
