# Runbook — Email giao dịch (Resend)

> 🇬🇧 English version: [`../../en/runbooks/email.md`](../../en/runbooks/email.md).

Cover 2 email tự động backend gửi:

- `bookingConfirmation` — webhook Stripe gửi sau khi booking PAID (Sprint B3.4 + B3.6).
- `bookingRefunded` — admin refund endpoint gửi sau khi refund Stripe + DB update xong (Sprint B3.5).

Template ship EN + VI inline; locale đọc từ `user.locale`. Bất kỳ giá trị nào không phải `vi` → fallback English.

## Setup 1 lần

1. Đăng ký [resend.com](https://resend.com) (free tier = 3,000 email/tháng, 100/ngày).
2. Resend Dashboard → API Keys → tạo key scope `Sending`. Copy `re_...`.
3. Local dev: dùng `RESEND_FROM_EMAIL=onboarding@resend.dev`. Production cần verify domain — Resend block send từ sender chưa verify.
4. `.env`:

   ```text
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
   RESEND_FROM_EMAIL=Tourism API <onboarding@resend.dev>
   ```

5. Restart `pnpm start:dev`.

## Happy path — email confirmation

1. Chạy happy path Stripe testing ([`stripe-testing.md`](stripe-testing.md)). Pay với `4242 4242 4242 4242`.
2. Log backend:

   ```text
   [PaymentsService] Booking BK-XXXXXXXX confirmed PAID (payment_intent=pi_test_xxx)
   [EmailService] Sent booking-confirmation:BK-XXXXXXXX → customer@example.com (resend_id=...)
   ```

3. Resend Dashboard → Emails → message show `delivered` trong vài giây.

Nếu recipient không tồn tại → Resend log `bounced` và backend warn `Resend rejected booking-confirmation:... → ...`. Booking vẫn PAID — email fail không rollback state.

## Flow admin refund

1. Lấy booking đã PAID. Copy `id` (UUID) từ `GET /bookings/:code` hoặc Supabase Studio.
2. Postman → `Admin / Bookings → POST /admin/bookings/:id/refund` body:

   ```json
   { "reason": "Tour bị hủy do thời tiết" }
   ```

3. Expect 200 với `status: "REFUNDED"`.
4. Log backend:

   ```text
   [StripeService] Issued refund re_xxx for payment_intent pi_test_xxx (status=succeeded)
   [BookingsService] Admin refunded booking BK-XXXXXXXX (payment_intent=pi_test_xxx, seats=3 released)
   [EmailService] Sent booking-refunded:BK-XXXXXXXX → customer@example.com (resend_id=...)
   ```

5. Verify Supabase: `bookings.status='REFUNDED'`, `cancelled_at` có giá trị, `tour_departures.seats_booked` giảm đúng `numAdults + numChildren`.
6. Stripe Dashboard → Payments → Refunds thấy refund row.

## Mã lỗi

| HTTP | `error.code` | Ý nghĩa | Cách xử lý |
| --- | --- | --- | --- |
| 404 | `BOOKING_NOT_FOUND` | `:id` không match booking nào | Check UUID |
| 400 | `BOOKING_NOT_REFUNDABLE` | Booking không phải PAID, hoặc thiếu `stripePaymentIntentId` | Không refund PENDING/CANCELLED/REFUNDED |
| 400 | `REFUND_FAILED` | Stripe reject (vd: dispute window đóng) | Refund manual ở Stripe Dashboard, sau đó update booking REFUNDED bằng SQL |
| 403 | (RolesGuard) | Caller không phải ADMIN | Sign in qua `/auth/admin/sync` |

## Idempotency

`refundByAdmin` **không** idempotent — gọi 2 lần cùng booking sẽ try refund payment_intent đã refund full, Stripe trả `charge_already_refunded`. Backend re-throw `REFUND_FAILED`. DB không bị double-decrement vì call thứ 2 hit `BOOKING_NOT_REFUNDABLE` (status đã là REFUNDED, không phải PAID).

Partial refund / split refund → out of scope đồ án; làm thủ công ở Stripe Dashboard rồi sync DB bằng SQL.

## Checklist production

- [ ] Add + verify production sending domain ở Resend Dashboard → Domains.
- [ ] Đổi `RESEND_FROM_EMAIL` thành `Tourism Booking <noreply@yourdomain.com>` (hoặc verified address khác).
- [ ] Rotate `RESEND_API_KEY` sang production-scope; revoke key dev.
- [ ] Resend Dashboard → Webhooks → optional config `email.bounced` + `email.complained` để monitor deliverability.
- [ ] Smoke test với email khách thật trước khi mở checkout.

## Vì sao email send không block response

Cả 2 path (`PaymentsService.onCheckoutCompleted` và `BookingsService.refundByAdmin`) `await` email nhưng không bao giờ để throw. Lý do:

- **Webhook**: 5xx từ backend → Stripe retry event, nhưng idempotency layer event-level nghĩa là retry chạy nhưng không làm gì — và retry cũng sẽ fail email. Vì vậy trả 200; booking đã PAID, operator có thể resend email từ Resend Dashboard.
- **Refund**: refund đã hit Stripe rồi tại thời điểm email. Rollback DB về "không refund" vì email fail là tệ hơn alternative.

Cả 2 failure log warn; pair với Resend `bounced`/`complained` webhook cho production monitoring.
