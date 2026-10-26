import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';

const TABS = {
  wholesale: {
    label: 'Wholesale',
    points: [
      'Volume pricing on 500–5,000+ box runs',
      'Custom logo printing available',
      'Credit terms on approval',
      'Delivery across all 14 districts',
    ],
    href: '/wholesale',
  },
  retail: {
    label: 'Retail',
    points: [
      'Small packs from 25 pieces',
      'Pick up from Melmuri, Malappuram',
      'Ready stock on popular sizes',
      'Order quickly on WhatsApp',
    ],
    href: '/retail',
  },
} as const;

type Key = keyof typeof TABS;

export default function AudienceToggle() {
  const [tab, setTab] = useState<Key>('wholesale');
  const active = TABS[tab];

  return (
    <div>
      <div role="tablist" className="inline-flex rounded-full bg-stone-200 p-1">
        {(Object.keys(TABS) as Key[]).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className="relative rounded-full px-6 py-2 font-semibold"
          >
            {tab === key && (
              <motion.span
                layoutId="audience-pill"
                className="absolute inset-0 rounded-full bg-white shadow"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{TABS[key].label}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="mt-6"
        >
          <ul className="space-y-2 text-lg">
            {active.points.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="text-brand-600">✓</span>
                {p}
              </li>
            ))}
          </ul>
          <a href={active.href} className="mt-5 inline-block font-semibold text-brand-700">
            Learn more →
          </a>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
