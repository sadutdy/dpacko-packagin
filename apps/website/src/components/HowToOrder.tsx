import { motion, useReducedMotion, useScroll, useSpring, type Variants } from 'motion/react';
import { useRef, type ReactNode } from 'react';

export interface OrderStep {
  title: string;
  text: string;
}

const spring = { type: 'spring', stiffness: 120, damping: 14 } as const;

function useDraw(reduce: boolean): Variants {
  return {
    hidden: reduce ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 },
    show: { pathLength: 1, opacity: 1, transition: { duration: 0.6 } },
  };
}

function Scene({ children, reduce }: { children: ReactNode; reduce: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 120 100"
      className="h-28 w-32"
      aria-hidden="true"
      initial={reduce ? 'show' : 'hidden'}
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      transition={{ staggerChildren: 0.18 }}
    >
      {children}
    </motion.svg>
  );
}

function ChooseScene({ reduce }: { reduce: boolean }) {
  const pop: Variants = {
    hidden: reduce ? {} : { scale: 0, opacity: 0 },
    show: { scale: 1, opacity: 1, transition: spring },
  };
  return (
    <Scene reduce={reduce}>
      <motion.g variants={pop} style={{ transformOrigin: '60px 80px' }}>
        <polygon points="25,50 60,66 60,92 25,76" fill="#b91c1c" />
        <polygon points="60,66 95,50 95,76 60,92" fill="#dc2626" />
        <polygon points="60,34 95,50 60,66 25,50" fill="#fff7ed" stroke="#fdba74" strokeWidth="2" />
      </motion.g>
      <motion.g
        variants={{
          hidden: reduce ? {} : { y: 14, opacity: 0 },
          show: { y: 0, opacity: 1, transition: { ...spring, delay: 0.25 } },
        }}
      >
        <circle cx="60" cy="26" r="11" fill="#f59e0b" />
        <path d="M54.5 26.5l4 4 7.5-8" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
    </Scene>
  );
}

function ChatScene({ reduce }: { reduce: boolean }) {
  const bubble = (from: number): Variants => ({
    hidden: reduce ? {} : { opacity: 0, x: from, scale: 0.8 },
    show: { opacity: 1, x: 0, scale: 1, transition: spring },
  });
  return (
    <Scene reduce={reduce}>
      <motion.g variants={bubble(-16)}>
        <rect x="8" y="14" width="66" height="26" rx="10" fill="#fff" stroke="#d6d3d1" strokeWidth="2" />
        <rect x="18" y="23" width="38" height="4" rx="2" fill="#a8a29e" />
        <rect x="18" y="31" width="24" height="4" rx="2" fill="#d6d3d1" />
      </motion.g>
      <motion.g variants={bubble(16)}>
        <rect x="42" y="48" width="70" height="26" rx="10" fill="#16a34a" />
        <rect x="52" y="57" width="42" height="4" rx="2" fill="#fff" />
        <rect x="52" y="65" width="26" height="4" rx="2" fill="#bbf7d0" />
      </motion.g>
      <motion.g variants={bubble(-16)}>
        <rect x="8" y="80" width="40" height="16" rx="8" fill="#fff" stroke="#d6d3d1" strokeWidth="2" />
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx={20 + i * 10}
            cy="88"
            r="2.8"
            fill="#a8a29e"
            animate={reduce ? undefined : { y: [0, -3, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </motion.g>
    </Scene>
  );
}

function QuoteScene({ reduce }: { reduce: boolean }) {
  const draw = useDraw(reduce);
  return (
    <Scene reduce={reduce}>
      <motion.rect
        x="26"
        y="8"
        width="68"
        height="84"
        rx="8"
        fill="#fff"
        stroke="#d6d3d1"
        strokeWidth="2"
        variants={{
          hidden: reduce ? {} : { y: 20, opacity: 0 },
          show: { y: 0, opacity: 1, transition: spring },
        }}
      />
      {[26, 40, 54].map((y, i) => (
        <motion.path
          key={y}
          d={`M38 ${y}H${i === 2 ? 66 : 82}`}
          stroke="#d6d3d1"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          variants={draw}
        />
      ))}
      <motion.circle
        cx="60"
        cy="76"
        r="11"
        fill="#ea580c"
        variants={{
          hidden: reduce ? {} : { scale: 0 },
          show: { scale: 1, transition: spring },
        }}
        style={{ transformOrigin: '60px 76px' }}
      />
      <motion.text
        x="60"
        y="81"
        textAnchor="middle"
        fontSize="14"
        fontWeight="800"
        fill="#fff"
        fontFamily="Helvetica, Arial, sans-serif"
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
      >
        ₹
      </motion.text>
    </Scene>
  );
}

function DeliveryScene({ reduce }: { reduce: boolean }) {
  return (
    <Scene reduce={reduce}>
      <motion.path
        d="M0 84H120"
        stroke="#a8a29e"
        strokeWidth="3"
        strokeDasharray="10 8"
        fill="none"
        animate={reduce ? undefined : { strokeDashoffset: [0, -36] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
      />
      <motion.g
        variants={{
          hidden: reduce ? {} : { x: -70, opacity: 0 },
          show: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 50, damping: 14 } },
        }}
      >
        <motion.g
          animate={reduce ? undefined : { y: [0, -1.5, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          <rect x="14" y="34" width="54" height="36" rx="4" fill="#ea580c" />
          <rect x="22" y="42" width="38" height="8" rx="2" fill="#fff7ed" fillOpacity=".7" />
          <path d="M68 46h18l12 14v10H68Z" fill="#f59e0b" />
          <path d="M74 50h9l7 9H74Z" fill="#fff7ed" />
        </motion.g>
        {[32, 84].map((cx) => (
          <motion.g
            key={cx}
            animate={reduce ? undefined : { rotate: 360 }}
            transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: `${cx}px 74px` }}
          >
            <circle cx={cx} cy="74" r="9" fill="#292524" />
            <circle cx={cx} cy="74" r="3.5" fill="#d6d3d1" />
            <path d={`M${cx} 67v14`} stroke="#d6d3d1" strokeWidth="1.5" />
          </motion.g>
        ))}
      </motion.g>
    </Scene>
  );
}

const SCENES = [ChooseScene, ChatScene, QuoteScene, DeliveryScene];

export default function HowToOrder({ steps }: { steps: OrderStep[] }) {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 80%', 'end 60%'] });
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 24 });

  return (
    <ol ref={ref} className="relative grid gap-10 md:grid-cols-4 md:gap-6">
      {/* progress rail: horizontal on desktop, vertical on mobile */}
      <div className="absolute top-[3.5rem] right-[12%] left-[12%] hidden h-1 rounded bg-stone-300 md:block" aria-hidden="true">
        <motion.div className="h-full origin-left rounded bg-brand-600" style={{ scaleX: reduce ? 1 : progress }} />
      </div>
      <div className="absolute top-8 bottom-8 left-[1.15rem] w-1 rounded bg-stone-300 md:hidden" aria-hidden="true">
        <motion.div className="h-full origin-top rounded bg-brand-600" style={{ scaleY: reduce ? 1 : progress }} />
      </div>

      {steps.map((step, i) => {
        const SceneComp = SCENES[i % SCENES.length] ?? ChooseScene;
        return (
          <motion.li
            key={step.title}
            className="relative flex gap-4 md:flex-col md:items-center md:text-center"
            initial={reduce ? false : { opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ ...spring, delay: i * 0.12 }}
          >
            <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white ring-4 ring-brand-50 md:order-none">
              {i + 1}
            </span>
            <div className="md:flex md:flex-col md:items-center">
              <div className="hidden md:block">
                <SceneComp reduce={reduce} />
              </div>
              <h3 className="text-lg font-bold md:mt-2">{step.title}</h3>
              <p className="mt-1 text-stone-600">{step.text}</p>
              <div className="mt-3 md:hidden">
                <SceneComp reduce={reduce} />
              </div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
