# Runbook — Stripe testing (Checkout + webhook)


How to exercise the full booking → payment → confirmation loop locally with Stripe test mode + the Stripe CLI.

## Why a CLI tunnel

Stripe sends webhook events from its own servers. Localhost isn't reachable from there, and our backend rejects unsigned bodies (`STRIPE_WEBHOOK_INVALID`). The Stripe CLI solves both: it forwards real events from your test-mode account to your dev backend AND signs them with a per-session secret so the signature verification passes.

## One-time setup

1. **Install Stripe CLI** (already done if `stripe --version` works):

   ```bash
   winget install --id Stripe.StripeCLI
   ```

2. **Log in** — opens a browser for OAuth:

   ```bash
   stripe login
   ```

   This pairs the CLI with your Stripe test account. No API keys needed; the CLI uses a restricted "CLI key" scoped to that machine.
3. **Confirm `STRIPE_SECRET_KEY=sk_test_...`** is set in `.env`. The CLI doesn't read this — the **backend** uses it to mint Checkout sessions.

## Start the tunnel

In one terminal, leave this running:

```bash
stripe listen --forward-to http://localhost:3000/api/v1/payments/webhook
```

First-time output looks like:

```text
> Ready! You are using Stripe API Version [2025-XX-XX]. Your webhook signing
> secret is whsec_abc123def456... (^C to quit)
```

**Copy the `whsec_...` value into `STRIPE_WEBHOOK_SECRET` in `.env`** and restart `pnpm --filter @tourism/api start:dev`. This secret is unique per CLI session — rotate it the same way every time you re-run `stripe listen`. In production you'll use the dashboard-issued secret instead.

## Happy path — pay a booking

In a second terminal:

```bash
pnpm --filter @tourism/api start:dev
```

In Postman:

1. `Auth → POST /auth/sync` (customer)
2. `Bookings → POST /bookings` — copy `checkoutUrl` from the response
3. Open the URL in a browser
4. Enter test card:
   - **Number** `4242 4242 4242 4242`
   - **Expiry** any future date (`12/30`)
   - **CVC** any 3 digits (`123`)
   - **Postal code / name** anything
5. Submit — the browser redirects to `localhost:3001/checkout/success?...` (404 because the FE isn't built yet — expected).

Watch the `stripe listen` terminal: it logs forwarded events like:

```text
2026-05-12 16:30:01  --> checkout.session.completed [evt_xxx]
2026-05-12 16:30:01  <--  [200] POST http://localhost:3000/api/v1/payments/webhook [evt_xxx]
```

Watch the backend log:

```text
[PaymentsService] Booking BK-XXXXXXXX confirmed PAID (payment_intent=pi_test_xxx)
```

Verify in Postman: `Bookings → GET /bookings/:code` → `status: "PAID"`, `paidAt` populated.

Check Supabase: `tour_departures` row should have `seats_booked` incremented by the booking's seat count.

## Idempotency — replay a delivered event

```bash
stripe events resend evt_xxx
```

Backend logs:

```text
[PaymentsService] Skipping duplicate Stripe event evt_xxx (checkout.session.completed)
```

Booking stays PAID, seats unchanged. Proves the `payment_events.stripe_event_id` UNIQUE constraint is the second idempotency layer.

## Signature gate — verify the reject path

In Postman: `Payments → POST /payments/webhook (unsigned)` → expect 400 `STRIPE_WEBHOOK_INVALID`. If you see 200, signature verification is bypassed somewhere and the backend would accept forged events. Fix before continuing.

## Other test cards (Stripe test mode)

| Card | Outcome |
| --- | --- |
| `4242 4242 4242 4242` | Approved, no 3DS |
| `4000 0027 6000 3184` | Approved after 3DS challenge |
| `4000 0000 0000 0002` | Declined (`card_declined`) |
| `4000 0000 0000 9995` | Decline due to insufficient funds |

Full catalog: [docs.stripe.com/testing](https://docs.stripe.com/testing#cards).

## Expired checkout (no payment within 30 min)

Stripe sends `checkout.session.expired` automatically 30 min after the session is created if no payment occurs. To simulate without waiting:

```bash
stripe trigger checkout.session.expired
```

This sends a synthetic event — note it won't carry a real `bookingId` in metadata, so the backend ignores it. To test the real flow:

1. Create a booking via `POST /bookings`.
2. Don't pay.
3. Wait 30 min (or shorten the session expiry in `StripeService.createCheckoutSession` to e.g. 60s for testing).
4. Watch the backend mark the booking `CANCELLED`.

## Overbook race — manual simulation

The webhook handler refunds and CANCELS when a booking's seat allocation no longer fits at confirmation time. To exercise the path:

1. Create a tour with `seatsTotal=2`, no existing bookings.
2. In two browser windows, start two bookings of 2 seats each.
3. Pay both quickly. Whichever webhook arrives second sees `seatsBooked=2` already and refunds.

Result: first booking PAID + `seats_booked=2`. Second booking REFUNDED, refund visible in Stripe Dashboard → Payments → Refunds.

## Failure modes

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `400 STRIPE_WEBHOOK_INVALID: Signature verification failed` | `STRIPE_WEBHOOK_SECRET` doesn't match what `stripe listen` printed | Copy the secret from the CLI banner, restart `pnpm --filter @tourism/api start:dev` |
| Backend 500 on webhook | Look at the backend log — usually a Prisma error (DB unreachable, FK violation from an earlier corrupted seed) | Fix root cause; Stripe will retry the event automatically |
| `stripe listen` shows `connection refused` | Backend isn't running OR wrong port | `pnpm --filter @tourism/api start:dev`, confirm port 3000 |
| Booking stuck PENDING after success | Webhook never arrived (CLI tunnel down? Forwarded URL wrong?) | Check `stripe listen` is still running and the URL matches the deployed prefix |
| Stripe Dashboard shows the event as 200 OK but booking still PENDING | The webhook returned 200 but `metadata.bookingId` was missing or DB write failed silently. Check the backend log for the warning. | Inspect `payment_events.payload` JSON for the event id; fix metadata wiring if absent |

## Production checklist

Before deploying to Railway:

- [ ] Stripe Dashboard → Developers → Webhooks → add a real endpoint pointing at `https://<railway-url>/api/v1/payments/webhook`.
- [ ] Subscribe to `checkout.session.completed` and `checkout.session.expired` only — anything else is noise.
- [ ] Copy the **production** signing secret (different from `stripe listen` test secret) into Railway env `STRIPE_WEBHOOK_SECRET`.
- [ ] Switch `STRIPE_SECRET_KEY` to a live `sk_live_...` key.
- [ ] Smoke-test with a $1 real card before opening to users.
