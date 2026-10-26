import { useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';

import type { PageSize } from './types.js';

export const PAGE_MM: Record<PageSize, { width: number; height: number; margin: number }> = {
  A4: { width: 210, height: 297, margin: 12 },
  A5: { width: 148, height: 210, margin: 8 },
};
const MM_TO_PX = 96 / 25.4;

/** White sheet of paper, scaled down to fit narrow screens (never up). */
export function Paper(props: { size: PageSize; paperRef?: Ref<HTMLDivElement>; children: ReactNode }) {
  const page = PAGE_MM[props.size];
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      const scale = Math.min(1, outer.clientWidth / (page.width * MM_TO_PX));
      setFit({ scale, height: inner.offsetHeight * scale });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [page.width]);

  return (
    <div ref={outerRef} className="w-full" style={{ height: fit.height || undefined }}>
      <div
        ref={innerRef}
        data-quote-scale=""
        className="mx-auto origin-top-left"
        style={{ width: `${page.width}mm`, transform: fit.scale < 1 ? `scale(${fit.scale})` : undefined }}
      >
        <div
          ref={props.paperRef}
          className="quote-paper"
          style={{ width: `${page.width}mm`, minHeight: `${page.height}mm`, padding: `${page.margin}mm` }}
        >
          {props.children}
        </div>
      </div>
    </div>
  );
}
