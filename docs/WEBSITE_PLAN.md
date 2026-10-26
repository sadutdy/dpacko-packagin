# D PACKO — Public Website Plan

**Status:** Draft — awaiting approval
**Date:** 2026-10-26

---

## 1. What we know about the business

Collected from the brief plus public sources (IndiaMART, the GST registry, Instagram).

| Field | Value | Source |
|---|---|---|
| Trading name | **D PACKO Packaging Solutions** (also styled "D.PACKO", "D. PACKO") | Brief, IndiaMART, GST |
| Entity | Proprietorship, regular GST taxpayer | GST registry |
| GSTIN | `32FJIPS7458N1ZB` — Active, registered 17 Feb 2025 | GST registry |
| Nature of business | **Wholesale + Retail** | GST registry |
| Address (brief) | 29/229, Melmuri, Malappuram, Kerala | Brief |
| Address (GST record) | 29/229, Calicut Road, Malappuram, Kerala **676517** | GST registry |
| Phone / WhatsApp | +91 98469 94836 | Brief |
| State | Kerala, code 32. Supplies inside Kerala are taxed CGST + SGST | Brief |
| Products listed online | **Broast boxes**, **Shawarma boxes**, **Cake boxes** | IndiaMART (`indiamart.com/dpacko`) |
| Social | Instagram `@dpack_o` (4 posts, ~7 followers) | Instagram |
| Website | None found | — |
| Logo | Isometric carton mark (amber → orange gradient) + "D PACKO / Packaging Solutions" wordmark | `apps/admin-web/src/components/BrandLogo.tsx`, `apps/admin-web/public/favicon.svg` |

**Online presence is very thin.** The IndiaMART listing has no prices, sizes or photos, and
the Instagram account is new. There is no Google Business Profile in search results. The
website therefore has to be the canonical source of product detail, not a copy of anything.

**Name collision:** "Dpack Solutions" (`dpacksolutions.com`, 17K Instagram followers) is an
unrelated industrial/e-commerce packaging company. SEO must always pair the brand with
"Malappuram", "Kerala", "broast box" and "cake box". The site should never use the bare
token "Dpack".

**Doc mismatch:** `docs/ARCHITECTURE.md` describes a **Tamil Nadu** business with Tamil UI.
D PACKO is in **Kerala**, so the second language should be **Malayalam**, and the
intra-state GST split is Kerala CGST/SGST. Fix the ARCHITECTURE assumptions (A5, A10, A12)
separately.

---

## 2. Goals

1. **Wholesale leads**: broast/shawarma shops, bakeries, cloud kitchens and distributors
   across Kerala send a bulk enquiry or WhatsApp message.
2. **Retail sales**: small shops and home bakers order small packs (e.g. 50 / 100 pcs).
3. **Local SEO**: rank for "broast box Malappuram", "cake box wholesale Kerala",
   "shawarma box supplier Kerala" and the same searches in Malayalam.
4. **Trust**: GSTIN, physical address, real product photos, delivery coverage map.

Success metric: enquiries per week (form + WhatsApp clicks), tracked from day one.

---

## 3. Sitemap

| Route | Purpose | Key content |
|---|---|---|
| `/` | Home | Animated hero, product categories, wholesale vs retail split, Kerala coverage, WhatsApp CTA |
| `/products` | Catalogue | Filter by category (Broast, Shawarma, Cake, custom printed) |
| `/products/broast-boxes` | Category page | Sizes (quarter / half / full / family), material, pack qty, MOQ, photos |
| `/products/shawarma-boxes` | Category page | Roll box / plate box variants |
| `/products/cake-boxes` | Category page | ½ kg / 1 kg / 2 kg, window / no window, base boards |
| `/custom-printing` | Upsell | Logo printing on boxes, plate/setup charge explained, sample flow |
| `/wholesale` | B2B landing | Volume tiers, credit terms on approval, distributor enquiry |
| `/retail` | Small-pack buyers | Pack sizes, pickup at Melmuri, delivery charges |
| `/delivery` | Coverage | Kerala's 14 districts, dispatch days, lead times |
| `/about` | Trust | Story, facility photos, GSTIN, address |
| `/contact` | Conversion | Enquiry form, map embed, call / WhatsApp buttons, hours |
| `/ml/*` | Malayalam mirror | Same pages, `hreflang` paired |

Product data (sizes, pack quantities, MOQ, indicative prices) is **not known yet** — see §8.

---

## 4. Tech approach

### 4.1 New app: `apps/website`

- **Astro** with React islands, Tailwind 3 (same config tokens as `admin-web`).
  The admin console is a Vite SPA, but a public site needs static HTML for SEO
  and fast first paint on mobile data. Astro ships zero JS by default and hydrates only
  the animated parts.
- **Motion** (`motion` package, `motion/react` import) for all animation inside React islands.
  Pin an exact version at install time.
- Dev port `:5176`. Turbo `dev` / `build` / `lint` / `typecheck` scripts like the other apps.
- Share the logo: move `BrandMark` / `BrandLogo` into a small `packages/brand` so the
  website and admin console render the same artwork.
- i18n: reuse `packages/i18n` and add an `ml` (Malayalam) locale. Font: Inter + Noto Sans Malayalam.

### 4.2 API additions (follow `routes → controller → service → repository → model`)

Today every catalog route sits behind `authenticate`. The website needs a small public surface:

| Endpoint | Behaviour |
|---|---|
| `GET /public/catalog` | Published SKUs only, with a whitelisted field set (no cost price, no BOM). Cached for 5 min |
| `POST /public/enquiries` | zod-validated enquiry → creates a CRM lead and a WhatsApp/SMS notification to staff. Rate-limited per IP, honeypot field, no CAPTCHA at first |

Add a `published: boolean` flag on SKUs so staff decide in the admin console what appears
on the site. Prices stay **"Ask price / WhatsApp for rate"** unless the owner decides to show them.

Phase 1 can ship as a fully static site, with no API dependency, using a JSON product file.
Switch to `/public/catalog` in Phase 2.

---

## 5. Motion design

Motion supports the brand. It never gates content, and every effect respects `prefers-reduced-motion`.

| Where | Effect |
|---|---|
| Hero | The isometric carton from the logo **folds closed**: three SVG faces animate in with spring physics, then the wordmark slides up. Uses SVG `pathLength` + `motion.path` |
| Hero background | Slow parallax of floating box outlines (`useScroll` + `useTransform`) |
| Category cards | Stagger-in on scroll (`whileInView`, `staggerChildren`), lift + slight 3D tilt on hover |
| Wholesale vs Retail | Toggle with a shared-layout pill (`layoutId`), and the price-tier table cross-fades |
| Numbers strip | Count-up: "14 districts", "1,000+ boxes/day" (real figures needed) |
| Kerala map | District dots pulse in sequence along the dispatch route |
| Enquiry form | Field-level micro-feedback, and the success state animates a box "sealing" |
| WhatsApp FAB | Gentle attention bounce once after 8 s, never looping |

Budget: hero animation JS ≤ 40 KB gzipped. LCP < 2.5 s on a Moto G-class phone over 4G.

---

## 6. Content & SEO

- `LocalBusiness` + `Product` JSON-LD with address, GSTIN, geo, opening hours and phone.
- Titles that pair the brand with location, e.g. "Broast Boxes Wholesale in Malappuram, Kerala | D PACKO".
- Create a **Google Business Profile** at the Melmuri address. This is the biggest single local-SEO win.
- Link back from IndiaMART and Instagram. Add the website URL to both.
- Malayalam pages carry real translated copy, not machine output only.
- Image pipeline: Astro `<Image>` → AVIF/WebP with `width`/`height` set to avoid layout shift.

---

## 7. Phases

| Phase | Scope |
|---|---|
| **P1 — Launch** | Static Astro site in English, with Home, Products (3 categories), Wholesale, Retail, Contact. Hero + scroll motion. WhatsApp deep links (`wa.me/919846994836?text=…`). JSON-LD, sitemap, analytics |
| **P2 — Connected** | `/public/catalog` + `/public/enquiries` API, `published` flag in admin, enquiries land in CRM |
| **P3 — Malayalam + growth** | `/ml` locale, Custom printing page, Delivery map, blog/FAQ for SEO |
| **P4 — Ordering** | Retail cart + Razorpay (ties into the existing orders/payments modules) |

---

## 8. Open questions for the owner

1. **Logo**: is the isometric carton in `BrandLogo.tsx` the official logo, or is there a design file?
2. **Photos**: real product and facility photos (the site should not use stock box images).
3. **Product specs**: sizes, material/GSM, pack quantity and MOQ for each box type.
4. **Prices**: show indicative retail prices, or "Ask price" only?
5. **Domain & email**: e.g. `dpacko.in`. Check availability before choosing.
6. **Manufacture vs trade**: does D PACKO make the boxes or resell them? This decides "Manufacturer" vs "Supplier" wording.
7. **Delivery**: own vehicle, parcel service, or both? Lead time per district?
8. **Hours**: shop/office timings for the site and the Google Business Profile.
