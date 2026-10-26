import { motion, useReducedMotion } from 'motion/react';

export default function Coverage({ districts }: { districts: readonly string[] }) {
  const reduce = useReducedMotion();
  return (
    <ul className="flex flex-wrap gap-2">
      {districts.map((d, i) => (
        <motion.li
          key={d}
          initial={reduce ? false : { opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.04, type: 'spring', stiffness: 200, damping: 18 }}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
            d === 'Malappuram'
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-stone-300 bg-white'
          }`}
        >
          {d}
        </motion.li>
      ))}
    </ul>
  );
}
