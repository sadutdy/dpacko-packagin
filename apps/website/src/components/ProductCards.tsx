import { motion, useReducedMotion } from 'motion/react';

import type { Product } from '../data/products';

export default function ProductCards({ products }: { products: Product[] }) {
  const reduce = useReducedMotion();
  return (
    <motion.ul
      className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
      initial={reduce ? false : 'hidden'}
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      variants={{ show: { transition: { staggerChildren: 0.12 } } }}
    >
      {products.map((p) => (
        <motion.li
          key={p.slug}
          variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }}
          whileHover={reduce ? undefined : { y: -6, rotateX: 3, rotateY: -3 }}
          style={{ transformPerspective: 800 }}
          className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
        >
          <a href={`/products/${p.slug}`} className="block">
            {p.image ? (
              <img
                src={p.image.src}
                alt={p.image.alt}
                width={p.image.width}
                height={p.image.height}
                loading="lazy"
                className="mb-4 h-48 w-full rounded-xl object-cover object-bottom"
              />
            ) : (
              <div
                className="mb-4 flex h-48 items-center justify-center rounded-xl text-5xl text-white"
                style={{ background: p.accent }}
                aria-hidden="true"
              >
                ▣
              </div>
            )}
            <h3 className="text-xl font-bold">{p.name}</h3>
            <p className="mt-1 text-stone-600">{p.tagline}</p>
            <p className="mt-4 text-sm font-semibold text-brand-700">View sizes →</p>
          </a>
        </motion.li>
      ))}
    </motion.ul>
  );
}
