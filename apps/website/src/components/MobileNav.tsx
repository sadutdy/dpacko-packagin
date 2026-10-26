import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

interface Props {
  links: [string, string][];
  current: string;
  phoneTel: string;
  phoneDisplay: string;
  waHref: string;
}

export default function MobileNav({ links, current, phoneTel, phoneDisplay, waHref }: Props) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const line = { strokeWidth: 2.5, stroke: 'currentColor', strokeLinecap: 'round' } as const;

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 bg-white"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <motion.path
            {...line}
            animate={open ? { d: 'M6 6L18 18' } : { d: 'M4 7H20' }}
            transition={{ duration: reduce ? 0 : 0.2 }}
          />
          <motion.path
            {...line}
            animate={open ? { opacity: 0 } : { opacity: 1 }}
            d="M4 12H20"
            transition={{ duration: reduce ? 0 : 0.2 }}
          />
          <motion.path
            {...line}
            animate={open ? { d: 'M6 18L18 6' } : { d: 'M4 17H20' }}
            transition={{ duration: reduce ? 0 : 0.2 }}
          />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="absolute inset-x-0 top-full z-30 h-screen bg-stone-900/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.nav
              id="mobile-menu"
              aria-label="Main"
              className="absolute inset-x-0 top-full z-40 border-b border-stone-200 bg-paper px-4 pt-2 pb-5 shadow-xl"
              initial={reduce ? false : { opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              <ul>
                {links.map(([href, label], i) => {
                  const active = href === '/' ? current === '/' : current.startsWith(href);
                  return (
                    <motion.li
                      key={href}
                      initial={reduce ? false : { opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + i * 0.05 }}
                    >
                      <a
                        href={href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center justify-between border-b border-stone-200 py-3.5 text-lg font-semibold ${
                          active ? 'text-brand-700' : ''
                        }`}
                      >
                        {label}
                        <span aria-hidden="true" className="text-stone-400">
                          ›
                        </span>
                      </a>
                    </motion.li>
                  );
                })}
              </ul>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <a
                  href={`tel:${phoneTel}`}
                  className="rounded-full border border-stone-300 bg-white py-3 text-center text-sm font-semibold"
                >
                  Call {phoneDisplay}
                </a>
                <a
                  href={waHref}
                  className="rounded-full bg-green-600 py-3 text-center text-sm font-semibold text-white"
                >
                  WhatsApp
                </a>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
