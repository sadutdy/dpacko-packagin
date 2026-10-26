import type { PageSize } from './types.js';

const PAGE_MM: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
};

/**
 * Renders the on-screen paper element to a paginated PDF. Libraries load on
 * demand so they stay out of the main bundle. The preview's fit-to-width
 * scale is stripped in the cloned DOM so the capture is always 1:1.
 */
export async function renderPdf(elements: HTMLElement | HTMLElement[], pageSize: PageSize): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
  const page = PAGE_MM[pageSize];
  const pdf = new jsPDF({ unit: 'mm', format: pageSize.toLowerCase(), orientation: 'portrait', compress: true });
  let first = true;

  // Each element (e.g. Original / Duplicate copy) starts on a new page.
  for (const element of Array.isArray(elements) ? elements : [elements]) {
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      onclone: (_doc, clone) => {
        let node: HTMLElement | null = clone;
        while (node) {
          if (node.dataset.quoteScale !== undefined) node.style.transform = 'none';
          node = node.parentElement;
        }
        clone.style.boxShadow = 'none';
      },
    });

    const pxPerMm = canvas.width / page.width;
    const pageHeightPx = Math.floor(page.height * pxPerMm);
    // Up to 1 mm of overshoot is mm→px rounding, not a real extra page.
    const pages = Math.max(1, Math.ceil((canvas.height - pxPerMm) / pageHeightPx));

    for (let index = 0; index < pages; index += 1) {
      const sliceHeight = Math.min(pageHeightPx, canvas.height - index * pageHeightPx);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceHeight;
      const ctx = slice.getContext('2d');
      if (!ctx) throw new Error('Canvas is not available in this browser');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, index * pageHeightPx, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, page.width, sliceHeight / pxPerMm);
    }
  }

  return pdf.output('blob');
}

/** `Quote-QT-2526-00001-T-T-Hospitality-LLP.pdf`; invoices pass kind `Invoice`. */
export function pdfFileName(documentNumber: string, partyName: string, kind = 'Quote'): string {
  const slug = (value: string) => value.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${kind}-${slug(documentNumber)}-${slug(partyName) || 'Customer'}.pdf`;
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/** Native share sheet with the PDF when supported; otherwise a download. */
export async function sharePdf(blob: Blob, fileName: string, title: string, text: string): Promise<ShareOutcome> {
  const file = new File([blob], fileName, { type: 'application/pdf' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // Some browsers advertise file sharing but refuse it; fall through to download.
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
