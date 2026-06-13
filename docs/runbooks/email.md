<!-- markdownlint-disable MD013 -->
<!-- MD013 (line length): tables, URLs, and command one-liners cannot wrap
     without breaking GFM rendering or copy-paste. -->

# Runbook — Transactional email (Resend)

Covers the two transactional emails the API sends on its own:

- `bookingConfirmation` — fired by the Stripe webhook after a successful PAID transition (Sprint B3.4 + B3.6).
- `bookingRefunded` — fired by the admin refund endpoint after the Stripe refund + DB updates succeed (Sprint B3.5).

Both templates ship EN + VI inline; the locale is read from `user.locale`. Anything not `vi` falls back to English.

## One-time setup

1. Sign up at [resend.com](https://resend.com) (free tier = 3,000 emails/month, 100/day).
2. Resend Dashboard → API Keys → create one with `Sending` scope. Copy `re_...`.
3. For local dev, leave `RESEND_FROM_EMAIL=onboarding@resend.dev`. Production needs a verified domain — Resend will block sends from unverified senders.
4. `.env`:

   ```text
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
   RESEND_FROM_EMAIL=Tourism API <onboarding@resend.dev>
   ```

5. Restart `pnpm --filter @tourism/api start:dev`.

## Happy path — confirmation email

1. Run the Stripe testing happy path (see [`stripe-testing.md`](stripe-testing.md)). Pay with `4242 4242 4242 4242`.
2. Backend log:

   ```text
   [PaymentsService] Booking BK-XXXXXXXX confirmed PAID (payment_intent=pi_test_xxx)
   [EmailService] Sent booking-confirmation:BK-XXXXXXXX → customer@example.com (resend_id=...)
   ```

3. Resend Dashboard → Emails → the message shows `delivered` within seconds.

If the customer used a non-existent recipient, Resend logs `bounced` and the backend warn log shows `Resend rejected booking-confirmation:... → ...`. The booking stays PAID — email failure never rolls back state.

## Admin refund flow

1. Identify a PAID booking. Get its `id` (UUID) from `GET /bookings/:code` or Supabase Studio.
2. Postman → `Admin / Bookings → POST /admin/bookings/:id/refund` with body:

   ```json
   { "reason": "Tour cancelled due to weather" }
   ```

3. Expect 200 with `status: "REFUNDED"`.
4. Backend log:

   ```text
   [StripeService] Issued refund re_xxx for payment_intent pi_test_xxx (status=succeeded)
   [BookingsService] Admin refunded booking BK-XXXXXXXX (payment_intent=pi_test_xxx, seats=3 released)
   [EmailService] Sent booking-refunded:BK-XXXXXXXX → customer@example.com (resend_id=...)
   ```

5. Verify in Supabase: `bookings.status='REFUNDED'`, `cancelled_at` set, `tour_departures.seats_booked` decreased by `numAdults + numChildren`.
6. Stripe Dashboard → Payments → Refunds shows the refund row.

## Error responses

| HTTP | `error.code` | Meaning | What to do |
| --- | --- | --- | --- |
| 404 | `BOOKING_NOT_FOUND` | `:id` doesn't match a booking | Check the UUID |
| 400 | `BOOKING_NOT_REFUNDABLE` | Booking is not PAID, or missing `stripePaymentIntentId` | Don't refund PENDING/CANCELLED/REFUNDED rows |
| 400 | `REFUND_FAILED` | Stripe rejected (e.g. dispute window closed) | Refund manually in Stripe Dashboard, then mark booking REFUNDED via SQL |
| 403 | (RolesGuard) | Caller is not ADMIN | Sign in with `/auth/admin/sync` |

## Idempotency

`refundByAdmin` is **not** idempotent — calling it twice on the same booking will try to refund a payment_intent that's already fully refunded, and Stripe returns `charge_already_refunded`. We re-throw as `REFUND_FAILED`. The DB never gets into a double-decremented state because the second call hits `BOOKING_NOT_REFUNDABLE` (status is REFUNDED, not PAID).

For partial refunds or split-refund scenarios → out of scope for the thesis; do them in Stripe Dashboard and sync the DB manually.

## Production checklist

- [ ] Add and verify the production sending domain in Resend Dashboard → Domains.
- [ ] Swap `RESEND_FROM_EMAIL` to `Tourism Booking <noreply@yourdomain.com>` (or similar verified address).
- [ ] Rotate `RESEND_API_KEY` to a production-scope key; revoke the dev one.
- [ ] Resend Dashboard → Webhooks → optionally configure `email.bounced` + `email.complained` notifications to flag deliverability issues.
- [ ] Smoke test with a real customer email before opening checkout.

## Why the email send doesn't block the response

Both code paths (`PaymentsService.onCheckoutCompleted` and `BookingsService.refundByAdmin`) `await` the email but never let it throw. Rationale:

- For **webhook**: a 5xx from us makes Stripe retry the event, but our event-level idempotency means the retry runs but does nothing — and the retry would also fail email. Instead we return 200 to Stripe; the booking is already PAID and the operator can resend the email from the Resend Dashboard.
- For **refund**: the refund has *already* hit Stripe by the time we email. Rolling back the DB to "not refunded" because the email failed would be worse than the alternative.

Both failures show up in the warn log; pair that with Resend's `bounced`/`complained` webhooks for production monitoring.
