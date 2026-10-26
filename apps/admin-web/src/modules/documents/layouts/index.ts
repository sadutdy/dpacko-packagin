import type { LayoutDefinition } from '../types.js';
import { ClassicLayout } from './ClassicLayout.js';
import { CompactLayout } from './CompactLayout.js';
import { ModernLayout } from './ModernLayout.js';

/**
 * Layout registry. A new layout is one component file plus one entry here;
 * the page, switcher, print and PDF export all read from this map.
 */
export const LAYOUTS = {
  classic: {
    label: 'Classic',
    description: 'Tally-style proforma grid, monochrome.',
    pageSize: 'A4',
    Component: ClassicLayout,
  },
  modern: {
    label: 'Modern',
    description: 'Logo, accent title, totals card and bank details.',
    pageSize: 'A4',
    Component: ModernLayout,
  },
  compact: {
    label: 'Compact',
    description: 'Dense single page on A5.',
    pageSize: 'A5',
    Component: CompactLayout,
  },
} as const satisfies Record<string, LayoutDefinition>;

export type LayoutId = keyof typeof LAYOUTS;

export const LAYOUT_IDS = Object.keys(LAYOUTS) as LayoutId[];

export function isLayoutId(value: unknown): value is LayoutId {
  return typeof value === 'string' && value in LAYOUTS;
}
