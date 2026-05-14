# Frontend — Kế hoạch Customer

> 🇬🇧 English version: [`../../en/frontend/customer-plan.md`](../../en/frontend/customer-plan.md).

Last reviewed: 2026-05-14. Trạng thái: đã lên kế hoạch, chưa start.

## Code nằm ở đâu

FE customer là **repo sibling**, không phải folder con của `tourism-be-api`:

```
C:\Development\09.Projects\
├── tourism-be-api\              ← bạn đang ở đây (NestJS, BE-first, sprint B0–B4.6 done)
├── tourism-frontend-customer\   ← kế hoạch này nói về repo này
└── tourism-frontend-admin\      ← làm sau khi xong FE customer
```

Cố ý giữ BE docs làm single source of truth về sprint — 2 FE repo có README mỏng nhưng tracker đa repo vẫn ở đây.

## Template hiện có gì sẵn

Repo bootstrap từ Next.js + shadcn template; chưa có business code.

| Layer | Đã wire |
| --- | --- |
| Framework | Next.js 16 (App Router) với Turbopack dev server |
| UI runtime | React 19, TypeScript 5.9 |
| Styling | Tailwind v4 (CSS-first config trong `globals.css`) + `tw-animate-css` |
| Components | 55 shadcn primitive trong `components/ui/` (Card, Dialog, Sheet, Tabs, Carousel, Drawer, ...) |
| Theming | `next-themes` qua `<ThemeProvider>` ở root layout; nhấn `d` để toggle dark mode |
| Pages | `/` (template placeholder), `/login`, `/signup` (form có nhưng chưa wire) |
| Tooltip | `<TooltipProvider>` mount global |
| Fonts | Geist + JetBrains Mono preload qua `next/font/google` |
| Tooling | ESLint 9 + Prettier 3 (+ `prettier-plugin-tailwindcss`) + `tsc --noEmit` |

**Chưa có** (mỗi item land trong 1 sprint):

- Supabase client (`@supabase/supabase-js`, `@supabase/ssr`)
- i18n (`next-intl` middleware + `messages/{en,vi}.json`)
- Server state (`@tanstack/react-query`)
- Client state (`zustand` cho UI ephemeral như booking wizard)
- Form (`react-hook-form` + `zod` + `@hookform/resolvers`)
- Stripe Checkout redirect helper
- Generated API client (từ BE Swagger ở `/api/docs`)
- Trang booking, catalog tour, tour detail, account
- SEO meta (`generateMetadata`) + sitemap + robots
- Playwright E2E setup

## Quyết định kiến trúc (đã chốt)

Đã finalise sau khi đi qua Figma; document để FE sprint không tranh luận lại.

### Authentication

- **Supabase Auth** là identity provider duy nhất. BE không mint token.
- FE gọi `supabase.auth.signInWithPassword` / `signUp` → nhận JWT.
- Ngay sau lần sign-in (hoặc sign-up) đầu tiên, FE gọi `POST /api/v1/auth/sync` để BE mirror user vào table `users`. Gọi lại an toàn — idempotent.
- JWT gửi qua `Authorization: Bearer <token>` trên mọi call BE. BE verify qua Supabase JWKS (`SupabaseJwtGuard` đã wire).
- Dùng **Supabase SSR cookie** (`@supabase/ssr`) để server component đọc được session cho trang SEO-sensitive (account, booking detail).

### Server state

- **TanStack Query** cho mọi thứ hit BE. Mỗi endpoint có 1 typed hook.
- Quy ước cache key: `['tours', filters]`, `['tour', slug]`, `['booking', code]`, `['wishlist']`, `['reviews', slug]`.
- Invalidation: `wishlist toggle` → invalidate `['wishlist']`; `booking refund webhook landed` → poll `['booking', code]` khi success page mở.

### Data fetching split

| Trang | Strategy | Lý do |
| --- | --- | --- |
| `/` home | Server component, ISR (60s) | SEO; tour list ít thay đổi |
| `/tours` catalog | Server component cho first paint; client-side filter qua React Query | Filter UX cần update nhanh không reload |
| `/tours/[slug]` detail | Server component + ISR | SEO + share preview; tab là client island |
| `/checkout/success` | Client component (poll `GET /bookings/:code`) | Cần thấy transition PAID land realtime |
| `/account/*` | Client component, gated bằng middleware | Personal data — không bao giờ SSR-cache |

### i18n

- `next-intl` với route prefix theo locale: `/en/...` và `/vi/...`. Redirect default từ `/` theo `Accept-Language` rồi fallback `en`.
- Locale persist vào `user.locale` qua `PATCH /users/me` sau lần edit profile đầu; SSR đọc từ cookie.
- File message ở `messages/en.json` + `messages/vi.json`. Key group theo surface (`home.hero.title`, `bookings.errors.SEATS_NOT_AVAILABLE`).

### Form

- `react-hook-form` + `zod` schema mirror DTO của BE.
- Cho booking form, re-derive Zod schema từ constraint của BE (numAdults ≥ 1, contactEmail valid, ...) — không cần shared package; schema đủ nhỏ để sync tay.

### Stripe Checkout

1. `POST /bookings` → `{ checkoutUrl, bookingCode }`.
2. `window.location.href = checkoutUrl` (full redirect; không Stripe.js / Elements).
3. Stripe redirect lại `/checkout/success?session_id=cs_test_xxx&code=BK-XXXX` sau khi pay.
4. Success page poll `GET /bookings/:code` đến khi `status === 'PAID'` (max ~10s). Webhook flip row trong <2s thường.

### Styling — Figma alignment

- shadcn default dùng palette neutral generic. Override trong `globals.css`:
  - `--primary: #EF6B4B` (coral, màu CTA từ Figma).
  - `--foreground: #15233B` (navy đậm).
  - Display font: `Pinyon Script` hoặc `Allura` (Google Fonts) cho hero script ("About Us", "Landscapes", "Wanderlust"). Load làm `--font-display`.
  - Heading: `Playfair Display` cho section title.
  - Body: `Poppins` (hoặc giữ `Geist` hiện có nếu đọc tương tự).
- Polaroid frame, shell trang trí, icon dịch vụ illustrated → asset static ở `public/figma-assets/`. Compress + serve qua Next.js `<Image>` để responsive auto.

## Kế hoạch sprint

Theo pattern granular-commit giống BE sprint. Mỗi sub-feature 1 commit code + test + screenshot ở `docs/frontend/screenshots/`.

### Sprint C0 — Foundation (2-3 ngày)

| # | Sub-feature |
| --- | --- |
| C0.1 | Cài dep: `@supabase/supabase-js @supabase/ssr next-intl @tanstack/react-query zustand react-hook-form zod @hookform/resolvers openapi-typescript-codegen` |
| C0.2 | `.env.example` + validator env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` |
| C0.3 | Tái cấu trúc folder: `app/[locale]/...`; `lib/supabase/{client,server,middleware}.ts`; `lib/api/`; `lib/i18n/`; `messages/{en,vi}.json` |
| C0.4 | Root layout: `<QueryProvider>` + `<NextIntlClientProvider>` + override màu Figma + display font |
| C0.5 | Generate typed API client từ `http://localhost:3000/api/docs-json` vào `lib/api/generated/` |
| C0.6 | Locale switcher component + middleware cho `/en` ↔ `/vi` |

### Sprint C1 — Auth + Catalog (1.5 tuần)

| # | Sub-feature |
| --- | --- |
| C1.1 | Wire form login/signup vào Supabase Auth (email/password + Google OAuth button) |
| C1.2 | Sau auth: gọi `POST /auth/sync`; redirect về `/` |
| C1.3 | `/` home: hero + strip tour featured (`GET /tours?featured=true&limit=6`) + services + testimonials |
| C1.4 | `/tours` catalog: filter sidebar (destination, category, price, duration) + sort tabs + pagination |
| C1.5 | `/tours/[slug]` detail: 4 tab (Information / Tour Plan / Location / Gallery) theo Figma |
| C1.6 | `/destinations/[slug]` landing |
| C1.7 | Embla carousel cho tour gallery |

### Sprint C2 — Booking + Payment (1.5 tuần)

| # | Sub-feature |
| --- | --- |
| C2.1 | Booking form sticky trên tour detail: departure picker + adults/children + contact info |
| C2.2 | `POST /bookings` → redirect `checkoutUrl` |
| C2.3 | `/checkout/success` poller (status PENDING → PAID) |
| C2.4 | `/checkout/cancel` |
| C2.5 | `/account/bookings` list với filter status |
| C2.6 | `/account/bookings/[code]` detail |

### Sprint C3 — Reviews + Wishlist + Polish (1.5 tuần)

| # | Sub-feature |
| --- | --- |
| C3.1 | Review form trên tour detail (gate bằng `bookings` PAID chưa có review) |
| C3.2 | Wishlist heart icon trên `TourCard` + trang `/account/wishlist` |
| C3.3 | `/account/profile` (full_name, phone, locale) |
| C3.4 | Bản dịch tiếng Việt hoàn chỉnh trên mọi surface |
| C3.5 | SEO: `generateMetadata` per page + OG tag + sitemap + robots |
| C3.6 | Performance: Lighthouse ≥ 90 trên home + tour detail (mobile) |
| C3.7 | Playwright: 3 critical journey — `browse → book → pay`, `login → sync → wishlist`, `account xem bookings` |
| C3.8 | Deploy Vercel preview (production deploy giữ trong Sprint B5) |

## Assumption local dev

- BE chạy ở `http://localhost:3000/api/v1` với `/api/docs` Swagger live.
- FE customer chạy ở `http://localhost:3001` (Next.js dev default + 1).
- FE admin chạy ở `http://localhost:3002` (làm sau khi xong customer FE).
- Supabase / Stripe / Resend giữ remote — không cần docker-compose dance. Stripe CLI tunnel duy trì webhook flow như đã prove ở Sprint B3.

## Cái gì ở đâu trong FE sprint

- BE vẫn BE-first — thay đổi schema hoặc service vẫn xảy ra ở đây, không phải trong FE repo.
- Doc sprint FE (note per-feature, screenshot, decision log) đi vào `tourism-be-api/docs/{en,vi}/frontend/`.
- FE repo nhận README phong phú hơn cover local-dev quickstart; không duplicate sprint tracker.

## Rủi ro riêng cho FE customer

| Rủi ro | Mitigation |
| --- | --- |
| Bản dịch tiếng Việt trễ | Viết string tiếng Anh trước với i18n key từ ngày 1; batch translate VI ở cuối mỗi sprint, không giữa feature |
| Stripe redirect break trên localhost không HTTPS | Stripe Checkout chạy OK trên http://localhost — không cần setup gì thêm; mention vì dev mới thường tưởng phải HTTPS-only |
| Booking success page poll mãi nếu webhook miss | Cap ở 15 poll @ 1s, sau đó show "still processing — refresh in a minute" CTA. Webhook là path authoritative |
| Card / hero hydration mismatch dưới SSR | Dùng `useEffect` cho mọi UI có `Date.now()` / `Math.random()`; giữ HTML server-render deterministic |
| Shadcn default trông generic | Style override document ở C0.4; ship review `globals.css` cuối C1 |

## Sau FE customer: admin FE

Khi FE customer đã ở Vercel preview và flow end-to-end work không cần đổi BE, FE admin tiếp theo. Plan cho admin sẽ ở `frontend/admin-plan.md` lúc đó.

## Acceptance cho phase FE customer

- Customer có thể sign up, browse, filter, book, pay với test card, thấy confirm PAID, leave review, manage wishlist, update profile — tất cả EN và VI, tất cả chạy local gọi BE local.
- Lighthouse mobile ≥ 90 perf + ≥ 90 a11y trên home + tour detail.
- 3 Playwright journey pass headless.
- Không ship thay đổi BE trong FE sprint (gap nào → BACKLOG, không phải BE work giữa sprint).
