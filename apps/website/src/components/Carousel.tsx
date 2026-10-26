import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'motion/react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

export interface Slide {
  eyebrow: string;
  title: string;
  text: string;
  cta: { label: string; href: string };
  accent: string;
  art: 'brand' | 'broast' | 'shawarma' | 'cake';
}

interface Props {
  slides: Slide[];
  intervalMs?: number;
}

const spring = { type: 'spring', stiffness: 90, damping: 16 } as const;

function Art({ kind, accent, reduce }: { kind: Slide['art']; accent: string; reduce: boolean }) {
  const pop = (d: number) => ({
    initial: reduce ? false : { opacity: 0, scale: 0.6, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: { ...spring, delay: 0.25 + d },
  });
  return (
    <motion.svg
      viewBox="0 0 64 64"
      className="h-56 w-56 drop-shadow-2xl sm:h-72 sm:w-72"
      aria-hidden="true"
      animate={reduce ? undefined : { y: [0, -8, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.rect
        width="64"
        height="64"
        rx="14"
        fill={accent}
        {...pop(0)}
        style={{ transformOrigin: '32px 32px' }}
      />
      <motion.path d="M13 21.5 32 32v21L13 42.5Z" fill="#fff" fillOpacity=".72" {...pop(0.1)} />
      <motion.path d="M51 21.5 32 32v21l19-10.5Z" fill="#fff" fillOpacity=".88" {...pop(0.2)} />
      <motion.path d="M32 11 51 21.5 32 32 13 21.5Z" fill="#fff" {...pop(0.3)} />
      {kind === 'brand' && (
        <motion.path
          d="M37 33.5v12.5c4.5-1.6 8-4.4 8-8.4s-3.5-5.6-8-4.1Z"
          fill={accent}
          {...pop(0.45)}
        />
      )}
      {kind === 'broast' && (
        <>
          <motion.circle cx="26" cy="20" r="3" fill={accent} {...pop(0.45)} />
          <motion.circle cx="32" cy="23" r="3" fill={accent} {...pop(0.5)} />
          <motion.circle cx="38" cy="20" r="3" fill={accent} {...pop(0.55)} />
        </>
      )}
      {kind === 'shawarma' && (
        <motion.rect
          x="24"
          y="14"
          width="16"
          height="8"
          rx="4"
          transform="rotate(26 32 18)"
          fill={accent}
          {...pop(0.45)}
        />
      )}
      {kind === 'cake' && (
        <>
          <motion.rect x="25" y="16" width="14" height="7" rx="2" fill={accent} {...pop(0.45)} />
          <motion.path
            d="M25 16c2-5 12-5 14 0"
            stroke={accent}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            {...pop(0.5)}
          />
        </>
      )}
      <motion.path
        d="m22.5 16.25 19 10.5"
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        opacity={kind === 'brand' ? 1 : 0}
      />
    </motion.svg>
  );
}

function Controls({ children }: { children: ReactNode }) {
  return <div className="mt-8 flex items-center gap-4">{children}</div>;
}

export default function Carousel({ slides, intervalMs = 6000 }: Props) {
  const reduce = useReducedMotion() ?? false;
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  const go = useCallback(
    (next: number, d?: number) => {
      const n = (next + count) % count;
      setDir(d ?? (n >= index ? 1 : -1));
      setIndex(n);
    },
    [count, index],
  );

  useEffect(() => {
    if (reduce || paused || count < 2) return;
    const t = setTimeout(() => go(index + 1, 1), intervalMs);
    return () => clearTimeout(t);
  }, [index, paused, reduce, count, intervalMs, go]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -60) go(index + 1, 1);
    else if (info.offset.x > 60) go(index - 1, -1);
  }

  const slide = slides[index];
  if (!slide) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured boxes"
      className="relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, #fff7ed 0%, #fffaf3 45%, ${slide.accent}22 100%)`,
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Crawlable copy for every slide, visually hidden */}
      <div className="sr-only">
        {slides.map((s, i) => (
          <p key={s.title} hidden={i === index}>
            {s.eyebrow}. {s.title}. {s.text}
          </p>
        ))}
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="h-[46rem] sm:h-[38rem] md:h-[34rem]">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={index}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${count}`}
              custom={dir}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * 60 }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * -60 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reduce ? 0 : 0.35 }}
              drag={reduce ? false : 'x'}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={onDragEnd}
              className="grid h-full touch-pan-y items-center gap-8 py-10 md:grid-cols-2 md:py-14"
            >
              <div>
                <motion.p
                  className="text-sm font-semibold tracking-widest uppercase"
                  style={{ color: slide.accent }}
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  {slide.eyebrow}
                </motion.p>
                {index === 0 ? (
                  <h1 className="mt-3 text-4xl leading-tight font-extrabold sm:text-5xl">
                    {slide.title}
                  </h1>
                ) : (
                  <h2 className="mt-3 text-4xl leading-tight font-extrabold sm:text-5xl">
                    {slide.title}
                  </h2>
                )}
                <p className="mt-4 max-w-md text-lg text-stone-600">{slide.text}</p>
                <Controls>
                  <motion.a
                    href={slide.cta.href}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    className="rounded-full px-6 py-3 font-semibold text-white shadow-lg"
                    style={{ background: slide.accent }}
                  >
                    {slide.cta.label}
                  </motion.a>
                </Controls>
              </div>
              <div className="flex justify-center">
                <Art kind={slide.art} accent={slide.accent} reduce={reduce} />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between pb-6">
          <div className="flex gap-2" role="tablist" aria-label="Choose slide">
            {slides.map((s, i) => (
              <button
                key={s.title}
                role="tab"
                aria-selected={i === index}
                aria-label={`Slide ${i + 1}: ${s.eyebrow}`}
                onClick={() => go(i)}
                className="relative h-2.5 overflow-hidden rounded-full bg-stone-300"
                style={{ width: i === index ? 40 : 10, transition: 'width .3s' }}
              >
                {i === index && (
                  <motion.span
                    key={`${index}-${paused}`}
                    className="absolute inset-0 origin-left rounded-full"
                    style={{ background: slide.accent }}
                    initial={{ scaleX: reduce || paused ? 1 : 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{
                      duration: reduce || paused ? 0 : intervalMs / 1000,
                      ease: 'linear',
                    }}
                  />
                )}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => go(index - 1, -1)}
              aria-label="Previous slide"
              className="h-10 w-10 rounded-full border border-stone-300 bg-white hover:bg-stone-100"
            >
              ←
            </button>
            <button
              onClick={() => go(index + 1, 1)}
              aria-label="Next slide"
              className="h-10 w-10 rounded-full border border-stone-300 bg-white hover:bg-stone-100"
            >
              →
            </button>
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        Slide {index + 1} of {count}: {slide.title}
      </p>
    </section>
  );
}
