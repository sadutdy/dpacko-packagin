import { motion, useReducedMotion } from 'motion/react';

export default function WhatsAppFab({ href }: { href: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.a
      href={href}
      aria-label="Chat on WhatsApp"
      className="fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full bg-green-600 px-5 py-3 font-semibold text-white shadow-xl"
      initial={reduce ? false : { opacity: 0, scale: 0.6 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: [0, -10, 0] }}
      transition={{ scale: { type: 'spring', delay: 1.5 }, y: { delay: 8, duration: 0.6 } }}
      whileHover={{ scale: 1.06 }}
    >
      <span aria-hidden="true">💬</span> WhatsApp
    </motion.a>
  );
}
