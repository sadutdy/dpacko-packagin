import type { FC } from 'react';
import type { AdvanceResult, CopyKind, DocumentTitle, InvoiceDocument, QuoteDocument } from '@ameen/domain';

export type { CopyKind, DocumentTitle, InvoiceDocument, QuoteDocument };

export type PageSize = 'A4' | 'A5';

export interface ViewOptions {
  title: DocumentTitle;
  /** Null when the advance section is hidden (0 %). */
  advance: AdvanceResult | null;
}

export interface LayoutProps {
  doc: QuoteDocument;
  options: ViewOptions;
}

export interface InvoiceLayoutProps {
  doc: InvoiceDocument;
  /** Which printed copy this sheet is (null = no copy label). */
  copy: CopyKind | null;
}

export interface LayoutDefinition<P = LayoutProps> {
  label: string;
  description: string;
  /** Paper size used by the screen preview, print @page and PDF export. */
  pageSize: PageSize;
  Component: FC<P>;
}
