# Function Catalog — tourism-be-api

Danh sách function của backend, **tách theo Customer và Admin**, dựng trực tiếp
từ các endpoint thực tế trong `apps/api/src` (đối chiếu [api-overview.md](api-overview.md)
và [erd.md](erd.md)). Phần **Description** viết tiếng Việt theo từng bước
(`1. … 2. … 3. …`) để dùng vẽ **Activity / Sequence diagram** (bạn tự vẽ).

**Quy ước cột**

- **Code** — mã function: `U-xx` (Customer/User), `A-xx` (Admin).
- **Functions** — tên nghiệp vụ + endpoint REST (prefix `/api/v1`).
- **Description** — luồng xử lý từng bước (server-side).
- **Entity** — tác nhân chính (Customer / Admin / System).
- **Models** — Prisma model liên quan.
- **Database** — bảng Postgres bị đọc/ghi.
- **Diagram** — loại sơ đồ gợi ý.

> Phân quyền: endpoint công khai (browse) không cần đăng nhập; endpoint khách
> hàng cần JWT đã `/auth/sync`; endpoint admin cần `@Roles(ADMIN)` + email trong
> `ADMIN_EMAILS`.

---

## User function (Customer)

| Code | Functions | Description | Entity | Models | Database | Diagram |
| --- | --- | --- | --- | --- | --- | --- |
| U-01 | Sync Account<br>`POST /auth/sync` | 1. FE đăng nhập/đăng ký qua Supabase, nhận `access_token`<br>2. Gửi `POST /auth/sync` kèm `Bearer <token>`<br>3. Guard verify JWT qua Supabase JWKS (ES256)<br>4. Lấy `supabaseId` + email từ token<br>5. Upsert user vào DB với role `CUSTOMER` (idempotent)<br>6. Trả về hồ sơ user | Customer | User | users | Sequence |
| U-02 | View Profile<br>`GET /users/me` | 1. User đã đăng nhập gọi `GET /users/me` kèm Bearer token<br>2. Guard verify JWT + nạp user nội bộ theo `supabaseId`<br>3. Nếu chưa sync → 401 `USER_NOT_SYNCED`<br>4. Trả hồ sơ (email, fullName, phone, locale, role) | Customer | User | users | Sequence |
| U-03 | Update Profile<br>`PATCH /users/me` | 1. User nhập `fullName` / `phone` / `locale`<br>2. Gửi `PATCH /users/me`<br>3. Validate dữ liệu bằng DTO<br>4. `email` và `role` là bất biến — bỏ qua nếu client gửi<br>5. Cập nhật bản ghi `users`<br>6. Trả hồ sơ đã cập nhật | Customer | User | users | Activity |
| U-04 | Browse Destinations<br>`GET /destinations` | 1. User mở trang điểm đến<br>2. Gửi `GET /destinations` với `page`, `pageSize`, `search`, `sortBy`, `sortOrder`<br>3. Server chỉ lấy destination đang `isActive`<br>4. Tìm kiếm theo tên (en+vi), không phân biệt hoa thường<br>5. Phân trang + sắp xếp<br>6. Trả danh sách + `meta` phân trang | Customer | Destination | destinations | Activity |
| U-05 | View Destination Detail<br>`GET /destinations/:slug` | 1. User chọn một điểm đến<br>2. Gửi `GET /destinations/:slug`<br>3. Server tìm destination `isActive` theo slug<br>4. Nếu không có hoặc đang ẩn → 404 `DESTINATION_NOT_FOUND`<br>5. Trả chi tiết điểm đến | Customer | Destination | destinations | Activity |
| U-06 | Search / Browse Tours<br>`GET /tours` | 1. User mở danh mục tour<br>2. Chọn bộ lọc: `destination`, `category`, `minPrice`/`maxPrice`, `duration`, `featured`, `q` (từ khóa)<br>3. Chọn sắp xếp: `createdAt` / `basePrice` / `durationDays` / `titleEn`<br>4. Gửi `GET /tours`<br>5. Server chỉ trả tour `isPublished = true` (ẩn bản nháp)<br>6. Phân trang<br>7. Trả danh sách tour + `meta` | Customer | Tour, Destination | tours (join destinations) | Activity |
| U-07 | View Tour Detail<br>`GET /tours/:slug` | 1. User chọn một tour<br>2. Gửi `GET /tours/:slug`<br>3. Server tải tour đã publish kèm `destination` + `itinerary` (sắp xếp theo `dayNumber`)<br>4. Nếu slug thiếu hoặc chưa publish → 404 (không lộ bản nháp)<br>5. Trả chi tiết tour + lịch trình | Customer | Tour, Destination, TourItineraryDay | tours, destinations, tour_itinerary_days | Activity |
| U-08 | View Tour Departures<br>`GET /tours/:slug/departures` | 1. User xem các ngày khởi hành của tour<br>2. Gửi `GET /tours/:slug/departures` (mặc định `from = hôm nay`, `status = OPEN`)<br>3. Có thể lọc `from` / `to` / `status`<br>4. Server trả các departure đang mở, kèm ghế còn lại (`seatsTotal - seatsBooked`) | Customer | TourDeparture | tour_departures | Activity |
| U-09 | View Tour Reviews<br>`GET /tours/:slug/reviews` | 1. User xem đánh giá của tour<br>2. Gửi `GET /tours/:slug/reviews?page&limit`<br>3. Server chỉ trả review đã duyệt (`isApproved = true`), mới nhất trước<br>4. Ẩn PII — chỉ lộ `reviewer.fullName`<br>5. Trả danh sách + `meta.averageRating` (trung bình toàn bộ review đã duyệt) | Customer | Review, User | reviews, users | Activity |
| U-10 | Book a Tour<br>`POST /bookings` | 1. User chọn tour + departure, nhập số người lớn/trẻ em + thông tin liên hệ<br>2. Gửi `POST /bookings` kèm Bearer token<br>3. Server kiểm tra tour đã publish + departure thuộc tour và đang `OPEN`<br>4. Kiểm tra sơ bộ còn đủ ghế (409 `SEATS_NOT_AVAILABLE` nếu thiếu)<br>5. Tính `totalAmount = (numAdults + numChildren) × (priceOverride ?? basePrice)`<br>6. Tạo booking `PENDING` + sinh mã `BK-XXXXXXXX`<br>7. Tạo Stripe Checkout session (metadata `bookingId`/`bookingCode`)<br>8. Lưu `stripeSessionId`<br>9. Trả `{ bookingId, bookingCode, checkoutUrl, status }` | Customer | Booking, Tour, TourDeparture | bookings, tours, tour_departures | Sequence |
| U-11 | Pay & Confirm Booking<br>`POST /payments/webhook` (Stripe→server) | 1. User thanh toán trên trang Stripe Checkout (`checkoutUrl`)<br>2. Stripe gửi webhook `checkout.session.completed` (có chữ ký) về server<br>3. Server verify chữ ký `Stripe-Signature`; sai → 400 `STRIPE_WEBHOOK_INVALID`<br>4. Idempotent theo `event.id` (UNIQUE trong `payment_events`)<br>5. Trong transaction + khóa hàng departure: nếu còn ghế → `seatsBooked += N`, booking → `PAID`, lưu `paidAt` + `stripePaymentIntentId`<br>6. Nếu hết ghế (race) → tự hoàn tiền + `CANCELLED`<br>7. Gửi email xác nhận `bookingConfirmation` | System (Stripe) | Booking, TourDeparture, PaymentEvent | bookings, tour_departures, payment_events | Sequence |
| U-12 | View My Bookings<br>`GET /bookings/me` | 1. User mở "Đơn của tôi"<br>2. Gửi `GET /bookings/me` kèm Bearer token<br>3. Server lọc booking theo `userId`, mới nhất trước (tối đa 50)<br>4. Kèm tiêu đề tour + ngày khởi hành<br>5. Trả danh sách | Customer | Booking, Tour, TourDeparture | bookings | Activity |
| U-13 | View Booking Detail<br>`GET /bookings/:code` | 1. User chọn một đơn theo mã<br>2. Gửi `GET /bookings/:code`<br>3. Server chỉ cho chủ đơn hoặc admin xem<br>4. Người không sở hữu nhận 404 `BOOKING_NOT_FOUND` (chống dò mã)<br>5. Trả chi tiết đơn + tour + departure | Customer | Booking, Tour, TourDeparture | bookings | Activity |
| U-14 | Write Review<br>`POST /reviews` | 1. User chọn booking đã hoàn tất để đánh giá<br>2. Nhập `rating` (1–5), `title`, `body`<br>3. Gửi `POST /reviews` kèm `bookingCode`<br>4. Server kiểm tra booking tồn tại + thuộc về user + trạng thái `PAID`<br>5. Mỗi booking chỉ 1 review (`bookingId` UNIQUE)<br>6. Tạo review `isApproved = false` (chờ admin duyệt)<br>7. Trả review vừa tạo | Customer | Review, Booking | reviews, bookings | Activity |
| U-15 | Add to Wishlist<br>`POST /wishlist/:tourId` | 1. User bấm yêu thích một tour<br>2. Gửi `POST /wishlist/:tourId`<br>3. Server kiểm tra tour tồn tại + đã publish (404 nếu không)<br>4. Upsert `(userId, tourId)` — idempotent<br>5. Trả bản ghi wishlist | Customer | Wishlist, Tour | wishlist | Activity |
| U-16 | Remove from Wishlist<br>`DELETE /wishlist/:tourId` | 1. User bỏ yêu thích một tour<br>2. Gửi `DELETE /wishlist/:tourId`<br>3. Server xoá bản ghi (idempotent — không lỗi nếu không tồn tại)<br>4. Trả 204 No Content | Customer | Wishlist | wishlist | Activity |
| U-17 | View Wishlist<br>`GET /wishlist/me` | 1. User mở danh sách yêu thích<br>2. Gửi `GET /wishlist/me`<br>3. Server trả danh sách mới nhất trước, kèm preview tour (slug, tiêu đề, ảnh hero, `basePrice`, currency, số ngày) | Customer | Wishlist, Tour | wishlist, tours | Activity |

---

## Admin function

| Code | Functions | Description | Entity | Models | Database | Diagram |
| --- | --- | --- | --- | --- | --- | --- |
| A-01 | Admin Sync Account<br>`POST /auth/admin/sync` | 1. Admin đăng nhập qua Supabase (FE admin), nhận token<br>2. Gửi `POST /auth/admin/sync` kèm Bearer token<br>3. Guard verify JWT<br>4. Kiểm tra email nằm trong allowlist `ADMIN_EMAILS` (403 `NOT_ADMIN` nếu không)<br>5. Upsert user với role `ADMIN`<br>6. Trả hồ sơ admin | Admin | User | users | Sequence |
| A-02 | List Destinations<br>`GET /admin/destinations` | 1. Admin mở quản lý điểm đến<br>2. Gửi `GET /admin/destinations` (thấy cả bản nháp/inactive)<br>3. Lọc theo `isActive` nếu cần<br>4. Phân trang<br>5. Trả danh sách | Admin | Destination | destinations | Activity |
| A-03 | View Destination<br>`GET /admin/destinations/:slug` | 1. Admin chọn một điểm đến<br>2. Gửi `GET /admin/destinations/:slug` (không lọc `isActive`)<br>3. Trả chi tiết hoặc 404 | Admin | Destination | destinations | Activity |
| A-04 | Create Destination<br>`POST /admin/destinations` | 1. Admin nhập `slug`, name (en/vi), country, region, hero, description<br>2. Validate DTO + slug kebab-case (2–80 ký tự)<br>3. Gửi `POST /admin/destinations`<br>4. 409 `DESTINATION_SLUG_EXISTS` nếu trùng slug<br>5. Tạo bản ghi `destinations`<br>6. Trả destination | Admin | Destination | destinations | Activity |
| A-05 | Update Destination<br>`PATCH /admin/destinations/:slug` | 1. Admin sửa trường bất kỳ<br>2. Gửi `PATCH /admin/destinations/:slug`<br>3. Validate dữ liệu<br>4. Cập nhật (đổi slug được nhưng làm hỏng bookmark cũ)<br>5. Trả bản ghi đã cập nhật | Admin | Destination | destinations | Activity |
| A-06 | Delete Destination<br>`DELETE /admin/destinations/:slug` | 1. Admin xoá điểm đến<br>2. Gửi `DELETE /admin/destinations/:slug`<br>3. 409 `DESTINATION_HAS_TOURS` nếu còn tour tham chiếu<br>4. Xoá cứng bản ghi<br>5. Trả xác nhận | Admin | Destination, Tour | destinations, tours | Activity |
| A-07 | Create Tour<br>`POST /admin/tours` | 1. Admin nhập slug, title (en/vi), summary, `destinationId`, `durationDays`, `maxGroupSize`, `basePrice`, currency, category…<br>2. Gửi `POST /admin/tours`<br>3. 400 `INVALID_DESTINATION` nếu `destinationId` không tồn tại<br>4. 409 `TOUR_SLUG_EXISTS` nếu trùng slug<br>5. Tạo tour (mặc định chưa publish)<br>6. Trả tour | Admin | Tour, Destination | tours, destinations | Activity |
| A-08 | View Tour<br>`GET /admin/tours/:slug` | 1. Admin chọn tour (kể cả bản nháp)<br>2. Gửi `GET /admin/tours/:slug` kèm `destination`<br>3. 404 `TOUR_NOT_FOUND` nếu thiếu<br>4. Trả chi tiết | Admin | Tour, Destination | tours, destinations | Activity |
| A-09 | Update Tour<br>`PATCH /admin/tours/:slug` | 1. Admin sửa tour (publish/ẩn, giá, nội dung…)<br>2. Gửi `PATCH /admin/tours/:slug`<br>3. Nếu gửi `destinationId` thì revalidate FK<br>4. Cập nhật bản ghi<br>5. Trả tour | Admin | Tour, Destination | tours | Activity |
| A-10 | Delete Tour<br>`DELETE /admin/tours/:slug` | 1. Admin xoá tour<br>2. Gửi `DELETE /admin/tours/:slug`<br>3. 409 `TOUR_HAS_BOOKINGS` nếu có booking tham chiếu<br>4. Xoá cứng<br>5. Trả xác nhận | Admin | Tour, Booking | tours, bookings | Activity |
| A-11 | List Itinerary<br>`GET /admin/tours/:slug/itinerary` | 1. Admin mở lịch trình của tour<br>2. Gửi `GET /admin/tours/:slug/itinerary`<br>3. Trả các ngày, sắp xếp tăng theo `dayNumber` | Admin | TourItineraryDay | tour_itinerary_days | Activity |
| A-12 | Create Itinerary Day<br>`POST /admin/tours/:slug/itinerary` | 1. Admin nhập `dayNumber`, title (en/vi), description (en/vi)<br>2. Gửi `POST /admin/tours/:slug/itinerary`<br>3. 409 `ITINERARY_DAY_EXISTS` nếu `(tourId, dayNumber)` trùng<br>4. Tạo ngày lịch trình<br>5. Trả bản ghi | Admin | TourItineraryDay, Tour | tour_itinerary_days, tours | Activity |
| A-13 | Update Itinerary Day<br>`PATCH /admin/tours/:slug/itinerary/:dayNumber` | 1. Admin sửa nội dung một ngày<br>2. Gửi `PATCH …/itinerary/:dayNumber`<br>3. Gửi `dayNumber` mới thì đánh số lại (vẫn theo ràng buộc UNIQUE)<br>4. 404 `ITINERARY_DAY_NOT_FOUND` nếu không có<br>5. Trả bản ghi | Admin | TourItineraryDay | tour_itinerary_days | Activity |
| A-14 | Delete Itinerary Day<br>`DELETE /admin/tours/:slug/itinerary/:dayNumber` | 1. Admin xoá một ngày lịch trình<br>2. Gửi `DELETE …/itinerary/:dayNumber`<br>3. 404 nếu không có<br>4. Trả echo xác nhận | Admin | TourItineraryDay | tour_itinerary_days | Activity |
| A-15 | List Departures<br>`GET /admin/tours/:slug/departures` | 1. Admin xem toàn bộ lịch khởi hành (cả `CLOSED`/`CANCELLED`)<br>2. Gửi `GET /admin/tours/:slug/departures` (không có default)<br>3. Lọc `from` / `to` / `status`<br>4. Trả danh sách đầy đủ | Admin | TourDeparture | tour_departures | Activity |
| A-16 | Create Departure<br>`POST /admin/tours/:slug/departures` | 1. Admin nhập `startDate`, `endDate`, `seatsTotal`, `priceOverride`, `status`<br>2. Gửi `POST /admin/tours/:slug/departures`<br>3. 400 `INVALID_DATE_RANGE` nếu `endDate < startDate`<br>4. Tạo departure (`seatsBooked = 0`)<br>5. Trả bản ghi | Admin | TourDeparture, Tour | tour_departures, tours | Activity |
| A-17 | Update Departure<br>`PATCH /admin/tours/:slug/departures/:id` | 1. Admin sửa departure (ghế, giá, trạng thái…)<br>2. Gửi `PATCH …/departures/:id`<br>3. Guard: `seatsTotal >= seatsBooked` (400 `SEATS_TOTAL_BELOW_BOOKED`)<br>4. Cập nhật bản ghi<br>5. Trả departure | Admin | TourDeparture | tour_departures | Activity |
| A-18 | Delete Departure<br>`DELETE /admin/tours/:slug/departures/:id` | 1. Admin xoá departure<br>2. Gửi `DELETE …/departures/:id`<br>3. 409 `DEPARTURE_HAS_BOOKINGS` nếu đã bán ghế (`seatsBooked > 0`)<br>4. Xoá cứng<br>5. Trả xác nhận | Admin | TourDeparture | tour_departures | Activity |
| A-19 | Mint Upload URL<br>`POST /admin/uploads/signed-url` | 1. Admin chọn ảnh + `purpose` (`TOUR_HERO` / `TOUR_GALLERY` / `DESTINATION_HERO` / `USER_AVATAR`)<br>2. Gửi `POST /admin/uploads/signed-url` kèm `filename`, `contentType`<br>3. Server (service role) tạo signed upload URL trên bucket `tourism-assets`<br>4. Trả `{ uploadUrl, token, path, bucket }`<br>5. FE `PUT` thẳng file lên Supabase Storage (server không chạm bytes) | Admin | — (Supabase Storage) | — | Sequence |
| A-20 | Refund Booking<br>`POST /admin/bookings/:id/refund` | 1. Admin chọn booking `PAID` để hoàn tiền + nhập `reason`<br>2. Gửi `POST /admin/bookings/:id/refund`<br>3. Kiểm tra booking `PAID` + có `stripePaymentIntentId` (400 `BOOKING_NOT_REFUNDABLE` nếu không)<br>4. Gọi Stripe refund TRƯỚC (nếu Stripe lỗi → giữ nguyên `PAID`, trả `REFUND_FAILED`)<br>5. Trong 1 transaction: giảm `seatsBooked` + booking → `REFUNDED` + set `cancelledAt`<br>6. Gửi email `bookingRefunded`<br>7. Trả booking | Admin | Booking, TourDeparture | bookings, tour_departures, payment_events | Sequence |
| A-21 | Moderate Review<br>`PATCH /admin/reviews/:id` | 1. Admin xem review đang chờ duyệt<br>2. Gửi `PATCH /admin/reviews/:id` với `{ isApproved: true \| false }`<br>3. 404 `REVIEW_NOT_FOUND` nếu không có<br>4. Bật/tắt hiển thị công khai (idempotent)<br>5. Trả review | Admin | Review | reviews | Activity |
| A-22 | Dashboard Stats<br>`GET /admin/stats` | 1. Admin mở dashboard<br>2. Gửi `GET /admin/stats`<br>3. Server chạy song song: overview (doanh thu `PAID`, tỉ lệ chuyển đổi, tăng trưởng so tháng trước), `bookingsByStatus`, top tour theo doanh thu / đánh giá / wishlist, xu hướng 6 tháng<br>4. Trả payload tổng hợp | Admin | Booking, Review, Wishlist, Tour | bookings, reviews, wishlist, tours | Activity |

---

## System / Public (không thuộc Customer hay Admin)

| Code | Functions | Description | Entity | Models | Database | Diagram |
| --- | --- | --- | --- | --- | --- | --- |
| S-01 | Liveness probe<br>`GET /health` | 1. Load balancer / uptime check gọi `GET /health`<br>2. Trả trạng thái `ok` + uptime — **không** chạm DB | System | — | — | — |
| S-02 | Readiness probe<br>`GET /health/ready` | 1. Orchestrator gọi `GET /health/ready`<br>2. Server ping DB<br>3. Trả `checks.database = up/down` | System | — | — | — |

> `POST /payments/webhook` đã liệt kê ở **U-11** vì nó nằm trong luồng thanh toán
> của khách hàng (Stripe gọi server-to-server).
