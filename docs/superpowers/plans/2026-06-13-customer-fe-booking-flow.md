# Customer FE — Booking Flow (D1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full purchase loop in `apps/web`: `/tours/[slug]/book` form → `POST /bookings` server action → Stripe Checkout redirect → `/checkout/success|cancel` with webhook-aware status polling; `BookingSidebar`'s disabled CTA becomes per-departure Book links.

**Architecture:** RSC book page (reverse guard + parallel server loads + profile prefill) renders a client RHF+zod form; mutations/polls go through server actions (C2 `updateProfile` pattern — token never client-side); `bookingCode` crosses the Stripe redirect via `sessionStorage`; the success page drives a pure, TDD'd poll state machine. Backend unchanged.

**Tech Stack:** Next.js 16 App Router, react-hook-form + zod 4 (`.refine` takes `{ message }`), openapi-fetch typed client, next-intl EN/VI, Vitest. E2E: Playwright + Stripe test card + the repo's self-signed webhook harness pattern.

**Conventions (read before coding):**
- Modified Next.js — per `apps/web/AGENTS.md`, consult `node_modules/next/dist/docs/` for unfamiliar APIs.
- Tests `pnpm --filter @tourism/web test`; typecheck/lint same filter. Theme tokens only (no hex); no `console.log` (`console.error` allowed for server-side failures).
- Reference patterns: `features/account/actions.ts` (server-action result mapping), `features/account/schema.ts` (zod stable-key messages), `lib/api/users.ts` (authed typed client), `app/[locale]/(site)/account/page.tsx` (reverse guard + object-href redirect), `features/tour-detail/detail-view-model.ts` (`DepartureVM`).
- Spec: `docs/superpowers/specs/2026-06-13-customer-fe-booking-flow-design.md`.

**File structure (all under `apps/web/src/` unless noted):**
- `lib/api/bookings.ts` (+test) — authed `createBookingRequest`, `getBookingByCode`.
- `features/booking/schema.ts` (+test) — `bookingSchema`/`BookingValues`.
- `features/booking/pricing.ts` (+test) — `computeTotal`.
- `features/booking/booking-error.ts` (+test) — `mapBookingError`.
- `features/booking/poll.ts` (+test) — `nextPollState`.
- `features/booking/actions.ts` (+test) — `createBooking`, `getBookingStatus`.
- `features/booking/booking-form.tsx` — client form.
- `features/booking/checkout-status.tsx` — client poll UI.
- `app/[locale]/(site)/tours/[slug]/book/page.tsx` + `loading.tsx`.
- `app/[locale]/(site)/checkout/success/page.tsx`, `checkout/cancel/page.tsx`.
- `features/tour-detail/booking-sidebar.tsx` (+test), `tour-detail.tsx` — seam flip.
- `messages/en.json`, `vi.json` — `Booking` namespace.
- `docs/planning/roadmap.md` — final task.

---

## Task 1: `lib/api/bookings.ts` — authed typed helpers

**Files:**
- Create: `apps/web/src/lib/api/bookings.ts`
- Test: `apps/web/src/lib/api/bookings.test.ts`

- [ ] **Step 1: Write the failing test** (mirror `users.test.ts` mocking style exactly):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  tokens: [] as (string | undefined)[],
}));

vi.mock("@/lib/api/client", () => ({
  createApiClient: (token?: string) => {
    h.tokens.push(token);
    return { GET: h.GET, POST: h.POST };
  },
}));

import { createBookingRequest, getBookingByCode } from "./bookings";

beforeEach(() => {
  h.GET.mockReset();
  h.POST.mockReset();
  h.tokens.length = 0;
});

const created = { bookingCode: "BK-7K3F92AB", checkoutUrl: "https://checkout.stripe.com/c/pay/cs_x" };
const booking = { id: "b-1", code: "BK-7K3F92AB", status: "PAID" };

describe("createBookingRequest", () => {
  it("POSTs /api/v1/bookings with the body and token", async () => {
    h.POST.mockResolvedValue({ data: created });
    const body = { tourSlug: "sa-pa-trek-2d1n", departureId: "d-1", numAdults: 2, contactName: "A", contactEmail: "a@x.com" };
    const res = await createBookingRequest("tok", body);
    expect(res.checkoutUrl).toContain("stripe.com");
    expect(h.POST).toHaveBeenCalledWith("/api/v1/bookings", { body });
    expect(h.tokens).toContain("tok");
  });
  it("propagates ApiError from the envelope middleware", async () => {
    const { ApiError } = await import("./errors");
    h.POST.mockRejectedValue(new ApiError("SEATS_NOT_AVAILABLE", "full", 409));
    await expect(
      createBookingRequest("tok", { tourSlug: "s", departureId: "d", numAdults: 1, contactName: "A", contactEmail: "a@x.com" }),
    ).rejects.toMatchObject({ code: "SEATS_NOT_AVAILABLE" });
  });
  it("throws ApiError(EMPTY) when data missing", async () => {
    h.POST.mockResolvedValue({ data: undefined });
    await expect(
      createBookingRequest("tok", { tourSlug: "s", departureId: "d", numAdults: 1, contactName: "A", contactEmail: "a@x.com" }),
    ).rejects.toMatchObject({ code: "EMPTY" });
  });
});

describe("getBookingByCode", () => {
  it("GETs /api/v1/bookings/{code} and returns the booking", async () => {
    h.GET.mockResolvedValue({ data: booking });
    const res = await getBookingByCode("tok", "BK-7K3F92AB");
    expect(res.status).toBe("PAID");
    expect(h.GET).toHaveBeenCalledWith("/api/v1/bookings/{code}", {
      params: { path: { code: "BK-7K3F92AB" } },
    });
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `pnpm --filter @tourism/web test -- bookings.test`
Expected: FAIL — cannot resolve `./bookings`.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/lib/api/bookings.ts
import { createApiClient } from "./client";
import { ApiError } from "./errors";
import type { components } from "./schema";

export type CreateBookingBody = components["schemas"]["CreateBookingDto"];
export type CreatedBooking = components["schemas"]["CreateBookingResponseDto"];
export type Booking = components["schemas"]["BookingDto"];

/** Creates a PENDING booking + Stripe Checkout session (authed). */
export async function createBookingRequest(
  token: string,
  body: CreateBookingBody,
): Promise<CreatedBooking> {
  const { data } = await createApiClient(token).POST("/api/v1/bookings", { body });
  if (!data) throw new ApiError("EMPTY", "Empty /bookings response", 200);
  return data;
}

/** Fetches one booking by code (owner-or-admin enforced server-side). */
export async function getBookingByCode(token: string, code: string): Promise<Booking> {
  const { data } = await createApiClient(token).GET("/api/v1/bookings/{code}", {
    params: { path: { code } },
  });
  if (!data) throw new ApiError("EMPTY", "Empty /bookings/{code} response", 200);
  return data;
}
```

NOTE: verify the exact path-template key in `schema.d.ts` (`"/api/v1/bookings/{code}"`) and adjust the test + impl together if the generated key differs.

- [ ] **Step 4: Run to verify GREEN** — same command, all pass.
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api/bookings.ts apps/web/src/lib/api/bookings.test.ts
git commit -m "feat(web): typed bookings api helpers (create + get-by-code)"
```

---

## Task 2: `features/booking/schema.ts` — zod form schema

**Files:**
- Create: `apps/web/src/features/booking/schema.ts`
- Test: `apps/web/src/features/booking/schema.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { bookingSchema } from "./schema";

const valid = {
  departureId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  numAdults: 2,
  numChildren: 1,
  contactName: "Nguyen Van A",
  contactEmail: "a@example.com",
  contactPhone: "+84901234567",
  specialRequests: "Vegetarian",
};

describe("bookingSchema", () => {
  it("accepts a fully valid booking", () => {
    expect(bookingSchema.safeParse(valid).success).toBe(true);
  });
  it("accepts empty optional phone/requests", () => {
    expect(bookingSchema.safeParse({ ...valid, contactPhone: "", specialRequests: "" }).success).toBe(true);
  });
  it("requires a departure id (uuid)", () => {
    expect(bookingSchema.safeParse({ ...valid, departureId: "" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, departureId: "not-a-uuid" }).success).toBe(false);
  });
  it("bounds adults 1–20 and children 0–20 (integers)", () => {
    expect(bookingSchema.safeParse({ ...valid, numAdults: 0 }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, numAdults: 21 }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, numChildren: -1 }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, numChildren: 21 }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, numAdults: 1.5 }).success).toBe(false);
  });
  it("validates contact fields like the backend DTO", () => {
    expect(bookingSchema.safeParse({ ...valid, contactName: "" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, contactName: "x".repeat(121) }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, contactEmail: "not-mail" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, contactPhone: "12345" }).success).toBe(false); // <6
    expect(bookingSchema.safeParse({ ...valid, contactPhone: "1".repeat(31) }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, specialRequests: "x".repeat(1001) }).success).toBe(false);
  });
});
```

- [ ] **Step 2: RED** — `pnpm --filter @tourism/web test -- booking/schema.test`
- [ ] **Step 3: Implement** (messages are STABLE KEYS under the `Booking` namespace, same convention as `features/account/schema.ts`; zod 4 `.refine(fn, { message })`):

```ts
// apps/web/src/features/booking/schema.ts
import { z } from "zod";

// Mirrors backend CreateBookingDto (tourSlug is supplied by the page, not
// the form). Validation messages are STABLE KEYS under the `Booking`
// namespace — keep in sync with messages/*.json.
const phone = z
  .string()
  .trim()
  .refine((v) => v === "" || (v.length >= 6 && v.length <= 30), {
    message: "errors.phoneLength",
  });

export const bookingSchema = z.object({
  departureId: z.uuid({ message: "errors.departureRequired" }),
  numAdults: z.number().int().min(1, "errors.adultsRange").max(20, "errors.adultsRange"),
  numChildren: z.number().int().min(0, "errors.childrenRange").max(20, "errors.childrenRange"),
  contactName: z.string().trim().min(1, "errors.nameRequired").max(120, "errors.nameMax"),
  contactEmail: z.email({ message: "errors.emailInvalid" }).max(200, "errors.emailInvalid"),
  contactPhone: phone,
  specialRequests: z.string().trim().max(1000, "errors.requestsMax"),
});

export type BookingValues = z.infer<typeof bookingSchema>;
```

NOTE: zod 4 moved `z.string().uuid()/email()` to top-level `z.uuid()`/`z.email()`; if the project's zod version rejects that form, use `z.string().uuid("errors.departureRequired")` / `z.string().email("errors.emailInvalid")` — confirm against `features/auth/schemas.ts` usage and the installed zod.

- [ ] **Step 4: GREEN**, **Step 5: Commit** — `feat(web): booking form zod schema`

---

## Task 3: `features/booking/pricing.ts` — `computeTotal`

**Files:**
- Create: `apps/web/src/features/booking/pricing.ts`
- Test: `apps/web/src/features/booking/pricing.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { computeTotal } from "./pricing";

describe("computeTotal", () => {
  it("multiplies unit price by total seats (adults + children)", () => {
    expect(computeTotal(49.5, 2, 1)).toBe(148.5);
  });
  it("treats children as full seats (backend parity)", () => {
    expect(computeTotal(100, 1, 2)).toBe(300);
  });
  it("rounds to 2 decimals to avoid float noise in display", () => {
    expect(computeTotal(19.99, 3, 0)).toBe(59.97);
    expect(computeTotal(0.1, 3, 0)).toBe(0.3);
  });
});
```

- [ ] **Step 2: RED** — `pnpm --filter @tourism/web test -- pricing.test`
- [ ] **Step 3: Implement**

```ts
// apps/web/src/features/booking/pricing.ts
/**
 * DISPLAY-ONLY estimate mirroring the backend formula
 * `totalAmount = (numAdults + numChildren) × effectiveUnitPrice`.
 * The server always recomputes from DB prices — this never goes on the wire.
 */
export function computeTotal(unitPrice: number, adults: number, children: number): number {
  return Math.round(unitPrice * (adults + children) * 100) / 100;
}
```

- [ ] **Step 4: GREEN**, **Step 5: Commit** — `feat(web): display-only booking total helper`

---

## Task 4: `features/booking/booking-error.ts` — `mapBookingError`

**Files:**
- Create: `apps/web/src/features/booking/booking-error.ts`
- Test: `apps/web/src/features/booking/booking-error.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { mapBookingError } from "./booking-error";

describe("mapBookingError", () => {
  it("maps each backend code to its Booking i18n key", () => {
    expect(mapBookingError("DEPARTURE_DEPARTED")).toBe("errors.departureDeparted");
    expect(mapBookingError("DEPARTURE_NOT_OPEN")).toBe("errors.departureNotOpen");
    expect(mapBookingError("SEATS_NOT_AVAILABLE")).toBe("errors.seatsNotAvailable");
    expect(mapBookingError("TOUR_NOT_FOUND")).toBe("errors.notFound");
    expect(mapBookingError("DEPARTURE_NOT_FOUND")).toBe("errors.notFound");
  });
  it("falls back to generic for anything else", () => {
    expect(mapBookingError("STRIPE_SESSION_INVALID")).toBe("errors.generic");
    expect(mapBookingError(undefined)).toBe("errors.generic");
  });
});
```

- [ ] **Step 2: RED**, **Step 3: Implement**

```ts
// apps/web/src/features/booking/booking-error.ts
/** Maps POST /bookings ApiError codes to STABLE KEYS in the Booking namespace. */
export function mapBookingError(code: string | undefined): string {
  switch (code) {
    case "DEPARTURE_DEPARTED":
      return "errors.departureDeparted";
    case "DEPARTURE_NOT_OPEN":
      return "errors.departureNotOpen";
    case "SEATS_NOT_AVAILABLE":
      return "errors.seatsNotAvailable";
    case "TOUR_NOT_FOUND":
    case "DEPARTURE_NOT_FOUND":
      return "errors.notFound";
    default:
      return "errors.generic";
  }
}
```

- [ ] **Step 4: GREEN**, **Step 5: Commit** — `feat(web): booking error code→i18n mapper`

---

## Task 5: `features/booking/poll.ts` — `nextPollState`

**Files:**
- Create: `apps/web/src/features/booking/poll.ts`
- Test: `apps/web/src/features/booking/poll.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { nextPollState, POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "./poll";

describe("nextPollState", () => {
  it("keeps polling while PENDING within the timeout window", () => {
    expect(nextPollState({ ok: true, status: "PENDING" }, 4_000, 0)).toEqual({ kind: "polling" });
  });
  it("settles on PAID / CANCELLED / REFUNDED", () => {
    expect(nextPollState({ ok: true, status: "PAID" }, 4_000, 0)).toEqual({ kind: "paid" });
    expect(nextPollState({ ok: true, status: "CANCELLED" }, 4_000, 0)).toEqual({ kind: "expired" });
    expect(nextPollState({ ok: true, status: "REFUNDED" }, 4_000, 0)).toEqual({ kind: "refunded" });
  });
  it("times out after POLL_TIMEOUT_MS of PENDING", () => {
    expect(nextPollState({ ok: true, status: "PENDING" }, POLL_TIMEOUT_MS, 0)).toEqual({ kind: "timeout" });
  });
  it("retries one failed fetch, then falls back", () => {
    expect(nextPollState({ ok: false }, 4_000, 0)).toEqual({ kind: "polling", retries: 1 });
    expect(nextPollState({ ok: false }, 4_000, 1)).toEqual({ kind: "fallback" });
  });
  it("exports sane constants", () => {
    expect(POLL_INTERVAL_MS).toBe(2_000);
    expect(POLL_TIMEOUT_MS).toBe(30_000);
  });
});
```

- [ ] **Step 2: RED**, **Step 3: Implement**

```ts
// apps/web/src/features/booking/poll.ts
export const POLL_INTERVAL_MS = 2_000;
export const POLL_TIMEOUT_MS = 30_000;

export type PollResult =
  | { ok: true; status: "PENDING" | "PAID" | "CANCELLED" | "REFUNDED" }
  | { ok: false };

export type PollState =
  | { kind: "polling"; retries?: number }
  | { kind: "paid" }
  | { kind: "expired" }
  | { kind: "refunded" }
  | { kind: "timeout" }
  | { kind: "fallback" };

/**
 * Pure transition for the success-page poll loop. PENDING keeps polling
 * until POLL_TIMEOUT_MS of elapsed time; a failed fetch is retried once
 * before degrading to the fallback panel (the webhook settles the booking
 * server-side regardless of what this page shows).
 */
export function nextPollState(
  result: PollResult,
  elapsedMs: number,
  retries: number,
): PollState {
  if (!result.ok) {
    return retries < 1 ? { kind: "polling", retries: retries + 1 } : { kind: "fallback" };
  }
  switch (result.status) {
    case "PAID":
      return { kind: "paid" };
    case "CANCELLED":
      return { kind: "expired" };
    case "REFUNDED":
      return { kind: "refunded" };
    case "PENDING":
      return elapsedMs >= POLL_TIMEOUT_MS ? { kind: "timeout" } : { kind: "polling" };
  }
}
```

- [ ] **Step 4: GREEN**, **Step 5: Commit** — `feat(web): checkout poll state machine`

---

## Task 6: `features/booking/actions.ts` — server actions

**Files:**
- Create: `apps/web/src/features/booking/actions.ts`
- Test: `apps/web/src/features/booking/actions.test.ts`

- [ ] **Step 1: Failing test** (mock pattern = `features/account/actions.test.ts`):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getSession: vi.fn(),
  createBookingRequest: vi.fn(),
  getBookingByCode: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getSession: h.getSession } }),
}));
vi.mock("@/lib/api/bookings", () => ({
  createBookingRequest: h.createBookingRequest,
  getBookingByCode: h.getBookingByCode,
}));

import { createBooking, getBookingStatus } from "./actions";
import { ApiError } from "@/lib/api/errors";

const values = {
  departureId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  numAdults: 2,
  numChildren: 0,
  contactName: "A",
  contactEmail: "a@x.com",
  contactPhone: "",
  specialRequests: "",
};

beforeEach(() => {
  h.getSession.mockReset();
  h.createBookingRequest.mockReset();
  h.getBookingByCode.mockReset();
  h.getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

describe("createBooking", () => {
  it("returns NO_SESSION without a session", async () => {
    h.getSession.mockResolvedValue({ data: { session: null } });
    expect(await createBooking("sa-pa", values)).toEqual({ ok: false, code: "NO_SESSION" });
    expect(h.createBookingRequest).not.toHaveBeenCalled();
  });
  it("returns VALIDATION on bad values", async () => {
    expect(await createBooking("sa-pa", { ...values, numAdults: 0 })).toEqual({ ok: false, code: "VALIDATION" });
  });
  it("omits empty optionals and returns code + url on success", async () => {
    h.createBookingRequest.mockResolvedValue({ bookingCode: "BK-X", checkoutUrl: "https://stripe/u" });
    const res = await createBooking("sa-pa", values);
    expect(res).toEqual({ ok: true, bookingCode: "BK-X", checkoutUrl: "https://stripe/u" });
    const sent = h.createBookingRequest.mock.calls[0][1] as Record<string, unknown>;
    expect(sent.tourSlug).toBe("sa-pa");
    expect(sent).not.toHaveProperty("contactPhone");
    expect(sent).not.toHaveProperty("specialRequests");
  });
  it("surfaces the ApiError code on backend rejection", async () => {
    h.createBookingRequest.mockRejectedValue(new ApiError("DEPARTURE_DEPARTED", "past", 400));
    expect(await createBooking("sa-pa", values)).toEqual({ ok: false, code: "DEPARTURE_DEPARTED" });
  });
  it("maps non-ApiError failures to REQUEST_FAILED", async () => {
    h.createBookingRequest.mockRejectedValue(new Error("boom"));
    expect(await createBooking("sa-pa", values)).toEqual({ ok: false, code: "REQUEST_FAILED" });
  });
});

describe("getBookingStatus", () => {
  it("returns status + display fields on success", async () => {
    h.getBookingByCode.mockResolvedValue({
      code: "BK-X", status: "PAID", totalAmount: "99.00", currency: "USD",
      numAdults: 2, numChildren: 0,
    });
    const res = await getBookingStatus("BK-X");
    expect(res).toMatchObject({ ok: true, status: "PAID", booking: { code: "BK-X" } });
  });
  it("returns ok:false on any failure (poll loop retries)", async () => {
    h.getBookingByCode.mockRejectedValue(new ApiError("BOOKING_NOT_FOUND", "nf", 404));
    expect(await getBookingStatus("BK-X")).toEqual({ ok: false });
  });
});
```

- [ ] **Step 2: RED**, **Step 3: Implement**

```ts
// apps/web/src/features/booking/actions.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createBookingRequest,
  getBookingByCode,
  type Booking,
  type CreateBookingBody,
} from "@/lib/api/bookings";
import { ApiError } from "@/lib/api/errors";
import { bookingSchema, type BookingValues } from "./schema";

export type CreateBookingResult =
  | { ok: true; bookingCode: string; checkoutUrl: string }
  | { ok: false; code: string };

/**
 * Creates the PENDING booking + Stripe session. Token is read server-side;
 * empty optional fields are OMITTED (backend phone validator rejects "").
 */
export async function createBooking(
  tourSlug: string,
  values: BookingValues,
): Promise<CreateBookingResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, code: "NO_SESSION" };

  const parsed = bookingSchema.safeParse(values);
  if (!parsed.success) return { ok: false, code: "VALIDATION" };

  const body: CreateBookingBody = {
    tourSlug,
    departureId: parsed.data.departureId,
    numAdults: parsed.data.numAdults,
    numChildren: parsed.data.numChildren,
    contactName: parsed.data.contactName,
    contactEmail: parsed.data.contactEmail,
    ...(parsed.data.contactPhone ? { contactPhone: parsed.data.contactPhone } : {}),
    ...(parsed.data.specialRequests ? { specialRequests: parsed.data.specialRequests } : {}),
  };

  try {
    const created = await createBookingRequest(session.access_token, body);
    return { ok: true, bookingCode: created.bookingCode, checkoutUrl: created.checkoutUrl };
  } catch (err) {
    if (ApiError.isApiError(err)) return { ok: false, code: err.code };
    console.error("createBooking failed", err);
    return { ok: false, code: "REQUEST_FAILED" };
  }
}

export type BookingStatusResult =
  | { ok: true; status: Booking["status"]; booking: Pick<Booking, "code" | "totalAmount" | "currency" | "numAdults" | "numChildren"> }
  | { ok: false };

/** Poll target for /checkout/success. Failures are soft — the loop retries. */
export async function getBookingStatus(code: string): Promise<BookingStatusResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false };

  try {
    const b = await getBookingByCode(session.access_token, code);
    return {
      ok: true,
      status: b.status,
      booking: {
        code: b.code,
        totalAmount: b.totalAmount,
        currency: b.currency,
        numAdults: b.numAdults,
        numChildren: b.numChildren,
      },
    };
  } catch {
    return { ok: false };
  }
}
```

- [ ] **Step 4: GREEN + full suite** — `pnpm --filter @tourism/web test` all pass.
- [ ] **Step 5: Commit** — `feat(web): createBooking/getBookingStatus server actions`

---

## Task 7: i18n `Booking` namespace (EN/VI)

**Files:**
- Modify: `apps/web/messages/en.json`, `apps/web/messages/vi.json`

- [ ] **Step 1: Insert into `en.json`** as a top-level namespace after `"Account"` (preserve file line-endings — insert with anchored string edits, NOT a JSON.stringify rewrite):

```json
"Booking": {
  "form": {
    "title": "Book this tour",
    "departureLabel": "Choose a departure",
    "seatsLeft": "{count} seats left",
    "soldOut": "Sold out",
    "adults": "Adults",
    "children": "Children",
    "contactName": "Contact name",
    "contactEmail": "Contact email",
    "contactPhone": "Contact phone (optional)",
    "specialRequests": "Special requests (optional)",
    "total": "Estimated total",
    "totalNote": "Final amount is confirmed by the server at checkout.",
    "submit": "Continue to payment",
    "submitting": "Preparing checkout…",
    "empty": "No upcoming departures for this tour.",
    "backToTour": "Back to tour"
  },
  "errors": {
    "departureRequired": "Choose a departure.",
    "adultsRange": "Adults must be between 1 and 20.",
    "childrenRange": "Children must be between 0 and 20.",
    "nameRequired": "Contact name is required.",
    "nameMax": "Contact name must be 120 characters or fewer.",
    "emailInvalid": "Enter a valid email address.",
    "phoneLength": "Phone must be between 6 and 30 characters.",
    "requestsMax": "Special requests must be 1000 characters or fewer.",
    "departureDeparted": "This departure has already started. Pick another date.",
    "departureNotOpen": "This departure is closed for booking. Pick another date.",
    "seatsNotAvailable": "Not enough seats left for your group. Pick another date or reduce seats.",
    "notFound": "This tour or departure is no longer available.",
    "generic": "Something went wrong. Please try again."
  },
  "success": {
    "processing": "Payment received — confirming your booking…",
    "paidTitle": "Booking confirmed!",
    "paidBody": "A confirmation email is on its way.",
    "code": "Booking code",
    "seats": "{adults} adult(s), {children} child(ren)",
    "total": "Total paid",
    "timeout": "Your payment is still being processed. Check your account in a few minutes.",
    "missingCode": "Payment received. Your booking will appear in your account shortly.",
    "expired": "This checkout session expired before payment completed. Nothing was charged.",
    "refunded": "This booking has been refunded.",
    "backHome": "Back to home"
  },
  "cancel": {
    "title": "Payment not completed",
    "body": "Your booking was not paid and will be cancelled automatically in about 30 minutes. Nothing was charged.",
    "code": "Booking code",
    "retry": "Browse tours"
  }
}
```

- [ ] **Step 2: Insert into `vi.json`** (same structure):

```json
"Booking": {
  "form": {
    "title": "Đặt tour này",
    "departureLabel": "Chọn ngày khởi hành",
    "seatsLeft": "Còn {count} chỗ",
    "soldOut": "Hết chỗ",
    "adults": "Người lớn",
    "children": "Trẻ em",
    "contactName": "Tên liên hệ",
    "contactEmail": "Email liên hệ",
    "contactPhone": "Số điện thoại (không bắt buộc)",
    "specialRequests": "Yêu cầu đặc biệt (không bắt buộc)",
    "total": "Tổng tạm tính",
    "totalNote": "Số tiền cuối cùng do máy chủ xác nhận khi thanh toán.",
    "submit": "Tiếp tục thanh toán",
    "submitting": "Đang chuẩn bị thanh toán…",
    "empty": "Tour này chưa có ngày khởi hành sắp tới.",
    "backToTour": "Quay lại tour"
  },
  "errors": {
    "departureRequired": "Hãy chọn ngày khởi hành.",
    "adultsRange": "Người lớn phải từ 1 đến 20.",
    "childrenRange": "Trẻ em phải từ 0 đến 20.",
    "nameRequired": "Cần nhập tên liên hệ.",
    "nameMax": "Tên liên hệ không vượt quá 120 ký tự.",
    "emailInvalid": "Nhập địa chỉ email hợp lệ.",
    "phoneLength": "Số điện thoại phải từ 6 đến 30 ký tự.",
    "requestsMax": "Yêu cầu đặc biệt không vượt quá 1000 ký tự.",
    "departureDeparted": "Chuyến này đã khởi hành. Hãy chọn ngày khác.",
    "departureNotOpen": "Chuyến này đã đóng đặt chỗ. Hãy chọn ngày khác.",
    "seatsNotAvailable": "Không đủ chỗ cho đoàn của bạn. Hãy chọn ngày khác hoặc giảm số chỗ.",
    "notFound": "Tour hoặc chuyến đi này không còn khả dụng.",
    "generic": "Đã xảy ra lỗi. Vui lòng thử lại."
  },
  "success": {
    "processing": "Đã nhận thanh toán — đang xác nhận đặt chỗ…",
    "paidTitle": "Đặt tour thành công!",
    "paidBody": "Email xác nhận đang được gửi tới bạn.",
    "code": "Mã đặt chỗ",
    "seats": "{adults} người lớn, {children} trẻ em",
    "total": "Tổng đã thanh toán",
    "timeout": "Thanh toán vẫn đang được xử lý. Kiểm tra tài khoản của bạn sau ít phút.",
    "missingCode": "Đã nhận thanh toán. Đơn của bạn sẽ sớm xuất hiện trong tài khoản.",
    "expired": "Phiên thanh toán đã hết hạn trước khi hoàn tất. Bạn chưa bị trừ tiền.",
    "refunded": "Đơn này đã được hoàn tiền.",
    "backHome": "Về trang chủ"
  },
  "cancel": {
    "title": "Chưa hoàn tất thanh toán",
    "body": "Đơn của bạn chưa được thanh toán và sẽ tự hủy sau khoảng 30 phút. Bạn chưa bị trừ tiền.",
    "code": "Mã đặt chỗ",
    "retry": "Xem các tour"
  }
}
```

- [ ] **Step 3: Validate parity**

```bash
node -e "function k(o,p=''){return Object.entries(o).flatMap(([a,b])=>typeof b==='object'&&b?k(b,p+a+'.'):[p+a]);} const e=require('./apps/web/messages/en.json').Booking,v=require('./apps/web/messages/vi.json').Booking; const ek=k(e).sort().join(),vk=k(v).sort().join(); if(ek!==vk) throw new Error('parity'); console.log('ok', k(e).length, 'keys')"
```

- [ ] **Step 4: Commit** — `feat(web): Booking i18n namespace (EN/VI)`

---

## Task 8: `BookingForm` (client)

**Files:**
- Create: `apps/web/src/features/booking/booking-form.tsx`

- [ ] **Step 1: Implement** (verify every `@tourism/ui` import against its source as in C2; all named exports below were confirmed then):

```tsx
"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@tourism/ui/components/legacy/field";
import { Input } from "@tourism/ui/components/legacy/input";
import { Button } from "@tourism/ui/components/custom/button-custom";
import { Alert, AlertDescription } from "@tourism/ui/components/custom/alert-custom";
import { PhoneInput } from "@tourism/ui/components/custom/phone-input";
import type { DepartureVM } from "@/features/tour-detail/detail-view-model";
import { bookingSchema, type BookingValues } from "./schema";
import { computeTotal } from "./pricing";
import { mapBookingError } from "./booking-error";
import { createBooking } from "./actions";

export interface BookingFormProps {
  tourSlug: string;
  currency: string;
  departures: DepartureVM[];
  preselectId: string | null;
  profile: { fullName: string | null; email: string; phone: string | null };
}

export function BookingForm({ tourSlug, currency, departures, preselectId, profile }: BookingFormProps) {
  const t = useTranslations("Booking");
  const locale = useLocale();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BookingValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      departureId: preselectId ?? "",
      numAdults: 1,
      numChildren: 0,
      contactName: profile.fullName ?? "",
      contactEmail: profile.email,
      contactPhone: profile.phone ?? "",
      specialRequests: "",
    },
  });

  const [departureId, numAdults, numChildren] = watch(["departureId", "numAdults", "numChildren"]);
  const selected = departures.find((d) => d.id === departureId) ?? null;
  const localeTag = locale === "vi" ? "vi-VN" : "en-US";
  const money = (n: number) =>
    new Intl.NumberFormat(localeTag, { style: "currency", currency }).format(n);
  const day = (d: string) =>
    new Intl.DateTimeFormat(localeTag, { dateStyle: "medium" }).format(
      new Date(d.length === 10 ? `${d}T00:00:00` : d),
    );
  const total = selected ? computeTotal(selected.price, numAdults || 0, numChildren || 0) : null;

  async function onSubmit(values: BookingValues) {
    setServerError(null);
    const res = await createBooking(tourSlug, values);
    if (!res.ok) {
      setServerError(t(mapBookingError(res.code)));
      return;
    }
    // Stripe's success URL only carries session_id — keep the code locally
    // so /checkout/success can poll the booking (backend-intended design).
    window.sessionStorage.setItem("booking:lastCode", res.bookingCode);
    window.location.assign(res.checkoutUrl);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-xl">
      <FieldGroup className="gap-5">
        {serverError ? (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        <Field className="gap-2">
          <FieldLabel htmlFor="departure-group">{t("form.departureLabel")}</FieldLabel>
          <Controller
            control={control}
            name="departureId"
            render={({ field }) => (
              <div id="departure-group" role="radiogroup" className="flex flex-col gap-2">
                {departures.map((d) => (
                  <label
                    key={d.id}
                    className={`border-border flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 ${
                      field.value === d.id ? "border-primary ring-ring ring-1" : ""
                    } ${d.soldOut ? "opacity-50" : ""}`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name={field.name}
                        value={d.id}
                        checked={field.value === d.id}
                        onChange={() => field.onChange(d.id)}
                        disabled={d.soldOut}
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          {day(d.startDate)} → {day(d.endDate)}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {d.soldOut ? t("form.soldOut") : t("form.seatsLeft", { count: d.seatsLeft })}
                        </span>
                      </span>
                    </span>
                    <span className="text-sm font-semibold">{money(d.price)}</span>
                  </label>
                ))}
              </div>
            )}
          />
          {errors.departureId?.message ? <FieldError>{t(errors.departureId.message)}</FieldError> : null}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field className="gap-2">
            <FieldLabel htmlFor="numAdults">{t("form.adults")}</FieldLabel>
            <Input id="numAdults" type="number" min={1} max={20}
              {...register("numAdults", { valueAsNumber: true })} />
            {errors.numAdults?.message ? <FieldError>{t(errors.numAdults.message)}</FieldError> : null}
          </Field>
          <Field className="gap-2">
            <FieldLabel htmlFor="numChildren">{t("form.children")}</FieldLabel>
            <Input id="numChildren" type="number" min={0} max={20}
              {...register("numChildren", { valueAsNumber: true })} />
            {errors.numChildren?.message ? <FieldError>{t(errors.numChildren.message)}</FieldError> : null}
          </Field>
        </div>

        <Field className="gap-2">
          <FieldLabel htmlFor="contactName">{t("form.contactName")}</FieldLabel>
          <Input id="contactName" autoComplete="name" aria-invalid={!!errors.contactName}
            {...register("contactName")} />
          {errors.contactName?.message ? <FieldError>{t(errors.contactName.message)}</FieldError> : null}
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor="contactEmail">{t("form.contactEmail")}</FieldLabel>
          <Input id="contactEmail" type="email" autoComplete="email" aria-invalid={!!errors.contactEmail}
            {...register("contactEmail")} />
          {errors.contactEmail?.message ? <FieldError>{t(errors.contactEmail.message)}</FieldError> : null}
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor="contactPhone">{t("form.contactPhone")}</FieldLabel>
          <Controller
            control={control}
            name="contactPhone"
            render={({ field }) => (
              <PhoneInput
                id="contactPhone"
                value={field.value || undefined}
                onChange={(v) => field.onChange(v ?? "")}
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.contactPhone?.message ? <FieldError>{t(errors.contactPhone.message)}</FieldError> : null}
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor="specialRequests">{t("form.specialRequests")}</FieldLabel>
          <Input id="specialRequests" {...register("specialRequests")} />
          {errors.specialRequests?.message ? <FieldError>{t(errors.specialRequests.message)}</FieldError> : null}
        </Field>

        {total !== null ? (
          <div className="border-border rounded-xl border px-4 py-3">
            <p className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("form.total")}</span>
              <span className="text-lg font-semibold">{money(total)}</span>
            </p>
            <FieldDescription>{t("form.totalNote")}</FieldDescription>
          </div>
        ) : null}

        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("form.submitting") : t("form.submit")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck + lint** — must be clean; adjust `@tourism/ui` props against sources if any mismatch (do NOT loosen types).
- [ ] **Step 3: Commit** — `feat(web): BookingForm (departures radio, prefge, display total)`

---

## Task 9: Book page + loading

**Files:**
- Create: `apps/web/src/app/[locale]/(site)/tours/[slug]/book/page.tsx`
- Create: `apps/web/src/app/[locale]/(site)/tours/[slug]/book/loading.tsx`

- [ ] **Step 1: page.tsx**

```tsx
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncUser } from "@/features/auth/actions";
import { getMe } from "@/lib/api/users";
import { getTour, getTourDepartures } from "@/lib/api/tours";
import { toDepartureModel } from "@/features/tour-detail/detail-view-model";
import { BookingForm } from "@/features/booking/booking-form";

export default async function BookTourPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ departure?: string }>;
}) {
  const { locale, slug } = await params;
  const { departure } = await searchParams;
  setRequestLocale(locale);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const returnTo = `/tours/${slug}/book${departure ? `?departure=${departure}` : ""}`;
    redirect({ href: { pathname: "/sign-in", query: { returnTo } }, locale });
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    redirect({ href: { pathname: "/sign-in", query: { returnTo: `/tours/${slug}/book` } }, locale });
  }

  await syncUser();

  const t = await getTranslations("Booking");
  let tour, departures, profile;
  try {
    [tour, departures, profile] = await Promise.all([
      getTour(slug),
      getTourDepartures(slug),
      getMe(session.access_token),
    ]);
  } catch {
    notFound();
  }

  const models = departures.map((d) => toDepartureModel(d, tour, locale));
  const preselectId = departure && models.some((m) => m.id === departure) ? departure : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-semibold">{t("form.title")}</h1>
        <p className="text-muted-foreground mt-1">
          {locale === "vi" ? tour.titleVi : tour.titleEn}
        </p>
      </header>
      {models.length === 0 ? (
        <div className="space-y-4">
          <p className="text-muted-foreground">{t("form.empty")}</p>
          <Link href={`/tours/${slug}`} className="underline">
            {t("form.backToTour")}
          </Link>
        </div>
      ) : (
        <BookingForm
          tourSlug={slug}
          currency={tour.currency}
          departures={models}
          preselectId={preselectId}
          profile={{ fullName: profile.fullName, email: profile.email, phone: profile.phone }}
        />
      )}
    </main>
  );
}
```

NOTE for implementer: confirm `getTour`/`toDepartureModel` signatures in their sources (the view-model takes `(dep, tour, locale)`); confirm `Link` accepts the dynamic href type used by existing tour links (see `tours/[slug]/page.tsx` usage) — if typed routes complain, mirror how B2 links to `/tours/${slug}`. The `(site)` layout wraps children in a `div`, so `<main>` here is safe (same as AccountShell).

- [ ] **Step 2: loading.tsx**

```tsx
import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";

export default function BookTourLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <ShimmerSkeleton className="mb-2 h-9 w-56" />
      <ShimmerSkeleton className="mb-8 h-5 w-72" />
      <div className="max-w-xl space-y-4">
        <ShimmerSkeleton className="h-16 w-full rounded-xl" />
        <ShimmerSkeleton className="h-16 w-full rounded-xl" />
        <ShimmerSkeleton className="h-10 w-full" />
        <ShimmerSkeleton className="h-10 w-full" />
        <ShimmerSkeleton className="h-10 w-40" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint + full tests** — clean.
- [ ] **Step 4: Commit** — `feat(web): /tours/[slug]/book page (guard + prefill + form)`

---

## Task 10: Checkout result pages + `CheckoutStatus`

**Files:**
- Create: `apps/web/src/features/booking/checkout-status.tsx`
- Create: `apps/web/src/app/[locale]/(site)/checkout/success/page.tsx`
- Create: `apps/web/src/app/[locale]/(site)/checkout/cancel/page.tsx`

- [ ] **Step 1: `checkout-status.tsx`** (client; drives the poll loop):

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Alert, AlertDescription, AlertTitle } from "@tourism/ui/components/custom/alert-custom";
import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";
import { getBookingStatus, type BookingStatusResult } from "./actions";
import { nextPollState, POLL_INTERVAL_MS, type PollState } from "./poll";

const STORAGE_KEY = "booking:lastCode";

export function CheckoutStatus() {
  const t = useTranslations("Booking");
  const locale = useLocale();
  const [state, setState] = useState<PollState | { kind: "loading" }>({ kind: "loading" });
  const [booking, setBooking] = useState<Extract<BookingStatusResult, { ok: true }>["booking"] | null>(null);
  const startedAt = useRef<number>(Date.now());
  const retries = useRef(0);

  useEffect(() => {
    const code = window.sessionStorage.getItem(STORAGE_KEY);
    if (!code) {
      setState({ kind: "fallback" });
      return;
    }
    let cancelled = false;

    async function tick() {
      const result = await getBookingStatus(code!);
      if (cancelled) return;
      if (result.ok) setBooking(result.booking);
      const next = nextPollState(
        result.ok ? { ok: true, status: result.status } : { ok: false },
        Date.now() - startedAt.current,
        retries.current,
      );
      if (next.kind === "polling") {
        retries.current = next.retries ?? retries.current;
        setState(next);
        setTimeout(() => void tick(), POLL_INTERVAL_MS);
        return;
      }
      if (next.kind === "paid") window.sessionStorage.removeItem(STORAGE_KEY);
      setState(next);
    }
    void tick();
    return () => {
      cancelled = true;
    };
  }, []);

  const localeTag = locale === "vi" ? "vi-VN" : "en-US";
  const money = (amount: string, currency: string) =>
    new Intl.NumberFormat(localeTag, { style: "currency", currency }).format(Number(amount));

  if (state.kind === "loading" || state.kind === "polling") {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <p className="text-lg font-medium">{t("success.processing")}</p>
        <ShimmerSkeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (state.kind === "paid" && booking) {
    return (
      <div className="space-y-4">
        <h2 className="font-heading text-2xl font-semibold">{t("success.paidTitle")}</h2>
        <p className="text-muted-foreground">{t("success.paidBody")}</p>
        <dl className="border-border grid gap-2 rounded-xl border p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("success.code")}</dt>
            <dd className="font-mono font-semibold">{booking.code}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("success.seats", { adults: booking.numAdults, children: booking.numChildren })}</dt>
            <dd />
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("success.total")}</dt>
            <dd className="font-semibold">{money(booking.totalAmount, booking.currency)}</dd>
          </div>
        </dl>
        <Link href="/" className="underline">{t("success.backHome")}</Link>
      </div>
    );
  }

  const messageKey =
    state.kind === "timeout" ? "success.timeout"
    : state.kind === "expired" ? "success.expired"
    : state.kind === "refunded" ? "success.refunded"
    : "success.missingCode";

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>{t(messageKey)}</AlertTitle>
        <AlertDescription>
          <Link href="/" className="underline">{t("success.backHome")}</Link>
        </AlertDescription>
      </Alert>
    </div>
  );
}
```

- [ ] **Step 2: `checkout/success/page.tsx`**

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckoutStatus } from "@/features/booking/checkout-status";

export default async function CheckoutSuccessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await getTranslations("Booking"); // ensures namespace is loaded for the client tree
  return (
    <main className="mx-auto max-w-2xl px-4 py-14">
      <CheckoutStatus />
    </main>
  );
}
```

- [ ] **Step 3: `checkout/cancel/page.tsx`**

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function CheckoutCancelPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { locale } = await params;
  const { code } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Booking");
  return (
    <main className="mx-auto max-w-2xl px-4 py-14">
      <h1 className="font-heading text-2xl font-semibold">{t("cancel.title")}</h1>
      <p className="text-muted-foreground mt-2">{t("cancel.body")}</p>
      {code ? (
        <p className="mt-4 text-sm">
          {t("cancel.code")}: <span className="font-mono font-semibold">{code}</span>
        </p>
      ) : null}
      <Link href="/tours" className="mt-6 inline-block underline">
        {t("cancel.retry")}
      </Link>
    </main>
  );
}
```

- [ ] **Step 4: Typecheck + lint + full tests + build** (`rm -rf apps/web/.next && pnpm --filter @tourism/web build`) — routes `/[locale]/tours/[slug]/book`, `/[locale]/checkout/success`, `/[locale]/checkout/cancel` appear.
- [ ] **Step 5: Commit** — `feat(web): checkout success (poll) + cancel pages`

---

## Task 11: `BookingSidebar` seam flip

**Files:**
- Modify: `apps/web/src/features/tour-detail/booking-sidebar.tsx`
- Modify: `apps/web/src/features/tour-detail/tour-detail.tsx` (pass `slug`; check how it renders `BookingSidebar` and where `tour.slug` is available)
- Modify: `apps/web/src/features/tour-detail/booking-sidebar.test.tsx`

- [ ] **Step 1: Update the test FIRST** — replace the disabled-CTA test:

```tsx
// replace `it("disables the Book Now CTA (booking is phase D)", …)` with:
  it("renders a Book link per departure pointing at the book page", () => {
    render(<BookingSidebar slug="hoi-an-walking" departures={deps} currency="USD" localeTag="en-US" text={text} />);
    const links = screen.getAllByRole("link", { name: "Book now" });
    expect(links[0]).toHaveAttribute(
      "href",
      expect.stringContaining("/tours/hoi-an-walking/book?departure="),
    );
  });
```

(Existing render-call sites in the test gain the new `slug` prop.)

- [ ] **Step 2: RED** — `pnpm --filter @tourism/web test -- booking-sidebar`
- [ ] **Step 3: Implement** — add `slug: string` to props; replace the disabled button block:

```tsx
// inside the departures list <li>, after the price span:
//   <BookLink id={d.id} disabled={d.soldOut} />
// concretely, replace the bottom disabled <button> with per-row links:
import { Link } from "@/i18n/navigation";
// …
          {departures.map((d) => (
            <li key={d.id} className="border-border flex items-center justify-between rounded-xl border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{day(d.startDate)} → {day(d.endDate)}</p>
                <p className="text-muted-foreground text-xs">{text.seatsLeft(d.seatsLeft)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{money(d.price)}</span>
                {d.soldOut ? null : (
                  <Link
                    href={`/tours/${slug}/book?departure=${d.id}`}
                    className="bg-foreground text-background rounded-md px-3 py-1.5 text-xs font-medium"
                  >
                    {text.bookNow}
                  </Link>
                )}
              </div>
            </li>
          ))}
```

Drop the bottom disabled `<button>` entirely (the per-row links replace it). If the typed `Link` href rejects the template string, mirror whatever pattern existing `/tours/${slug}` links use in B2.

- [ ] **Step 4:** Update `tour-detail.tsx` to pass `slug={tour.slug}` (find the `<BookingSidebar` usage). GREEN + full suite + typecheck/lint.
- [ ] **Step 5: Commit** — `feat(web): enable per-departure Book links in BookingSidebar`

---

## Task 12: Verification + roadmap + merge gate

**Files:**
- Create (untracked): `.tmp/fire-webhook.mjs`
- Modify: `docs/planning/roadmap.md`

- [ ] **Step 1: Webhook harness helper** — `.tmp/fire-webhook.mjs` (modeled on `docs/postman/seed-test-data.mjs` lines ~120–135; reads `apps/api/.env` for `STRIPE_WEBHOOK_SECRET`):

```js
// usage: node .tmp/fire-webhook.mjs <bookingId> <bookingCode>
import { readFileSync } from "node:fs";
import { createHmac, randomBytes } from "node:crypto";

const env = Object.fromEntries(
  readFileSync("apps/api/.env", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const WHSEC = env.STRIPE_WEBHOOK_SECRET;
const [bookingId, bookingCode] = process.argv.slice(2);
const payload = JSON.stringify({
  id: "evt_" + randomBytes(12).toString("hex"),
  type: "checkout.session.completed",
  data: { object: { id: "cs_test_" + randomBytes(10).toString("hex"), object: "checkout.session", metadata: { bookingId, bookingCode }, payment_intent: "pi_" + randomBytes(10).toString("hex") } },
});
const ts = Math.floor(Date.now() / 1000);
const sig = createHmac("sha256", WHSEC).update(`${ts}.${payload}`, "utf8").digest("hex");
const res = await fetch("http://localhost:3000/api/v1/payments/webhook", {
  method: "POST",
  headers: { "Content-Type": "application/json", "stripe-signature": `t=${ts},v1=${sig}` },
  body: payload,
});
console.log("webhook", res.status, await res.text());
```

(`bookingId` is fetched during e2e via SQL/`GET /bookings/:code` as admin, or printed from the DB; the controller deliberately needs both id + code.)

- [ ] **Step 2: Full gates** — web tests (target ≥130), typecheck, lint, build; `pnpm --filter @tourism/api test` untouched-green sanity.
- [ ] **Step 3: Browser e2e (servers up; seed first):**

1. Signed-out `/en/tours/sa-pa-trek-2d1n/book?departure=<id>` → sign-in returnTo round-trip with query intact.
2. Form prefilled (name/email/phone from profile); preselected departure checked; total updates with seat count.
3. Submit → lands on Stripe Checkout (test mode). Card `4242 4242 4242 4242`, any future expiry/CVC → redirected to `/en/checkout/success?session_id=…` → "processing" panel (PENDING).
4. `node .tmp/fire-webhook.mjs <bookingId> <bookingCode>` → poll flips to PAID panel (code/total verified); booking PAID in DB.
5. Cancel path: new booking → on Stripe page click back/cancel → `/checkout/cancel?code=` panel renders with code.
6. Error path: set the chosen departure `status=CLOSED` via admin PATCH → submit again → inline `departureNotOpen` alert.
7. Repeat happy path on `/vi` (labels VI). Console clean throughout.

- [ ] **Step 4: Roadmap** — replace the `Customer FE — D. Booking & Review` row with a parent 🔶 row + a `D1. Booking flow ✅` row in the C-phase style, linking this spec+plan.

```bash
git add docs/planning/roadmap.md
git commit -m "docs: mark D1 booking flow done"
```

- [ ] **Step 5: Final whole-branch review, then STOP** — present results and CONFIRM with Yuri before rebase-and-merge + push + branch deletion.

---

## Self-Review notes (author)

- **Spec coverage:** §2.1 page → Task 9; §2.2 form → Tasks 2/3/8; §2.3 action → Task 6; §3.1 success/poll → Tasks 5/10; §3.2 cancel → Task 10; §4 sidebar → Task 11; §5 i18n → Task 7; §6 testing/e2e → Tasks 1–6 (TDD) + 12; api helpers → Task 1. All covered.
- **Type consistency:** `BookingValues` (T2) flows through T6/T8; `CreateBookingResult`/`BookingStatusResult` (T6) consumed in T8/T10; `PollState`/`nextPollState`/constants (T5) in T10; `DepartureVM` reused from tour-detail in T8/T9; storage key `"booking:lastCode"` identical in T8 and T10; i18n keys in T8/T10 all exist in T7.
- **Placeholder scan:** none — every code step is complete; implementer-discretion notes name the exact fallback (zod v4 API form, typed-Link pattern, schema path key).
