# Tổng quan API

> 🇬🇧 English version: [`../en/api-overview.md`](../en/api-overview.md).

Base URL: `${API_PREFIX}` (mặc định `/api/v1`). Swagger UI: `/api/docs` (chỉ ở dev).

## Định dạng response

Tất cả response đều dùng:

```jsonc
{
  "data": <payload> | null,
  "error": null | { "code": "STRING", "message": "...", "details": ... },
  "meta": { /* phân trang, tùy chọn */ }
}
```

## Error codes

| Code | HTTP | Ý nghĩa |
| --- | --- | --- |
| `BAD_REQUEST` | 400 | Validate fail (class-validator) |
| `UNAUTHORIZED` | 401 | Thiếu / sai / hết hạn JWT, hoặc user chưa sync |
| `FORBIDDEN` | 403 | Đã auth nhưng role không đủ |
| `NOT_ADMIN` | 403 | Email không nằm trong `ADMIN_EMAILS` allowlist (chỉ admin sync) |
| `USER_NOT_SYNCED` | 401 | JWT hợp lệ nhưng chưa có record DB — gọi `POST /auth/sync` |
| `USER_NOT_FOUND` | 404 | Record user bị xóa giữa lúc guard chạy và handler chạy |
| `NOT_FOUND` | 404 | Resource không tồn tại |
| `DESTINATION_NOT_FOUND` | 404 | Destination slug không tồn tại hoặc đang inactive |
| `TOUR_NOT_FOUND` | 404 | Tour slug không tồn tại |
| `INVALID_DESTINATION` | 400 | Tour create/update tham chiếu `destinationId` không tồn tại |
| `CONFLICT` | 409 | Vi phạm unique constraint |
| `DESTINATION_SLUG_EXISTS` | 409 | Slug destination đã được dùng |
| `DESTINATION_HAS_TOURS` | 409 | Không thể xoá destination khi vẫn còn tour tham chiếu |
| `TOUR_SLUG_EXISTS` | 409 | Slug tour đã được dùng |
| `TOUR_HAS_BOOKINGS` | 409 | Không thể xoá tour khi vẫn còn booking tham chiếu |
| `TOO_MANY_REQUESTS` | 429 | Throttler chặn |
| `INTERNAL_SERVER_ERROR` | 500 | Lỗi không xử lý |

## Bảng endpoint

Chú thích: 🌍 public · 🔒 customer (user đã auth) · 🛡 admin only.

### Sprint B0 — Health

| Method | Path | Access | Mô tả |
| --- | --- | --- | --- |
| GET | `/health` | 🌍 | Liveness — không truy cập DB |
| GET | `/health/ready` | 🌍 | Readiness — `data.checks.database` là `up` / `down` |

### Sprint B1 — Auth & Users

| Method | Path | Access | Mô tả |
| --- | --- | --- | --- |
| POST | `/auth/sync` | 🔒 | Upsert user (đã có JWT) thành `CUSTOMER`. Idempotent. Mọi field trong body đều optional. |
| POST | `/auth/admin/sync` | 🛡 | Upsert tương tự nhưng nâng quyền lên `ADMIN`. Email caller phải nằm trong `ADMIN_EMAILS` allowlist; không thì 403. |
| GET | `/users/me` | 🔒 | Trả về profile của user hiện tại. |
| PATCH | `/users/me` | 🔒 | Cập nhật `fullName`, `phone`, `locale`. Email + role không sửa được ở đây. |

### Cách FE sử dụng auth endpoints

1. User đăng nhập/đăng ký qua Supabase ở frontend → nhận `access_token`.
2. Frontend gọi **một lần** `POST /auth/sync` (FE customer) hoặc `POST /auth/admin/sync` (FE admin) để đồng bộ user vào DB cục bộ.
3. Tất cả request bảo mật sau đó gắn header `Authorization: Bearer <access_token>`.
4. Nếu `GET /users/me` trả `USER_NOT_SYNCED`, FE phải gọi lại bước 2.

### Sprint B2.1 — Destinations

| Method | Path | Access | Mô tả |
| --- | --- | --- | --- |
| GET | `/destinations` | 🌍 | Danh sách destinations active (có phân trang). Hỗ trợ `page`, `pageSize` (max 100), `search` (tên en+vi, không phân biệt hoa thường), `sortBy`, `sortOrder`. |
| GET | `/destinations/:slug` | 🌍 | Chi tiết 1 destination active theo slug. 404 khi thiếu hoặc inactive. |
| GET | `/admin/destinations` | 🛡 | Admin list — thấy cả draft inactive; `isActive` filter có hiệu lực. |
| GET | `/admin/destinations/:slug` | 🛡 | Admin chi tiết — không filter `isActive`. |
| POST | `/admin/destinations` | 🛡 | Tạo destination. 409 `DESTINATION_SLUG_EXISTS` khi slug trùng. |
| PATCH | `/admin/destinations/:slug` | 🛡 | Update từng phần. Đổi slug được nhưng có thể làm hỏng bookmark cũ. |
| DELETE | `/admin/destinations/:slug` | 🛡 | Xoá cứng. 409 `DESTINATION_HAS_TOURS` khi vẫn còn tour tham chiếu. |

Quy tắc slug: `^[a-z0-9]+(?:-[a-z0-9]+)*$` (kebab-case, 2–80 ký tự).

### Sprint B2.2 — Tours (Admin CRUD)

| Method | Path | Access | Mô tả |
| --- | --- | --- | --- |
| GET | `/admin/tours/:slug` | 🛡 | Chi tiết kèm `destination` đã join. 404 khi slug không tồn tại. |
| POST | `/admin/tours` | 🛡 | Tạo tour. 400 `INVALID_DESTINATION` khi `destinationId` không tồn tại; 409 `TOUR_SLUG_EXISTS` khi slug trùng. |
| PATCH | `/admin/tours/:slug` | 🛡 | Update từng phần. Gửi `destinationId` sẽ re-validate FK. |
| DELETE | `/admin/tours/:slug` | 🛡 | Xoá cứng. 409 `TOUR_HAS_BOOKINGS` khi còn booking tham chiếu. |

Tour slug rule: cùng kebab-case như destinations nhưng max 120 ký tự.

### Sprint B2.3 — Tours (Public catalog)

| Method | Path | Access | Mô tả |
| --- | --- | --- | --- |
| GET | `/tours` | 🌐 | List có phân trang các tour `isPublished = true`. Filter + sort bên dưới. |
| GET | `/tours/:slug` | 🌐 | Tour published kèm destination đã join. 404 gộp 2 trường hợp "không tồn tại" và "unpublished" để slug draft không bị dò ra. |

Filters (optional, AND-combined):

- `destination` — slug destination (kebab-case). Slug không resolve được → trả mảng rỗng (không phải 404).
- `category` — `DAY` | `PACKAGE` | `CUSTOM`
- `minPrice` / `maxPrice` — inclusive bounds trên `basePrice`
- `duration` — số ngày chính xác
- `featured` — boolean, dùng cho home-page hero
- `q` — search substring không phân biệt hoa thường trên `titleEn`, `titleVi`, `summaryEn`, `summaryVi`

Sort whitelist: `createdAt` (default) | `basePrice` | `durationDays` | `titleEn`. `sortOrder`: `asc` | `desc`.

Phân trang: `page` (mặc định 1), `pageSize` (mặc định 20, max 100). Response có `meta: { page, pageSize, total, totalPages }`.

Drafts không leak: cả 2 endpoint đều pin `isPublished: true` ở server-side bất kể caller là ai.

### Sprint B2.4 — Tours itinerary (Admin nested CRUD)

| Method | Path | Access | Mô tả |
| --- | --- | --- | --- |
| GET | `/admin/tours/:slug/itinerary` | 🛡 | List tất cả day, sắp xếp tăng dần theo `dayNumber`. |
| POST | `/admin/tours/:slug/itinerary` | 🛡 | Tạo 1 day. 409 `ITINERARY_DAY_EXISTS` khi `(tourId, dayNumber)` trùng. |
| PATCH | `/admin/tours/:slug/itinerary/:dayNumber` | 🛡 | Update từng phần; gửi `dayNumber` sẽ renumber (cùng rule unique). |
| DELETE | `/admin/tours/:slug/itinerary/:dayNumber` | 🛡 | Xoá 1 day. Trả 200 + echo. |

Day được address bằng `(tourSlug, dayNumber)` thay vì UUID — URL đọc tự nhiên hơn và `(tourId, dayNumber)` đã unique ở DB.

Error codes cho itinerary:

- `TOUR_NOT_FOUND` (404) — slug parent không tồn tại
- `ITINERARY_DAY_NOT_FOUND` (404) — day không tồn tại trong tour
- `ITINERARY_DAY_EXISTS` (409) — `dayNumber` trùng khi create HOẶC renumber

`GET /tours/:slug` (public) giờ include luôn `itinerary` sort ascending để FE render Day 1 → N không cần sort client-side.

### Sprint B2.5 — Tour Departures (Admin CRUD + Public list)

| Method | Path | Access | Mô tả |
| --- | --- | --- | --- |
| GET | `/tours/:slug/departures` | 🌐 | Public list. Default: `from = today`, `status = OPEN`. 404 gộp missing/unpublished. |
| GET | `/admin/tours/:slug/departures` | 🛡 | Admin list — full history CLOSED/CANCELLED. Không default ngầm. |
| POST | `/admin/tours/:slug/departures` | 🛡 | Tạo 1 departure. |
| PATCH | `/admin/tours/:slug/departures/:id` | 🛡 | Update từng phần. Capacity guard: `seatsTotal >= seatsBooked`. |
| DELETE | `/admin/tours/:slug/departures/:id` | 🛡 | Xoá cứng. Pre-check `seatsBooked === 0`. |

Query params cho cả 2 list: `from` (ISO 8601 date, inclusive), `to` (inclusive upper bound), `status` (`OPEN | CLOSED | CANCELLED`).

`seatsBooked` **không bao giờ** accept từ client — chỉ được mutate qua booking flow (Sprint B3) trong transaction + row lock.

Error codes:

- `TOUR_NOT_FOUND` (404) — slug parent không tồn tại HOẶC (public) chưa publish
- `DEPARTURE_NOT_FOUND` (404) — id departure không thuộc tour
- `INVALID_DATE_RANGE` (400) — `endDate < startDate` (re-validate khi patch chỉ 1 trong 2 dates)
- `SEATS_TOTAL_BELOW_BOOKED` (400) — update làm `seatsTotal` < `seatsBooked` hiện tại
- `DEPARTURE_HAS_BOOKINGS` (409) — không xoá được vì còn seat đã sold (kèm fallback P2003 cho race)

### Sprint B2.6 — Uploads (Signed URL admin)

| Method | Path | Access | Mô tả |
| --- | --- | --- | --- |
| POST | `/admin/uploads/signed-url` | 🛡 | Mint Supabase Storage signed upload URL. FE PUT trực tiếp lên Supabase — Nest không chạm bytes. |

Body: `{ purpose, filename, contentType? }`. Enum `purpose` map sang folder trong bucket:

| Purpose | Folder |
| --- | --- |
| `TOUR_HERO` | `tours/hero/` |
| `TOUR_GALLERY` | `tours/gallery/` |
| `DESTINATION_HERO` | `destinations/hero/` |
| `USER_AVATAR` | `users/avatars/` |

Response: `{ uploadUrl, token, path, bucket }`. Path theo dạng `<folder>/<unix-ms>-<sanitized-stem>.<ext>` để đảm bảo unique.

Errors:

- `400 VALIDATION_ERROR` — DTO reject (bad purpose / filename / contentType)
- `502 STORAGE_SIGN_FAILED` — Supabase Storage reject (bucket thiếu, project pause, service role key sai)

Flow chi tiết + setup bucket: [`docs/runbooks/vi/uploads.md`](../../runbooks/vi/uploads.md).

### Sprint B2.7 — Seed script

Không phải HTTP surface — `pnpm db:seed` populate catalog thực tế: 4 destination, 10 tour (9 published + 1 draft), 2 itinerary day, 30 departure spread tại +30 / +75 / +150 ngày tính từ "hôm nay".

Reference đầy đủ: [`docs/runbooks/vi/seed.md`](../../runbooks/vi/seed.md).

### Sprint B3.1–B3.3 — Bookings (customer-facing)

| Method | Path | Access | Mô tả |
| --- | --- | --- | --- |
| POST | `/bookings` | 🔐 | Tạo booking PENDING + mint Stripe Checkout session. Trả `{ bookingId, bookingCode, checkoutUrl, status }`. |
| GET | `/bookings/me` | 🔐 | List booking của caller, mới nhất trước (top 50). |
| GET | `/bookings/:code` | 🔐 | Chi tiết theo code. Owner-or-admin; non-owner thấy 404 giống code missing thật. |

🔐 = cần JWT; 401 `USER_NOT_SYNCED` nếu chưa chạy `/auth/sync`.

Body cho `POST /bookings`:

- `tourSlug` (kebab-case, phải published)
- `departureId` (UUID, phải thuộc tour AND OPEN)
- `numAdults` (1–20), optional `numChildren` (0–20, default 0)
- `contactName`, `contactEmail`, optional `contactPhone`, optional `specialRequests`

`userId`, `currency`, `totalAmount`, `code`, `status` đều server-controlled. `seatsBooked` **chỉ webhook** (Sprint B3.4) mutate dưới row lock — không bao giờ mutate ở create.

Error codes:

- `TOUR_NOT_FOUND` (404) — slug missing hoặc unpublished
- `DEPARTURE_NOT_FOUND` (404) — departure missing hoặc không thuộc tour
- `DEPARTURE_NOT_OPEN` (400) — departure CLOSED/CANCELLED
- `SEATS_NOT_AVAILABLE` (409) — best-effort capacity check (reservation thật ở webhook)
- `STRIPE_SESSION_INVALID` (400) — Stripe trả session không có URL
- `BOOKING_NOT_FOUND` (404) — cũng trả cho non-owner (chống enumeration)
- `USER_NOT_SYNCED` (401) — chưa chạy `/auth/sync`

**Note:** Chưa có B3.4 webhook, sau khi pay Stripe thành công booking vẫn PENDING — FE success page sẽ show "processing". B3.4 close loop.

### Sprint B3.4 — Stripe webhook

| Method | Path | Access | Mô tả |
| --- | --- | --- | --- |
| POST | `/payments/webhook` | 🌐 (signature-gated) | Stripe webhook receiver. Verify signature, idempotent theo `event.id`, mutate booking status dưới row lock. |

Idempotency 2 lớp:

1. **Event-level** — mỗi `event.id` insert vào `payment_events` (UNIQUE). Duplicate insert trả 200 ngay, không re-run side effect → Stripe retry an toàn.
2. **Booking-level** — `checkout.session.completed` chạy trong Prisma transaction với `SELECT seats_total, seats_booked FROM tour_departures WHERE id = $1 FOR UPDATE`. Booking đã PAID/REFUNDED → no-op; seat không còn fit (race với payment khác) → tự refund + CANCEL.

Event handle:

- `checkout.session.completed` → booking PAID, `seatsBooked += N`, set `paid_at`, persist `stripe_payment_intent_id`.
- `checkout.session.expired` → booking CANCELLED (không đổi seat — không reserve ở PENDING).
- Khác → log + ignore. Trả 200 cho event không subscribe để tránh Stripe retry noise.

Errors:

- `STRIPE_WEBHOOK_INVALID` (400) — `Stripe-Signature` missing hoặc invalid.

Full setup local + production: [`docs/runbooks/vi/stripe-testing.md`](../../runbooks/vi/stripe-testing.md).

### Sprint B3.5 — Admin refund

| Method | Path | Access | Mô tả |
| --- | --- | --- | --- |
| POST | `/admin/bookings/:id/refund` | 🔒 ADMIN | Full refund Stripe trên booking PAID. Decrement `seatsBooked`, flip REFUNDED, set `cancelledAt`, gửi email refund. |

Body:

```json
{ "reason": "Tour bị hủy do thời tiết" }
```

`reason` optional, free-form. Nếu match enum Stripe (`duplicate` / `fraudulent` / `requested_by_customer`) sẽ forward; còn lại lưu vào Stripe metadata.

Thứ tự thực thi:

1. Validate booking PAID + có `stripePaymentIntentId`.
2. Gọi Stripe refund TRƯỚC (authoritative — nếu Stripe reject thì DB vẫn PAID).
3. Trong 1 transaction: decrement `tour_departures.seats_booked` + flip booking REFUNDED + set `cancelledAt`.
4. Gửi email `bookingRefunded` (defensive — fail log-and-continue).

Lỗi:

- `BOOKING_NOT_FOUND` (404)
- `BOOKING_NOT_REFUNDABLE` (400) — không phải PAID, hoặc thiếu payment_intent.
- `REFUND_FAILED` (400) — Stripe reject (vd: dispute window đóng).

### Sprint B3.6 — Email giao dịch (Resend)

`EmailService` (global) wrap Resend với try/catch defensive — send fail log WARN và không bao giờ throw, vì vậy SMTP gặp lỗi không rollback booking PAID hoặc refund thành công. 2 template ship bilingual (EN/VI) inline, chọn theo `user.locale`:

- `bookingConfirmation` — webhook gửi khi transition PAID.
- `bookingRefunded` — `refundByAdmin` gửi sau khi refund Stripe + DB commit.

Setup + production checklist: [`docs/runbooks/vi/email.md`](../../runbooks/vi/email.md).

### Sprint B4.1 — Review của khách (create)

| Method | Path | Access | Mô tả |
| --- | --- | --- | --- |
| POST | `/reviews` | 🔒 customer | Tạo review cho 1 trong các booking PAID của caller. |

Body: `{ bookingCode, rating (1-5), title?, body }`.

Điều kiện: booking phải PAID, thuộc caller, và chưa có review (`Review.bookingId` UNIQUE). Row mới default `isApproved=false` và chưa hiện công khai cho đến khi admin approve (B4.3).

Lỗi:

- `BOOKING_NOT_FOUND` (404)
- `BOOKING_FORBIDDEN` (403) — caller không sở hữu booking.
- `REVIEW_NOT_ELIGIBLE` (400) — booking không phải PAID.
- `REVIEW_ALREADY_EXISTS` (409) — booking đã có review.

### Sprint B4.2 — Public review list

| Method | Path | Access | Mô tả |
| --- | --- | --- | --- |
| GET | `/tours/:slug/reviews` | 🌐 public | Approved review của 1 tour, paginated. |

Query: `?page=1&limit=10` (max 50). Sort fixed newest-first.

Response strip PII — chỉ expose `reviewer.fullName`, không bao giờ email/phone/userId/bookingId. `meta.averageRating` tính trên **toàn bộ** approved review (không chỉ page hiện tại), dùng cho FE tour card.

Lỗi:

- `TOUR_NOT_FOUND` (404) — slug không tồn tại hoặc tour chưa publish.

### Sprint B4.3 — Admin moderation

| Method | Path | Access | Mô tả |
| --- | --- | --- | --- |
| PATCH | `/admin/reviews/:id` | 🔒 ADMIN | Toggle `isApproved` của 1 review. |

Body: `{ "isApproved": true | false }`.

Idempotent — flip về cùng giá trị hiện tại là no-op write. Dạng boolean (vs. 2 endpoint approve/reject riêng) cho phép admin re-draft 1 review đã publish nếu bị flag sau.

Lỗi:

- `REVIEW_NOT_FOUND` (404)

### Sprint B4.4 — Wishlist

| Method | Path | Access | Mô tả |
| --- | --- | --- | --- |
| POST | `/wishlist/:tourId` | 🔒 customer | Thêm tour. Upsert idempotent. |
| DELETE | `/wishlist/:tourId` | 🔒 customer | Xóa tour. Idempotent. |
| GET | `/wishlist/me` | 🔒 customer | List của caller, newest-first, join tour preview. |

Schema: composite-PK `(userId, tourId)`. Tour preview join vào `GET /me` gồm slug, cả 2 title, summary, hero image, basePrice, currency, durationDays — đủ render card không cần fetch thêm.

Lỗi:

- `TOUR_NOT_FOUND` (404) khi add với tour id không tồn tại hoặc chưa publish.

### Sprint B4.5 — Admin dashboard stats

| Method | Path | Access | Mô tả |
| --- | --- | --- | --- |
| GET | `/admin/stats` | 🔒 ADMIN | Payload tổng hợp dashboard — overview + status breakdown + 3 top-N list + trend 6 tháng. |

Response shape:

```jsonc
{
  "overview": {
    "totalRevenue": "450",       // tổng PAID, Decimal dạng string
    "currency": "USD",
    "totalBookings": 5,
    "paidBookings": 3,
    "conversionRate": 0.6,        // paidBookings / totalBookings
    "monthOverMonthGrowth": 0.5   // null nếu không có data tháng trước
  },
  "bookingsByStatus": { "PENDING": 1, "PAID": 3, "CANCELLED": 0, "REFUNDED": 1 },
  "topToursByRevenue": [{ "tourId", "slug", "titleEn", "revenue", "bookingsCount" }],
  "topToursByRating":  [{ "tourId", "slug", "titleEn", "averageRating", "reviewsCount" }],
  "topToursByWishlist":[{ "tourId", "slug", "titleEn", "wishlistCount" }],
  "monthlyTrend":      [{ "month": "2026-05", "bookings": 4, "revenue": "150" }]
}
```

Implementation: tất cả slice chạy song song qua `Promise.all`. Hầu hết dùng Prisma `groupBy`/`aggregate` (đã có index: `bookings(status, createdAt)`, `reviews(tourId, isApproved)`). Monthly bucket dùng `$queryRaw` với `date_trunc('month', ...)` vì Prisma typed API chưa expose.

Lưu ý currency: aggregate raw `totalAmount` không convert FX — OK cho seed USD-only của đồ án; xem xét lại khi multi-currency.

### Sprint B4 hoàn tất

Reviews + Wishlist + Admin stats — đã ship 5 sub-feature.

### Sprint B4.6 — planned (Figma alignment trước FE)

Schema + service tweak để FE template wire 1:1 với design Figma. Sub-feature bên dưới; rationale đầy đủ ở [`sprints/b4.6-figma-alignment.md`](sprints/b4.6-figma-alignment.md).

| Thay đổi | Surface |
| --- | --- |
| `Tour.isFeatured` boolean | Schema; drives strip "Trending" home |
| Mở rộng `TourCategory` với `HONEYMOON`, `MUSICAL` | Schema; drives Services dropdown |
| `?featured=true` + `sort=createdDesc\|priceAsc\|priceDesc\|titleAsc\|titleDesc` | `GET /tours` query DTO |
| `averageRating`, `reviewsCount`, `peopleGoing` per card | `GET /tours` response payload |
| `isFeatured?` trên Create/Update DTO | `POST/PATCH /admin/tours` |

Out of scope (xem [`BACKLOG.md`](../BACKLOG.md)): Build Your Own Package custom builder, newsletter subscribe, multi-currency revenue.

### Sprint B5 — on hold

Hardening + Railway deploy. Pause cho đến khi FE customer + FE admin cả 2 land, để deploy 1 lần cả hệ thống đã validate, thay vì redeploy BE mỗi lần FE phát hiện gap. Xem `sprints/b4.6-figma-alignment.md` § "Vì sao pause B5".

Xem [`roadmap.md`](../roadmap.md) để biết tracker chi tiết theo từng sub-feature.
