import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { isLayoutId, type LayoutId } from './layouts/index.js';

const STORAGE_KEY = 'ameen-quote-layout';

/** The layout this viewer last picked in the editor; seeds new quotes. */
export function lastUsedLayout(): LayoutId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isLayoutId(stored) ? stored : 'classic';
  } catch {
    return 'classic';
  }
}

export function rememberLayout(layout: LayoutId): void {
  try {
    localStorage.setItem(STORAGE_KEY, layout);
  } catch {
    // Private mode: the choice just isn't remembered.
  }
}

/**
 * Layout shown on the quote view. Defaults to the quote's saved layout; a
 * `?layout=` param overrides it, so a switched view is also a shareable link.
 */
export function useLayoutParam(fallback: string | undefined): [LayoutId, (layout: LayoutId) => void] {
  return useLayoutParamFor(fallback, isLayoutId, 'classic');
}

/** Same as `useLayoutParam`, for any layout registry (e.g. invoices). */
export function useLayoutParamFor<T extends string>(
  fallback: string | undefined,
  isValid: (value: unknown) => value is T,
  defaultId: T,
): [T, (layout: T) => void] {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('layout');

  const setLayout = useCallback(
    (layout: T) => {
      const next = new URLSearchParams(params);
      next.set('layout', layout);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  return [isValid(fromUrl) ? fromUrl : isValid(fallback) ? fallback : defaultId, setLayout];
}
