# Runbook — Stripe testing (Checkout + webhook)

> 🇬🇧 English version: [`../../en/runbooks/stripe-testing.md`](../../en/runbooks/stripe-testing.md).

Cách test full booking → payment → confirmation loop local với Stripe test mode + Stripe CLI.

## Vì sao cần CLI tunnel

Stripe gửi webhook event từ server của họ. Localhost không reach được, và backend reject body không ký (`STRIPE_WEBHOOK_INVALID`). Stripe CLI giải quyết cả 2: forward event thật từ test account về dev backend VÀ ký với secret per-session để signature verify pass.

## Setup 1 lần

1. **Cài Stripe CLI** (xong rồi nếu `stripe --version` chạy được):
   ```bash
   winget install --id Stripe.StripeCLI
   ```
2. **Login** — mở browser OAuth:
   ```bash
   stripe login
   ```
   Pair CLI với test account Stripe. Không cần API key; CLI dùng "CLI key" restricted theo máy.
3. **Confirm `STRIPE_SECRET_KEY=sk_test_...`** trong `.env`. CLI không đọc cái này — **backend** dùng để mint Checkout session.

## Start tunnel

Trong 1 terminal, để chạy:

```bash
stripe listen --forward-to http://localhost:3000/api/v1/payments/webhook
```

Lần đầu output:

```text
> Ready! You are using Stripe API Version [2025-XX-XX]. Your webhook signing
> secret is whsec_abc123def456... (^C to quit)
```

**Copy giá trị `whsec_...` vào `STRIPE_WEBHOOK_SECRET` trong `.env`** rồi restart `pnpm start:dev`. Secret này unique theo session CLI — rotate mỗi lần chạy lại `stripe listen`. Production sẽ dùng secret từ dashboard.

## Happy path — pay 1 booking

Terminal 2:

```bash
pnpm start:dev
```

Postman:
1. `Auth → POST /auth/sync` (customer)
2. `Bookings → POST /bookings` — copy `checkoutUrl` từ response
3. Mở URL trong browser
4. Nhập test card:
   - **Number** `4242 4242 4242 4242`
   - **Expiry** date tương lai (`12/30`)
   - **CVC** 3 digits bất kỳ (`123`)
   - **Postal code / name** gì cũng được
5. Submit — browser redirect về `localhost:3001/checkout/success?...` (404 vì FE chưa build — bình thường).

Theo dõi terminal `stripe listen`:

```text
2026-05-12 16:30:01  --> checkout.session.completed [evt_xxx]
2026-05-12 16:30:01  <--  [200] POST http://localhost:3000/api/v1/payments/webhook [evt_xxx]
```

Theo dõi backend log:

```text
[PaymentsService] Booking BK-XXXXXXXX confirmed PAID (payment_intent=pi_test_xxx)
```

Verify trong Postman: `Bookings → GET /bookings/:code` → `status: "PAID"`, `paidAt` có giá trị.

Check Supabase: row `tour_departures` có `seats_booked` tăng bằng số seat của booking.

## Idempotency — replay 1 event đã deliver

```bash
stripe events resend evt_xxx
```

Backend log:

```text
[PaymentsService] Skipping duplicate Stripe event evt_xxx (checkout.session.completed)
```

Booking vẫn PAID, seats không đổi. Chứng minh `payment_events.stripe_event_id` UNIQUE là layer idempotency thứ 2.

## Signature gate — verify reject path

Postman: `Payments → POST /payments/webhook (unsigned)` → expect 400 `STRIPE_WEBHOOK_INVALID`. Nếu thấy 200 → signature verification bị bypass đâu đó và backend sẽ accept event giả. Fix trước khi tiếp tục.

## Test card khác (Stripe test mode)

| Card | Outcome |
| --- | --- |
| `4242 4242 4242 4242` | Approved, không 3DS |
| `4000 0027 6000 3184` | Approved sau 3DS challenge |
| `4000 0000 0000 0002` | Declined (`card_declined`) |
| `4000 0000 0000 9995` | Decline do thiếu tiền |

Full catalog: [docs.stripe.com/testing](https://docs.stripe.com/testing#cards).

## Expired checkout (không pay trong 30 phút)

Stripe tự gửi `checkout.session.expired` sau 30 phút nếu không có payment. Simulate không cần đợi:

```bash
stripe trigger checkout.session.expired
```

Event synthetic này không có `bookingId` thật trong metadata nên backend bỏ qua. Test flow thật:
1. Tạo booking qua `POST /bookings`.
2. Không pay.
3. Đợi 30 phút (hoặc giảm session expiry trong `StripeService.createCheckoutSession` xuống vd 60s để test).
4. Theo dõi backend mark booking `CANCELLED`.

## Overbook race — simulate thủ công

Webhook handler refund + CANCEL khi seat allocation không còn fit lúc confirm. Exercise path:

1. Tạo tour với `seatsTotal=2`, chưa có booking.
2. Mở 2 browser window, start 2 booking mỗi cái 2 seats.
3. Pay cả 2 nhanh. Cái webhook đến sau thấy `seatsBooked=2` rồi → refund.

Kết quả: booking đầu PAID + `seats_booked=2`. Booking sau REFUNDED, refund hiện ở Stripe Dashboard → Payments → Refunds.

## Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách fix |
| --- | --- | --- |
| `400 STRIPE_WEBHOOK_INVALID: Signature verification failed` | `STRIPE_WEBHOOK_SECRET` không khớp với `stripe listen` print | Copy secret từ banner CLI, restart `pnpm start:dev` |
| Backend 500 trên webhook | Xem backend log — thường là Prisma error (DB không reach, FK violation từ seed corrupt) | Fix root cause; Stripe tự retry event |
| `stripe listen` báo `connection refused` | Backend không chạy HOẶC sai port | `pnpm start:dev`, confirm port 3000 |
| Booking stuck PENDING sau success | Webhook không đến (CLI tunnel chết? URL forward sai?) | Check `stripe listen` còn chạy + URL khớp prefix deploy |
| Stripe Dashboard show event 200 OK nhưng booking vẫn PENDING | Webhook trả 200 nhưng `metadata.bookingId` thiếu hoặc DB write silently fail. Check backend log warning. | Inspect `payment_events.payload` JSON theo event id; fix metadata wiring nếu thiếu |

## Production checklist

Trước khi deploy Railway:

- [ ] Stripe Dashboard → Developers → Webhooks → add endpoint thật trỏ về `https://<railway-url>/api/v1/payments/webhook`.
- [ ] Subscribe `checkout.session.completed` và `checkout.session.expired` — không cần thêm.
- [ ] Copy signing secret **production** (khác với `stripe listen` test secret) vào Railway env `STRIPE_WEBHOOK_SECRET`.
- [ ] Đổi `STRIPE_SECRET_KEY` sang live key `sk_live_...`.
- [ ] Smoke test với card thật $1 trước khi open cho user.
