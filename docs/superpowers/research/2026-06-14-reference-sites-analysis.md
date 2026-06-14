# Reference-sites analysis — Lily's Travel & Nom Nom Travel

**Date:** 2026-06-14
**Purpose:** Field notes from a live walkthrough of the two sites Yuri uses as
design references, to drive the customer-FE UX/design refresh spec. Captured by
opening both sites in a real browser (DOM extraction + screenshots + computed
styles). The goal is to make `apps/web` look as professional as these two,
done **incrementally** (no big-bang rewrite).

References:
- **Lily's Travel Agency** — https://lilystravelagency.com/ *(primary reference)*
- **Nom Nom Travel** — https://www.nomnomtravel.com/hanoi-city-tour

---

## 1. Design tokens (measured from computed styles)

### Lily's — warm, trust, conventional travel-agency
- **Brand red:** `#AF2227` (rgb 175,34,39) — dominant accent (buttons, bands, headings on hover). Secondary lighter red `#FF6060`.
- **Neutrals:** text `#111`, muted `#555`, surfaces white / `#EEEEEE` / `#FBFCFD`.
- **Type:** headings **DM Sans** (700/400, H1 ~35px — dense, not oversized); body system/Open Sans; buttons Open Sans/Raleway 500.
- **Buttons:** primary = **pill** (`radius 100px`), red fill, white text ("Search now"); secondary = white fill, **red text**, `radius 5px` ("Book Now"); nav "Book Here" outline.
- **Imagery:** photo-saturated; bold text overlays on destination photos.

### Nom Nom — earthy, editorial, storytelling
- **Palette:** sage/olive — `#C7CEC9` (pale sage), `#DBE2DD` (light sage), `#5C6756` (olive), `#485342` (dark olive), near-black `#1D1E20`, white.
- **Accent CTA:** deep blue `#00327F`.
- **Type:** display **Jacques François** (serif, H1 ~112px — big, elegant); body **DM Sans**; buttons **Poppins** 500.
- **Buttons:** **pill** (`radius 999px`), solid blue, white text ("TAKE ME TO BOOKING PAGE").
- **Imagery:** large full-bleed photos; alternating image↔text (zigzag) blocks.

> Takeaway: both use a **pill primary button**, a **warm/earthy** palette, and a
> **serif-or-strong-display heading**. Both are photo-first. Our current site is
> clean but cool/neutral and photo-poor — warming the palette + real imagery is
> the single biggest lever.

---

## 2. Lily's homepage structure (7 tiers, in order)

0. **Utility bar (red):** "Vietnam's Leading DMC" + email + social icons — credibility + contact from pixel one.
1. **Hero + Search:** full-bleed photo + headline + **Search now** (search-first).
2. **Most Famous Destinations:** photo-tile grid (HCMC · Hanoi · Sapa · Ninh Binh · Da Nang · Ha Long) with bold overlay text — **destination-led browse**.
3. **Best of Lily's Packages:** carousel of multi-day packages, **strikethrough → discounted price**, "Book Now", "View more packages".
4. **Why choose Lily's?:** paragraph + **award badges** (Tripadvisor Choice 2024, Top 10 UNESCO…).
5. **Trust band (red) "Trust is more valuable than gold":** "Read reviews on…" + TripAdvisor logos.
6. **Travel Advice:** blog grid (6 article cards) — content marketing / SEO.
7. **Footer (red):** address, hours, phone, **WhatsApp/Line/Viber**, map. Floating chat widget.

---

## 3. Tour/package DETAIL anatomy

### Lily's package detail (`/product/...`) — comprehensive sales+trust template
Section order:
1. **Overview** (intro/summary)
2. **Value of the package** (highlights / why this one)
3. **Itinerary** (Day 1, Day 2, … day-by-day)
4. **Inclusions** (include / exclude)
5. **Policies** (booking / cancellation)
6. **All Reviews** (review list)
7. **Why Lily's Travel?** — stats trust block: *15 years experience · reputation · excellent reviews · 1,000,000+ customers · 24/7 support*
8. **Price and policy** — **price anchoring** (~~$1,209~~ → **$1,070**)
9. **FAQ** — ~10 Q&A (what's included, airfare, vegetarian, modify itinerary, cancellation/refund, weather, insurance, payment, airport pickup, documents)
10. **Related Tours** (cross-sell)
- **CTAs (multi-channel):** Book Here · **WhatsApp** · **Inquire Now** · Contact Us — buy OR enquire.
- 50 images, embedded map.

### Nom Nom detail — storytelling
- Full-bleed hero photo + big serif title + intro ("we can help create a personalized itinerary — Get in touch").
- **Zigzag image↔text blocks** with emotive headings ("ROADS FULL OF SIGHTS", "LIKE A LOCAL, FROM A LOCAL").
- Inclusion/Exclusion lists + real photos.
- Big **price anchor** ("FROM $50 PER ADULT") + **single CTA** ("TAKE ME TO BOOKING PAGE").
- Single **testimonial** quote.

### Our detail today
Has: Information block (destination/duration/group/meeting/included-excluded — *genuinely strong*), Tour Plan (itinerary), Location, Gallery, Reviews.
**Missing vs them:** Overview/Value highlights, Policies, Why-us stats, FAQ, Related tours, price anchoring, Inquire/contact CTA, storytelling blocks, real hero/gallery imagery.

---

## 4. Destination pages = editorial landing pages (not faceted grids)

Lily's `tours-in-sapa` is a **marketing landing page**, not a filterable list:
"SAPA — THE END OF THE HIMALAYAS — TOURS FROM ONLY $25" → curated tours →
**Lily's Travel Guarantee / We've got you covered** → value-prop trio (LUXURY
TRANSFERS · UNIQUE ITINERARIES · EPIC MEALS) → bundle offer. Each destination is
its own story + guarantee + curated tours.

---

## 5. The travel-site "playbook" (what both do, we don't)

1. **Destination-led browsing** (grid + per-destination landing).
2. **Trust everywhere** — reviews, awards, stats, testimonials, guarantees.
3. **Storytelling + big imagery** over spec dumps.
4. **Multi-channel contact + floating chat** (WhatsApp/Zalo) — high-ticket buys need conversation.
5. **Price psychology** — "from", strikethrough/discount, "per adult".
6. **Content/SEO** — travel blog/tips.

**Where we already WIN:** a complete **online booking → Stripe → my-bookings →
review** loop (Lily's/Nom Nom still close by chat). We have the conversion
*infrastructure*; we lack the emotional + trust + navigation *lead-up* that makes
people want to click Book.

---

## 6. Proposed phase breakdown (incremental — feeds the refresh spec/plan)

| Phase | Theme | Effort | Backend |
| --- | --- | --- | --- |
| **P0** | **Data + media hygiene** — real hero/gallery imagery, remove seed junk ("Tour Seed Dest", "Updated description.", duplicate departures) | low | data/Cloudinary only |
| **P1** | **Design-token warm-up** — warmer palette + display heading + pill buttons in `@tourism/ui` tokens (pick a direction: Lily-red vs Nom-Nom-sage vs hybrid) | med | none |
| **P2** | **Destination-led nav + landing** — homepage destination grid; per-destination landing; tour filter by destination/category | med | FE (relations exist) |
| **P3** | **Trust layer** — ratings on cards, "Why book with us" stats, testimonials, secure-checkout signals | med | uses existing reviews |
| **P4** | **Detail-page enrichment** — Overview/highlights, Policies, FAQ, Related tours, price "from", a storytelling block above the spec block | med | maybe small DTO (FAQ/highlights) — or FE-static first |
| **P5** | **Homepage depth + contact** — hero search, value props, contact/chat affordance, footer richness | med | none |
| **P6** (later) | **Content/SEO** — travel tips/blog | high | new module |

Recommended order: **P0 → P1 → P2 → P3 → P4 → P5**. P0 alone fixes most of the
"looks unfinished" perception at near-zero code cost.

> Open decision before the spec: **visual direction** (Lily-red / Nom-Nom-sage /
> a warm hybrid that keeps our editorial base). This anchors P1's tokens.
