# Invoice & document styling guide

How printable business documents (quotations, proforma invoices and, next,
tax invoices, delivery challans and receipts) look and are built in the admin
console. The quotation view is the reference implementation; reuse its pieces
rather than starting over.

> Source of truth for figures is always `packages/domain`. Components only
> format and place numbers. They never calculate them.

---

## 1. Where things live

| Concern | Location |
| --- | --- |
| Document maths (tax split, HSN summary, round-off, words, advance) | `packages/domain/src/quote-document/` |
| GST state codes | `packages/domain/src/gst/states.ts` |
| Money formatting and words | `packages/domain/src/money/` (`formatNumber`, `formatINR`, `inrWords`) |
| Invoice maths (place of supply, copies, dispatch, balance) | `packages/domain/src/invoice-document/` |
| Quote layout registry | `apps/admin-web/src/modules/documents/layouts/index.ts` |
| Invoice layout registry | `apps/admin-web/src/modules/documents/invoice-layouts/index.ts` |
| Shared editor (wizard frame, party/items/terms steps, draft core) | `apps/admin-web/src/modules/documents/editor/` |
| Shared building blocks | `apps/admin-web/src/modules/documents/parts/` |
| Paper sheet (A4/A5, fit-to-width) | `apps/admin-web/src/modules/documents/Paper.tsx` |
| Display formatters | `apps/admin-web/src/modules/documents/format.ts` |
| Print CSS | `apps/admin-web/src/styles/index.css` (`.quote-paper`, `.quote-print-portal`) |
| PDF export and share | `apps/admin-web/src/modules/documents/sharePdf.ts` |

Quote and invoice pages are thin consumers of `modules/documents/`. A new
document type (delivery challan, credit note, receipt) should add a domain
builder, a layout registry and a draft that `extends CoreDraft`, and reuse the
shared `WizardShell`, `PartyStep`, `ItemsStep` and `TermsEditor`.

---

## 2. The sheet is paper, not UI

- **Always white with near-black ink** (`#ffffff` and `#111111`), in both
  light and dark app themes. `.quote-paper` sets `color-scheme: light` so form
  controls and scrollbars inside it stay light.
- **App theme tokens (`--app-*`) are for the chrome around the sheet only.**
  The one exception is `--app-accent`, which the Modern layout uses for its
  title, table header and grand total.
- **No shadows, gradients, rounded photos or translucency inside the sheet**,
  except the subtle `bg-black/[0.035]` zebra and `bg-black/[0.04]` panels in
  Modern. They print acceptably on mono laser printers.
- **Ink budget:** Classic and Compact are monochrome. Use colour only where a
  layout says so.

### Paper sizes

| Size | Sheet | Margin | Used by |
| --- | --- | --- | --- |
| A4 | 210 × 297 mm | 12 mm | Classic, Modern, Tax invoice (planned) |
| A5 | 148 × 210 mm | 8 mm | Compact, receipts |

Each layout declares `pageSize` in the registry. The preview, print `@page`
and PDF all read it, so never hard-code a size in a layout.

**One page is the default target.** If a layout's sample document spills onto a
second page, tighten spacing before shrinking type.

---

## 3. Typography

| Role | Classic / Compact | Modern |
| --- | --- | --- |
| Family | `Arial, Helvetica, sans-serif` (Tally-like, prints crisply) | System sans (`font-sans`) |
| Body | 12.5 px (Classic), 10 px (Compact) | 12 px |
| Seller name | bold, uppercase, 13 px | bold, 15 px |
| Document title | bold 18 px, centred | bold 26 px, uppercase, accent |
| Table header | regular, centred | 10 px semibold uppercase, tracked |
| Amount in words | bold | bold |
| Fine print (declaration, E.&O.E.) | body size | 10–11 px |

Rules:

- Size in **px** inside the sheet, not rem: the sheet is a fixed physical size.
- Never go below **9 px** in print.
- Bold is for the seller name, party name, item names, totals and amount in
  words. Do not bold whole rows.
- Italic bold is reserved for in-table labels such as `CGST`, `SGST`,
  `ROUND OFF` and `ADVANCE AMOUNT(50%)`. This is the Tally convention.

---

## 4. Numbers, dates and words

Use the helpers in `document/format.ts`. Do not call `toLocaleString` ad hoc.

| What | Helper | Example |
| --- | --- | --- |
| Amount in a column | `amount(paise)` | `14,10,000.00` |
| Amount with symbol (totals) | `money(paise)` | `₹14,80,500.00` |
| Negative adjustment | `signedAmount(paise)` | `(-)250.00` |
| Quantity | `qty(n)` | `6,00,000` |
| Rate | `rate(paise)` | `2.35` |
| Tax rate | `pct(n)` | `2.50%` |
| Tally date | `docDate(iso)` | `13-Oct-26` |
| Long date | `longDate(iso)` | `13 Oct 2026` |
| Phone | `localPhone(e164)` | `9846994836` |
| Words | `doc.words.amount` / `doc.words.tax` | `INR Fourteen Lakh Eighty Thousand Five Hundred Only` |

- **Indian digit grouping everywhere** (lakh and crore).
- **Two decimals in documents**, even for round rupees. The list views'
  `rupees()` helper drops paise; never use it on a document.
- **Right-align every numeric column, with `whitespace-nowrap`.** Quantities
  print with their unit (`6,00,000 NOS`).
- **Money is integer paise end to end.** Convert to rupees only at render time.

---

## 5. Tables

### Ruled grid (Classic, Tax invoice)

- Outer border plus vertical rules between all columns: `border border-black`
  on the table, and `border-l` on cells.
- **No horizontal rules between item rows.** Keep only:
  - one under the header;
  - one above `Total`;
  - one above each later section (advance, round off, grand total).
- **Spacer rows** keep the vertical rules running down to the totals. Size them
  so the sample document fits one page (Classic currently uses `h-6`, `h-16`
  and `h-20`).
- **Column widths** (percent of table width):

  | Sl | Description | HSN/SAC | Quantity | Rate | per | Amount |
  | --- | --- | --- | --- | --- | --- | --- |
  | 5 | auto | 11 | 13 | 11 | 7 | 17 |

### Zebra (Modern)

- Accent-coloured header row with white 10 px uppercase labels.
- Alternate rows tinted with `bg-black/[0.035]`. No vertical rules.

### Dense (Compact)

- A top and bottom rule only. Tax and total rows sit inline under the items.

### Always

- `thead { display: table-header-group }` and `tr { break-inside: avoid }`
  (already in CSS), so long tables repeat their header and never split a row
  when printed.
- HSN summary: intra-state shows `CGST` and `SGST/UTGST` rate and amount
  pairs; inter-state shows `IGST`. Let `doc.supply` decide; never branch on
  state names in a component.

---

## 6. Layout anatomy

Every layout composes the same parts in its own order:

```
SellerBlock     → name, address, phone, GSTIN, state
Title           → options.title (Proforma Invoice / Quotation / Tax Invoice …)
PartyBlock      → buyer (tally key/value grid or stacked card)
ItemsTable      → variant: ruled | zebra | dense
AmountInWords   → "Amount Chargeable (in words)" … "E. & O.E"
TaxSummary      → HSN-wise table (ruled | minimal)
TermsBlock      → editor terms + remarks (renders nothing when empty)
SignatureBlock  → declaration (left) · "for <SELLER>" / Authorised Signatory (right)
Footer          → "This is a Computer Generated Invoice"
```

Parts take the whole `doc` (or a slice of it) and optional `className` and
`variant` props. A part that needs a value the domain does not provide is a
signal to extend the domain builder, not to compute it inline.

### Adding a layout

1. Create `layouts/<Name>Layout.tsx` exporting `({ doc, options }: LayoutProps)`.
2. Register it in `layouts/index.ts` with `label`, `description`, `pageSize`
   and `Component`.
3. Check it with the seeded `QT-DEMO-00001` in light and dark app themes, in
   print preview and as a PDF. It must fit its page.

No other file changes. The quote view, the editor's layout picker, print and
PDF all read the registry.

---

## 7. Print and PDF

- **Print** renders a second copy of the layout into a `<body>`-level portal
  (`.quote-print-portal`). `@media print` hides everything else and injects
  `@page { size: <pageSize>; margin: <margin> }`. Do not try to print the
  scaled on-screen preview.
- **PDF** captures the on-screen sheet with `html2canvas-pro` at 2× scale and
  slices it into pages with `jspdf`. The fit-to-width scale is removed in the
  cloned DOM, so captures are always 1:1. Images must be same-origin or served
  with CORS (`crossOrigin="anonymous"` on the logo).
- **File names** follow `<Kind>-<Number>-<Party>.pdf`, slugged
  (`Quote-QT-2526-00011-T-T-HOSPITALITY-LLP.pdf`). Invoices should use
  `Invoice-…`.
- **Share:** use `navigator.share({ files })` when `canShare` allows it,
  otherwise download. Offer copy-to-WhatsApp text and `mailto:` as fallbacks.

---

## 8. Accessibility and the chrome

- **Toolbars, steppers and forms around the sheet** use the app components
  (`btn-*`, `field`, `card`, `Segmented`, `StatusBadge`) and theme tokens, so
  they follow light and dark mode.
- **The sheet keeps real semantics:** `<table>`, `<th>`, `<dl>`/`<dt>`/`<dd>`
  for key/value pairs, and headings for titles. Screen readers then read it
  sensibly, and `get_page_text`-style checks work.
- **Colour never carries meaning alone** on a document. Pair it with a label
  (for example "Grand total" next to the accent figure).

---

## 9. Tax invoice: status

`buildInvoiceDocument` (domain) and the Tally / Modern / Compact invoice
layouts cover the items ticked below. **Confirm the final field list with your
accountant**; requirements depend on turnover and e-invoicing applicability.

- [x] Title **"Tax Invoice"** (or *Bill of Supply*). Proforma and quotation
      titles never print on an invoice.
- [x] Copy labels *Original for Recipient* / *Duplicate for Transporter* /
      *Triplicate for Supplier*; print and PDF emit each selected copy on its
      own sheet.
- [x] Consecutive invoice number per series (`INV-<FY>-00001`) and invoice date.
- [x] **Place of supply** printed explicitly; the consignee (ship-to) state wins
      over the buyer's, and decides CGST + SGST vs IGST.
- [x] Whether tax is payable on **reverse charge** (Yes/No).
- [x] Buyer's order number and date, delivery note, dispatch document number,
      *dispatched through*, destination, vehicle number, **e-way bill number**,
      terms of delivery, mode/terms of payment.
- [x] Bank details block and "for <SELLER>" / Authorised Signatory.
- [x] Amount received and balance due once payments are recorded.
- [ ] Discount column (lines are priced net today).
- [ ] **e-Invoice:** IRN, Ack No., Ack Date and the signed QR code
      (an `EInvoiceBlock` part: QR at about 28 mm, IRN in monospace).
- [ ] Credit notes for correcting invoices that already have payments
      (editing is locked once a payment is recorded).
- [ ] Digital signature image.

Invoice-only parts: `PartyBox` (Tally buyer/consignee cell),
`InvoiceMetaGrid` (ruled header facts), `BankDetails`, `CopyLabel`.

---

## 10. Review checklist for any new document

- [ ] All figures come from the domain builder; no arithmetic in JSX.
- [ ] Numbers use the `format.ts` helpers, right-aligned and unwrapped.
- [ ] Fits its page size with the seeded demo data; prints with no app chrome.
- [ ] Looks identical with the app in light and dark mode.
- [ ] PDF opens with the right page size and a sensible file name.
- [ ] Intra-state shows CGST and SGST; inter-state shows IGST (test both).
- [ ] Amount in words matches the grand total (and the tax total).
- [ ] Long party names and addresses wrap without breaking the grid.
