<!-- markdownlint-disable MD033 MD013 -->
<!-- MD033 (inline HTML): các cell trong bảng dùng <br> để xuống dòng từng bước
     — bắt buộc với bảng GFM nhiều dòng, không thay được bằng markdown thuần.
     MD013 (line length): một row của bảng GFM phải nằm trọn trên một dòng. -->

# Function Catalog — Admin

Danh sách function **phía quản trị** của backend tourism-be-api, dựng trực tiếp
từ các endpoint thực tế trong `apps/api/src` (đối chiếu [api-overview.md](api-overview.md)
và [erd.md](erd.md)). Phần **Description** viết tiếng Việt theo từng bước
(`1. … 2. … 3. …`) để dùng vẽ **Activity / Sequence diagram** (bạn tự vẽ).

> Function phía khách hàng nằm ở [functions-customer.md](functions-customer.md).

## Quy ước cột

- **Code** — mã function: `A-xx` (Admin).
- **Functions** — tên nghiệp vụ + endpoint REST (prefix `/api/v1`).
- **Description** — luồng xử lý từng bước (server-side).
- **Entity** — tác nhân chính (Admin).
- **Models** — Prisma model liên quan.
- **Database** — bảng Postgres bị đọc/ghi.
- **Diagram** — loại sơ đồ gợi ý.
- **Trạng thái** — kết quả đợt rà soát 2026-06-12:
  - ✅ **Giữ** — logic đã chặt, không cần đụng tới.
  - 🔧 **Đã điều chỉnh** — đã sửa trong đợt rà soát (review lại khi cần).
  - 🕒 **Tương lai** — hoạt động đúng nhưng có điểm cần điều chỉnh sau (ghi rõ việc cần làm).

> Phân quyền: mọi endpoint admin cần JWT đã `/auth/admin/sync`, gác bằng
> `@Roles(ADMIN)` + email nằm trong allowlist `ADMIN_EMAILS`.
>
> **Chính sách xóa (delete) — chốt 2026-06-12, 3 tầng:** (1) **ẩn** trước —
> `isActive`/`isPublished` = false (đảo ngược được); (2) **chỉ bản ghi đã ẩn
> mới xóa cứng được** (guard `*_IS_ACTIVE` / `*_IS_PUBLISHED`); (3) bản ghi đã
> được tham chiếu (tour có booking, destination có tour, departure có booking)
> thì **bất tử** nhờ FK `Restrict` ở tầng DB. Booking / PaymentEvent / Review /
> User **không tồn tại endpoint xóa** — hồ sơ tài chính và nội dung người dùng
> chỉ đổi trạng thái.

---

## Admin function

| Code | Functions | Description | Entity | Models | Database | Diagram | Trạng thái |
| ---- | --------- | ----------- | ------ | ------ | -------- | ------- | ---------- |
| A-01 | Admin Sync Account<br>`POST /auth/admin/sync` | 1. Admin đăng nhập qua Supabase (FE admin), nhận token<br>2. Gửi `POST /auth/admin/sync` kèm Bearer token<br>3. Guard verify JWT<br>4. Kiểm tra email nằm trong allowlist `ADMIN_EMAILS` (403 `NOT_ADMIN` nếu không)<br>5. Upsert user với role `ADMIN`<br>6. Trả hồ sơ admin | Admin | User | users | Sequence | ✅ Giữ |
| A-02 | List Destinations<br>`GET /admin/destinations` | 1. Admin mở quản lý điểm đến<br>2. Gửi `GET /admin/destinations` (thấy cả bản nháp/inactive)<br>3. Lọc theo `isActive` nếu cần<br>4. Phân trang<br>5. Trả danh sách | Admin | Destination | destinations | Activity | ✅ Giữ |
| A-03 | View Destination<br>`GET /admin/destinations/:slug` | 1. Admin chọn một điểm đến<br>2. Gửi `GET /admin/destinations/:slug` (không lọc `isActive`)<br>3. Trả chi tiết hoặc 404 | Admin | Destination | destinations | Activity | ✅ Giữ |
| A-04 | Create Destination<br>`POST /admin/destinations` | 1. Admin nhập name (en/vi), country, region, description; `slug` **tùy chọn, format tự do**<br>2. Server **chuẩn hóa slug qua `slugify()`** (bỏ dấu tiếng Việt, lowercase, kebab, cắt 80 ký tự); bỏ trống → **tự sinh từ `nameEn`**; input không còn ký tự dùng được → 400 `INVALID_SLUG`<br>3. Gửi `POST /admin/destinations`<br>4. 409 `DESTINATION_SLUG_EXISTS` nếu trùng slug (sau chuẩn hóa)<br>5. Tạo bản ghi `destinations`<br>6. Trả destination | Admin | Destination | destinations | Activity | 🔧 Đã điều chỉnh (2026-06-12) — slug auto-normalize/generate; admin gõ "Hội An 2024" kiểu gì cũng ra `hoi-an-2024` |
| A-05 | Update Destination<br>`PATCH /admin/destinations/:slug` | 1. Admin sửa trường bất kỳ<br>2. Gửi `PATCH /admin/destinations/:slug`<br>3. Validate dữ liệu; **slug gửi kèm cũng đi qua chuẩn hóa `slugify()` như create**<br>4. Cập nhật (đổi slug được nhưng làm hỏng bookmark cũ)<br>5. Trả bản ghi đã cập nhật | Admin | Destination | destinations | Activity | 🔧 Đã điều chỉnh (2026-06-12) — normalize slug khi rename |
| A-06 | Delete Destination<br>`DELETE /admin/destinations/:slug` | 1. Admin xoá điểm đến<br>2. Gửi `DELETE /admin/destinations/:slug`<br>3. **409 `DESTINATION_IS_ACTIVE` nếu đang công khai — phải deactivate trước (delete 2 tầng)**<br>4. 409 `DESTINATION_HAS_TOURS` nếu còn tour tham chiếu (FK Restrict)<br>5. Xoá cứng bản ghi + media trong cùng transaction<br>6. Trả xác nhận | Admin | Destination, Tour | destinations, tours | Activity | 🔧 Đã điều chỉnh (2026-06-12) — thêm tầng guard `IS_ACTIVE`; click nhầm không thể xóa nội dung đang hiển thị |
| A-07 | Create Tour<br>`POST /admin/tours` | 1. Admin nhập title (en/vi), summary, `destinationId`, `durationDays`, `maxGroupSize`, `basePrice`, currency, category…; `slug` **tùy chọn, format tự do**<br>2. Server **chuẩn hóa slug qua `slugify()`** (cắt 120 ký tự); bỏ trống → **tự sinh từ `titleEn`**; không dùng được → 400 `INVALID_SLUG`<br>3. Gửi `POST /admin/tours`<br>4. 400 `INVALID_DESTINATION` nếu `destinationId` không tồn tại<br>5. 409 `TOUR_SLUG_EXISTS` nếu trùng slug (sau chuẩn hóa)<br>6. Tạo tour (mặc định chưa publish)<br>7. Trả tour | Admin | Tour, Destination | tours, destinations | Activity | 🔧 Đã điều chỉnh (2026-06-12) — slug auto-normalize/generate |
| A-08 | View Tour<br>`GET /admin/tours/:slug` | 1. Admin chọn tour (kể cả bản nháp)<br>2. Gửi `GET /admin/tours/:slug` kèm `destination`<br>3. 404 `TOUR_NOT_FOUND` nếu thiếu<br>4. Trả chi tiết | Admin | Tour, Destination | tours, destinations | Activity | ✅ Giữ |
| A-09 | Update Tour<br>`PATCH /admin/tours/:slug` | 1. Admin sửa tour (publish/ẩn, giá, nội dung…)<br>2. Gửi `PATCH /admin/tours/:slug`<br>3. Nếu gửi `destinationId` thì revalidate FK; **slug gửi kèm đi qua chuẩn hóa `slugify()`**<br>4. Cập nhật bản ghi<br>5. Trả tour | Admin | Tour, Destination | tours | Activity | 🔧 Đã điều chỉnh (2026-06-12) — normalize slug khi rename. 🕒 Tương lai: unpublish tour đang có booking PAID làm trang tour 404 với khách đã mua — cân nhắc cảnh báo ở admin FE |
| A-10 | Delete Tour<br>`DELETE /admin/tours/:slug` | 1. Admin xoá tour<br>2. Gửi `DELETE /admin/tours/:slug`<br>3. **409 `TOUR_IS_PUBLISHED` nếu đang publish — phải unpublish trước (delete 2 tầng)**<br>4. 409 `TOUR_HAS_BOOKINGS` nếu có booking tham chiếu (FK Restrict — mọi status)<br>5. Xoá cứng + media trong cùng transaction (itinerary/departures/reviews/wishlist cascade)<br>6. Trả xác nhận | Admin | Tour, Booking | tours, bookings | Activity | 🔧 Đã điều chỉnh (2026-06-12) — thêm tầng guard `IS_PUBLISHED` |
| A-11 | List Itinerary<br>`GET /admin/tours/:slug/itinerary` | 1. Admin mở lịch trình của tour<br>2. Gửi `GET /admin/tours/:slug/itinerary`<br>3. Trả các ngày, sắp xếp tăng theo `dayNumber` | Admin | TourItineraryDay | tour_itinerary_days | Activity | ✅ Giữ |
| A-12 | Create Itinerary Day<br>`POST /admin/tours/:slug/itinerary` | 1. Admin nhập `dayNumber`, title (en/vi), description (en/vi)<br>2. Gửi `POST /admin/tours/:slug/itinerary`<br>3. 409 `ITINERARY_DAY_EXISTS` nếu `(tourId, dayNumber)` trùng<br>4. Tạo ngày lịch trình<br>5. Trả bản ghi | Admin | TourItineraryDay, Tour | tour_itinerary_days, tours | Activity | ✅ Giữ. 🕒 Tương lai: `dayNumber` không so với `durationDays` (chủ đích — cho phép draft trước); nên validate/cảnh báo lúc **publish** tour thay vì lúc nhập |
| A-13 | Update Itinerary Day<br>`PATCH /admin/tours/:slug/itinerary/:dayNumber` | 1. Admin sửa nội dung một ngày<br>2. Gửi `PATCH …/itinerary/:dayNumber`<br>3. Gửi `dayNumber` mới thì đánh số lại (vẫn theo ràng buộc UNIQUE)<br>4. 404 `ITINERARY_DAY_NOT_FOUND` nếu không có<br>5. Trả bản ghi | Admin | TourItineraryDay | tour_itinerary_days | Activity | ✅ Giữ |
| A-14 | Delete Itinerary Day<br>`DELETE /admin/tours/:slug/itinerary/:dayNumber` | 1. Admin xoá một ngày lịch trình<br>2. Gửi `DELETE …/itinerary/:dayNumber`<br>3. 404 nếu không có<br>4. Trả echo xác nhận | Admin | TourItineraryDay | tour_itinerary_days | Activity | ✅ Giữ — nội dung draft thuần, không bảng nào tham chiếu, xóa cứng hợp lý |
| A-15 | List Departures<br>`GET /admin/tours/:slug/departures` | 1. Admin xem toàn bộ lịch khởi hành (cả `CLOSED`/`CANCELLED`)<br>2. Gửi `GET /admin/tours/:slug/departures` (không có default)<br>3. Lọc `from` / `to` / `status`<br>4. Trả danh sách đầy đủ | Admin | TourDeparture | tour_departures | Activity | ✅ Giữ |
| A-16 | Create Departure<br>`POST /admin/tours/:slug/departures` | 1. Admin nhập `startDate`, `endDate`, `seatsTotal`, `priceOverride`, `status`<br>2. Gửi `POST /admin/tours/:slug/departures`<br>3. 400 `INVALID_DATE_RANGE` nếu `endDate < startDate`<br>4. **400 `DEPARTURE_IN_PAST` nếu `startDate` đã qua (so sánh calendar-date UTC, same-day vẫn tạo được) — chống typo tạo "chuyến ma"**<br>5. Tạo departure (`seatsBooked = 0`)<br>6. Trả bản ghi | Admin | TourDeparture, Tour | tour_departures, tours | Activity | 🔧 Đã điều chỉnh (2026-06-12) — đồng bộ chuẩn "quá khứ" với U-10 phía khách |
| A-17 | Update Departure<br>`PATCH /admin/tours/:slug/departures/:id` | 1. Admin sửa departure (ghế, giá, trạng thái…)<br>2. Gửi `PATCH …/departures/:id`<br>3. Guard: `seatsTotal >= seatsBooked` (400 `SEATS_TOTAL_BELOW_BOOKED`); sửa 1 trong 2 ngày thì validate chéo với ngày còn lại<br>4. Cập nhật bản ghi<br>5. Trả departure | Admin | TourDeparture | tour_departures | Activity | ✅ Giữ. 🕒 Tương lai: set `CANCELLED` khi đang có booking PAID không kéo theo refund/notify — cần flow liên kết (bulk-refund hoặc cảnh báo số đơn PAID) khi làm admin FE |
| A-18 | Delete Departure<br>`DELETE /admin/tours/:slug/departures/:id` | 1. Admin xoá departure<br>2. Gửi `DELETE …/departures/:id`<br>3. 409 `DEPARTURE_HAS_BOOKINGS` nếu đã bán ghế (pre-check) HOẶC còn bất kỳ booking row nào tham chiếu (FK Restrict — mọi status)<br>4. Xoá cứng (chỉ chạm được departure chưa từng có booking)<br>5. Trả xác nhận | Admin | TourDeparture | tour_departures | Activity | ✅ Giữ — đường khuyến nghị là set `CANCELLED` (soft) thay vì xóa |
| A-19 | Sign Upload<br>`POST /admin/uploads/signed-url` | 1. Admin chọn ảnh/clip + `purpose` (`TOUR_HERO` / `TOUR_GALLERY` / `TOUR_VIDEO` / `DESTINATION_HERO` / `DESTINATION_VIDEO` / `USER_AVATAR`)<br>2. Gửi `POST /admin/uploads/signed-url` kèm `filename`, `contentType`<br>3. Server validate định dạng theo resource type (400 `MEDIA_FORMAT_REJECTED`) rồi ký chữ ký Cloudinary trên folder + publicId do **server tự quyết** (sanitize chống path traversal)<br>4. Trả `{ signature, timestamp, apiKey, cloudName, folder, publicId, resourceType, uploadUrl }`<br>5. FE `POST` thẳng file lên Cloudinary; sau đó lưu `publicId` qua `media[]` của tour/destination (server không chạm bytes) | Admin | — (Cloudinary) → MediaAsset | media_assets | Sequence | ✅ Giữ — chuẩn nhất nhóm admin |
| A-20 | Refund Booking<br>`POST /admin/bookings/:id/refund` | 1. Admin chọn booking `PAID` để hoàn tiền + nhập `reason`<br>2. Gửi `POST /admin/bookings/:id/refund`<br>3. Kiểm tra booking `PAID` + có `stripePaymentIntentId` (400 `BOOKING_NOT_REFUNDABLE` nếu không)<br>4. Gọi Stripe refund TRƯỚC (Stripe lỗi → giữ nguyên `PAID`, trả `REFUND_FAILED`); **riêng `charge_already_refunded` (đã hoàn qua Stripe Dashboard) → KHÔNG lỗi, tiếp tục hội tụ DB về REFUNDED**<br>5. Trong 1 transaction: giảm `seatsBooked` + booking → `REFUNDED` + set `cancelledAt` + **lưu audit `refund_reason` và `refunded_by` (users.id của admin)**<br>6. Gửi email `bookingRefunded`<br>7. Trả booking | Admin | Booking, TourDeparture | bookings, tour_departures, payment_events | Sequence | 🔧 Đã điều chỉnh (2026-06-12) — converge khi đã hoàn out-of-band + cột audit. 🕒 Tương lai: partial refund (hoàn một phần) khi nghiệp vụ cần |
| A-21 | Moderate Review<br>`PATCH /admin/reviews/:id` | 1. Admin xem review đang chờ duyệt<br>2. Gửi `PATCH /admin/reviews/:id` với `{ isApproved: true \| false }`<br>3. 404 `REVIEW_NOT_FOUND` nếu không có<br>4. Bật/tắt hiển thị công khai (idempotent)<br>5. Trả review | Admin | Review | reviews | Activity | ✅ Giữ. 🕒 Tương lai: thêm audit `moderated_by`/`moderated_at` khi làm admin FE |
| A-22 | Dashboard Stats<br>`GET /admin/stats` | 1. Admin mở dashboard<br>2. Gửi `GET /admin/stats`<br>3. Server chạy song song (`Promise.all` — đúng quy tắc pooler): overview (doanh thu từ booking `PAID` — REFUNDED tự loại vì đã đổi status, tỉ lệ chuyển đổi, tăng trưởng so tháng trước), `bookingsByStatus`, top tour theo doanh thu / đánh giá / wishlist, xu hướng 6 tháng<br>4. Trả payload tổng hợp | Admin | Booking, Review, Wishlist, Tour | bookings, reviews, wishlist, tours | Activity | ✅ Giữ. 🕒 Tương lai: (1) thống kê **lời/vốn** cần thêm cột `costPrice` (giá vốn) vào Tour — quyết định nghiệp vụ, chưa làm; (2) tổng doanh thu cộng thô `totalAmount` không quy đổi tiền tệ — hiện toàn USD nên đúng, thêm tour VND thì phải quy đổi |

---

## Lịch sử rà soát

- **2026-06-12** — Rà soát toàn bộ A-01→A-22 (đối chiếu docs ↔ code). Điều chỉnh:
  slug auto-normalize/generate qua `slugify()` (A-04/05/07/09 — bỏ dấu tiếng Việt,
  admin gõ format tự do); **delete 2 tầng** (A-06/A-10 — nội dung đang công khai
  phải ẩn trước mới xóa được, cộng FK Restrict sẵn có thành 3 tầng bảo vệ);
  chặn departure quá khứ (A-16 `DEPARTURE_IN_PAST`); refund hội tụ khi
  `charge_already_refunded` + cột audit `refund_reason`/`refunded_by` (A-20).
  Đã xác minh bằng SQL trực tiếp: tour có booking **không thể xóa** kể cả bypass
  API (FK `Restrict`, lỗi 23503) — lịch sử booking của khách không bao giờ null.
