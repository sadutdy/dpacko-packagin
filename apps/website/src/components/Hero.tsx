import { motion, useReducedMotion } from 'motion/react';

const spring = { type: 'spring', stiffness: 90, damping: 14 } as const;

interface Props {
  waHref: string;
}

export default function Hero({ waHref }: Props) {
  const reduce = useReducedMotion();
  const face = (delay: number, from: { x?: number; y?: number }) => ({
    initial: reduce ? false : { opacity: 0, ...from },
    animate: { opacity: 1, x: 0, y: 0 },
    transition: { ...spring, delay },
  });

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-paper to-brand-100">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
        <div>
          <motion.p
            className="text-sm font-semibold tracking-widest text-brand-700 uppercase"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            Malappuram · Serving all Kerala
          </motion.p>
          <motion.h1
            className="mt-3 text-4xl leading-tight font-extrabold sm:text-5xl"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.75 }}
          >
            Food packaging boxes, <span className="text-brand-600">wholesale &amp; retail</span>
          </motion.h1>
          <motion.p
            className="mt-4 max-w-md text-lg text-stone-600"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.9 }}
          >
            Broast boxes, shawarma boxes and cake boxes for restaurants, bakeries and cloud kitchens
            across Kerala.
          </motion.p>
          <motion.div
            className="mt-8 flex flex-wrap gap-3"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 1.05 }}
          >
            <motion.a
              href={waHref}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="rounded-full bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/30"
            >
              Get a quote on WhatsApp
            </motion.a>
            <motion.a
              href="/products"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="rounded-full border border-stone-300 bg-white px-6 py-3 font-semibold"
            >
              View products
            </motion.a>
          </motion.div>
        </div>

        <div className="flex justify-center" aria-hidden="true">
          <motion.svg
            viewBox="0 0 64 64"
            className="h-64 w-64 drop-shadow-2xl sm:h-80 sm:w-80"
            animate={reduce ? undefined : { y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          >
            <defs>
              <linearGradient id="hero-bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#f59e0b" />
                <stop offset="1" stopColor="#c2410c" />
              </linearGradient>
            </defs>
            <motion.rect
              width="64"
              height="64"
              rx="14"
              fill="url(#hero-bg)"
              initial={reduce ? false : { scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={spring}
              style={{ transformOrigin: '32px 32px' }}
            />
            <motion.path d="M13 21.5 32 32v21L13 42.5Z" fill="#fff" fillOpacity=".72" {...face(0.15, { x: -10 })} />
            <motion.path d="M51 21.5 32 32v21l19-10.5Z" fill="#fff" fillOpacity=".88" {...face(0.3, { x: 10 })} />
            <motion.path d="M32 11 51 21.5 32 32 13 21.5Z" fill="#fff" {...face(0.45, { y: -12 })} />
            <motion.path
              d="m22.5 16.25 19 10.5"
              stroke="#c2410c"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            />
            <motion.path
              d="M37 33.5v12.5c4.5-1.6 8-4.4 8-8.4s-3.5-5.6-8-4.1Z"
              fill="#c2410c"
              {...face(0.7, { y: 6 })}
            />
          </motion.svg>
        </div>
      </div>
    </section>
  );
}
