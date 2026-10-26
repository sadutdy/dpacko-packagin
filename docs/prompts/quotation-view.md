# Prompt: Quotation document view (3 switchable layouts, print + PDF share)

Paste everything below the line into Claude Code from the repo root.

---

Read `CLAUDE.md` and `docs/ARCHITECTURE.md` first, then build a **quotation document view**
for the admin console. When a user clicks a row in the Quotes list
(`apps/admin-web/src/modules/quotes/QuotesPage.tsx`), open a printable, shareable
"Proforma Invoice / Quotation" view of that quote.

## Reference format (layout "Classic" must match this)

A GST proforma invoice from the seller to a party, top to bottom:

1. Top row: `No.` (quote number) and `Ref. No.` on the left; `Dated <dd-MMM-yy>` on the right.
2. Seller block, centred: company name (bold), address lines, `MOB:<phone>`,
   `GSTIN/UIN: <gstin>`, `State Name : <state>, Code : <2-digit code>` (underlined).
3. Title, centred and bold: **Proforma Invoice** (make the title configurable:
   "Quotation" / "Proforma Invoice").
4. Party block: `Party :` customer business name (bold), billing address lines,
   `GSTIN/UIN : <gstin>`, `State Name : <state>, Code : <code>`.
5. Ruled items table with columns: `Sl No. | Description of Goods | HSN/SAC | Quantity | Rate | per | Amount`.
   - One row per item: name (bold), HSN (from SKU `hsnCode`, default 4819),
     quantity with unit (e.g. `6,00,000 NOS`), rate in rupees with 2 decimals, unit, amount.
   - Below the items, right-aligned italic bold labels in the description column with amounts:
     `CGST` and `SGST` for intra-state, or `IGST` for inter-state (only show non-zero lines).
   - `Total` row: total quantity and grand total with `₹` (bold, larger).
   - Optional advance section: `ADVANCE AMOUNT(50%)`, `ROUND OFF` (e.g. `(-)250.00`),
     then an `ADVANCE` row with the rounded advance in bold `₹`. Advance percent is a view
     option (0 = hide the section; default 50).
6. `Amount Chargeable (in words)` on the left, `E. & O.E` on the right, then the amount in
   words in bold, e.g. `INR Fourteen Lakh Eighty Thousand Five Hundred Only`.
7. HSN summary table: `HSN/SAC | Taxable Value | CGST (Rate, Amount) | SGST/UTGST (Rate, Amount) | Total Tax Amount`,
   grouped by HSN, with a bold `Total` row. Use IGST columns instead for inter-state.
8. `Tax Amount (in words) : INR … Only`.
9. Footer: `Declaration` (underlined) with the standard declaration text on the left;
   `for <COMPANY NAME>` bold on the right and `Authorised Signatory` below it.
10. Centred, underlined: `This is a Computer Generated Invoice`.

Indian digit grouping everywhere (`14,10,000.00`). Amounts in the document show 2 decimals,
unlike the list view's `rupees()` which drops paise.

## What exists already (verify, don't assume)

- Quote model: `apps/api/src/modules/orders/orders.model.ts` (`quoteSchema`, `orderItemSchema`,
  `pricingSchema` with `subtotalPaise`, `cgstPaise`, `sgstPaise`, `igstPaise`, `roundOffPaise`,
  `grandTotalPaise`). Check whether items persist `unitPricePaise`, `taxablePaise`, tax rate and
  HSN; if not, add them (schemaVersion bump, old docs fall back gracefully).
- Quote routes: `apps/api/src/modules/orders/orders.routes.ts` has list/preview/patch/delete
  but **no `GET /quotes/:id`**. Add it.
- Company profile singleton: `apps/api/src/modules/company` (`name`, `address`, `phone`,
  `website`, `logo`, `gstin`). It lacks state name/code and the declaration text; add
  `stateName`, `stateCode` (derive the default code from the GSTIN's first 2 digits),
  `declaration`, and optional bank details (`bankName`, `accountNo`, `ifsc`, `branch`)
  for the Modern/Compact layouts. Update the zod schema and the settings page.
- Customer: `apps/api/src/modules/crm/crm.model.ts` has `gstin`; reuse its address fields.
- Money helpers: `packages/domain/src/money` already has `amountInWords(paise)`
  (returns `Rupees … Only`). Add a formatter for the `INR … Only` style and a
  `formatPaiseIN(paise, { decimals: 2 })` helper there, with specs.
- Theme: Tailwind semantic tokens in `apps/admin-web/tailwind.config.*` and
  `apps/admin-web/src/styles/index.css` (`--app-*` variables, light + `.dark`).
  UI prefs pattern: `apps/admin-web/src/app/settings/UiPrefsContext.tsx` (localStorage-backed).

## Backend

1. `GET /api/v1/orders/quotes/:id/document` (permission: orders read), validated with
   `objectIdParamSchema`. Returns one denormalised payload so the browser does no joins:
   ```ts
   interface QuoteDocument {
     quote: { id; number; refNo; date; validUntil; status };
     seller: { name; addressLines: string[]; phone; gstin; stateName; stateCode; logo; bank?; declaration };
     party: { name; addressLines: string[]; gstin; stateName; stateCode };
     supply: 'intra' | 'inter';           // seller.stateCode === party.stateCode
     lines: { sl; name; description?; hsn; quantity; unit; ratePaise; amountPaise }[];
     taxes: { label: 'CGST' | 'SGST' | 'IGST'; ratePct; amountPaise }[];
     hsnSummary: { hsn; taxablePaise; cgst?; sgst?; igst?; totalTaxPaise }[];
     totals: { quantity; taxablePaise; taxPaise; roundOffPaise; grandTotalPaise };
     words: { amount: string; tax: string };
   }
   ```
   Follow `routes → controller → service → repository`. Put the pure document builder
   (HSN grouping, intra/inter split, totals, words) in `packages/domain` with `*.spec.ts`
   tests, including the reference numbers: 6,00,000 × ₹2.35 at 5 % GST →
   taxable 14,10,000.00, CGST 35,250.00, SGST 35,250.00, total 14,80,500.00,
   50 % advance 7,40,250.00 rounded to 7,40,000.00 (round off −250.00).
   The advance math is a pure function too: `advance(grandTotalPaise, pct, roundTo = 100000)`.
2. Integration test in `apps/api/tests` for the new endpoint (404 for unknown id, shape check).

## Frontend

1. Route `/quotes/:id` → `QuoteDocumentPage` in `apps/admin-web/src/modules/quotes/`.
   Make the whole list row clickable (keyboard accessible: `Enter` opens it) without
   breaking the existing Edit/Delete buttons (stop propagation).
2. Page chrome (uses app theme tokens, hidden when printing): back link, quote number,
   status badge, a **layout switcher** (segmented control), advance % input, title toggle
   (Quotation / Proforma Invoice), and buttons **Print** and **Share PDF**.
3. Render the document through a layout registry so layouts are data, not branches:
   ```ts
   type LayoutId = 'classic' | 'modern' | 'compact';
   const LAYOUTS: Record<LayoutId, { label: string; description: string; Component: FC<{ doc: QuoteDocument; options: ViewOptions }> }>;
   ```
   Shared building blocks (`SellerBlock`, `PartyBlock`, `ItemsTable`, `TaxSummary`,
   `AmountInWords`, `SignatureBlock`) live in `modules/quotes/document/parts/`; each layout
   composes them differently. Adding a 4th layout must need only one new file plus a
   registry entry.
4. The three sample layouts:
   - **Classic** — faithful to the reference above: centred headers, full ruled grid,
     black-on-white, Arial-like font, no colour.
   - **Modern** — logo + seller on the left, a "QUOTATION" title block with number/date/validity
     on the right, two-column Bill-to / Supply-details cards, zebra item rows, a right-aligned
     totals card, accent colour taken from `--app-accent`, bank details and terms at the bottom.
   - **Compact** — dense single-page A5/thermal-friendly variant: small type, no vertical rules,
     items and taxes in one table, totals and words inline, signature line at the end.
5. Document surface: render on a white A4 "paper" (210 × 297 mm, 12 mm margins) centred
   on the app background, with `--app-shadow-card`. The paper **stays white with dark text
   in dark mode** (it's a document), while the surrounding chrome follows the theme.
   Responsive: on narrow screens scale the paper to fit width (no horizontal page scroll).
6. Persist the chosen layout per user in localStorage, following the `UiPrefsContext`
   pattern (key `ameen-quote-layout`, validated, default `classic`). Also read
   `?layout=` from the URL so a link can force one.
7. **Print**: `window.print()` with an `@media print` block: `@page { size: A4; margin: 12mm }`,
   hide the app shell/sidebar/toolbar, force light colours, `print-color-adjust: exact`,
   avoid breaking inside table rows, repeat the items table header on each page.
8. **Share PDF**: generate a real PDF of the current layout client-side
   (prefer `html2canvas-pro` + `jspdf` or `@react-pdf/renderer`; pick one, justify it in the
   PR, and pin exact versions). File name `Quote-<number>-<party>.pdf`. Then:
   - if `navigator.canShare({ files: [file] })` → `navigator.share({ files, title, text })`;
   - else download the file, and offer "Copy WhatsApp text" / `mailto:` with the
     quote summary (number, party, total) as fallbacks.
   Show a busy state while generating; surface errors with the existing error styles.
9. Loading and error states use the existing patterns (`text-app-muted`, `text-app-danger-text`).
   404 → existing `NotFound` component.

## Rules

- Money stays integer paise end-to-end; format only at render time.
- No business math in React components: totals, tax split, advance and words come from
  `packages/domain` (or the API payload).
- TypeScript strict + `noUncheckedIndexedAccess`; ESM `.js` imports; colocated domain specs.
- No new colours outside the `--app-*` tokens for the chrome; the Classic layout is monochrome.

## Done when

- Clicking any quote opens `/quotes/:id`; all three layouts render the reference quote with
  the exact figures above; switching layouts is instant and remembered after reload.
- Print preview shows one clean A4 page per layout with no app chrome, in light and dark mode.
- Share PDF produces a correct PDF (opens the native share sheet on mobile/Safari,
  downloads elsewhere).
- `pnpm lint`, `pnpm typecheck`, `pnpm test` pass. Seed a quote matching the reference
  (T&T Hospitality LLP, SP, 6,00,000 NOS @ 2.35) in `apps/api/src/scripts/seed.ts` for demo.
- Verify in the browser preview with screenshots of each layout before finishing.
