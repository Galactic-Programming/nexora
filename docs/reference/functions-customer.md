<!-- markdownlint-disable MD033 MD013 -->
<!-- MD033 (inline HTML): các cell trong bảng dùng <br> để xuống dòng từng bước
     — bắt buộc với bảng GFM nhiều dòng, không thay được bằng markdown thuần.
     MD013 (line length): một row của bảng GFM phải nằm trọn trên một dòng. -->

# Function Catalog — Customer (User)

Danh sách function **phía khách hàng** của backend tourism-be-api, dựng trực tiếp
từ các endpoint thực tế trong `apps/api/src` (đối chiếu [api-overview.md](api-overview.md)
và [erd.md](erd.md)). Phần **Description** viết tiếng Việt theo từng bước
(`1. … 2. … 3. …`) để dùng vẽ **Activity / Sequence diagram** (bạn tự vẽ).

> Function phía quản trị nằm ở [functions-admin.md](functions-admin.md).

## Quy ước cột

- **Code** — mã function: `U-xx` (Customer/User), `S-xx` (System/Public).
- **Functions** — tên nghiệp vụ + endpoint REST (prefix `/api/v1`).
- **Description** — luồng xử lý từng bước (server-side).
- **Entity** — tác nhân chính (Customer / System).
- **Models** — Prisma model liên quan.
- **Database** — bảng Postgres bị đọc/ghi.
- **Diagram** — loại sơ đồ gợi ý.
- **Trạng thái** — kết quả đợt rà soát 2026-06-12:
  - ✅ **Giữ** — logic đã chặt, không cần đụng tới.
  - 🔧 **Đã điều chỉnh** — đã sửa trong đợt rà soát (review lại khi cần).
  - 🕒 **Tương lai** — hoạt động đúng nhưng có điểm cần điều chỉnh sau (ghi rõ việc cần làm).

> Phân quyền: endpoint công khai (browse) không cần đăng nhập; endpoint khách
> hàng cần JWT đã `/auth/sync`.

---

## User function (Customer)

| Code | Functions | Description | Entity | Models | Database | Diagram | Trạng thái |
| ---- | --------- | ----------- | ------ | ------ | -------- | ------- | ---------- |
| U-01 | Sync Account<br>`POST /auth/sync` | 1. FE đăng nhập/đăng ký qua Supabase, nhận `access_token`<br>2. Gửi `POST /auth/sync` kèm `Bearer <token>`<br>3. Guard verify JWT qua Supabase JWKS (ES256)<br>4. Lấy `supabaseId` + email từ token<br>5. Upsert user vào DB với role `CUSTOMER` (idempotent; không bao giờ ghi đè `role` khi update — admin không bị tự giáng cấp)<br>6. Trả về hồ sơ user | Customer | User | users | Sequence | 🕒 Tương lai — edge: user đổi email bên Supabase trùng email local của user khác → P2002 nổ 500; cần map lỗi thân thiện khi gặp thật |
| U-02 | View Profile<br>`GET /users/me` | 1. User đã đăng nhập gọi `GET /users/me` kèm Bearer token<br>2. Guard verify JWT + nạp user nội bộ theo `supabaseId`<br>3. Nếu chưa sync → 401 `USER_NOT_SYNCED`<br>4. Trả hồ sơ (email, fullName, phone, locale, role) | Customer | User | users | Sequence | ✅ Giữ |
| U-03 | Update Profile<br>`PATCH /users/me` | 1. User nhập `fullName` / `phone` / `locale`<br>2. Gửi `PATCH /users/me`<br>3. Validate dữ liệu bằng DTO<br>4. `email` và `role` là bất biến — bỏ qua nếu client gửi<br>5. Cập nhật bản ghi `users` (chuỗi rỗng → `null` cho `fullName`)<br>6. Trả hồ sơ đã cập nhật | Customer | User | users | Activity | 🕒 Tương lai — lệch nhỏ: `fullName` clear được bằng `''` nhưng `phone` thì không (`@Length(6,20)` chặn `''`); thống nhất cơ chế clear-to-null cho cả hai (đổi DTO + FE) |
| U-04 | Browse Destinations<br>`GET /destinations` | 1. User mở trang điểm đến<br>2. Gửi `GET /destinations` với `page`, `pageSize`, `search`, `sortBy`, `sortOrder`<br>3. Server chỉ lấy destination đang `isActive`<br>4. Tìm kiếm theo tên (en+vi), không phân biệt hoa thường<br>5. Phân trang + sắp xếp<br>6. Trả danh sách + `meta` phân trang | Customer | Destination | destinations | Activity | ✅ Giữ |
| U-05 | View Destination Detail<br>`GET /destinations/:slug` | 1. User chọn một điểm đến<br>2. Gửi `GET /destinations/:slug`<br>3. Server tìm destination `isActive` theo slug<br>4. Nếu không có hoặc đang ẩn → 404 `DESTINATION_NOT_FOUND`<br>5. Trả chi tiết điểm đến | Customer | Destination | destinations | Activity | ✅ Giữ |
| U-06 | Search / Browse Tours<br>`GET /tours` | 1. User mở danh mục tour<br>2. Chọn bộ lọc: `destination`, `category`, `minPrice`/`maxPrice`, `duration`, `featured`, `q` (từ khóa)<br>3. Chọn sắp xếp: `createdAt` / `basePrice` / `durationDays` / `titleEn`<br>4. Gửi `GET /tours`<br>5. Server chỉ trả tour `isPublished = true` (ẩn bản nháp)<br>6. Phân trang<br>7. Trả danh sách tour + `meta` | Customer | Tour, Destination | tours (join destinations) | Activity | ✅ Giữ |
| U-07 | View Tour Detail<br>`GET /tours/:slug` | 1. User chọn một tour<br>2. Gửi `GET /tours/:slug`<br>3. Server tải tour đã publish kèm `destination` + `itinerary` (sắp xếp theo `dayNumber`)<br>4. Nếu slug thiếu hoặc chưa publish → 404 (không lộ bản nháp)<br>5. Trả chi tiết tour + lịch trình | Customer | Tour, Destination, TourItineraryDay | tours, destinations, tour_itinerary_days | Activity | ✅ Giữ |
| U-08 | View Tour Departures<br>`GET /tours/:slug/departures` | 1. User xem các ngày khởi hành của tour<br>2. Gửi `GET /tours/:slug/departures` (mặc định `from = hôm nay`, `status = OPEN`)<br>3. Có thể lọc `from` / `to` / `status`<br>4. Server trả các departure đang mở, kèm ghế còn lại (`seatsTotal - seatsBooked`) | Customer | TourDeparture | tour_departures | Activity | ✅ Giữ |
| U-09 | View Tour Reviews<br>`GET /tours/:slug/reviews` | 1. User xem đánh giá của tour<br>2. Gửi `GET /tours/:slug/reviews?page&limit`<br>3. Server chỉ trả review đã duyệt (`isApproved = true`), mới nhất trước<br>4. Ẩn PII — chỉ lộ `reviewer.fullName`<br>5. Trả danh sách + `meta.averageRating` (trung bình toàn bộ review đã duyệt) | Customer | Review, User | reviews, users | Activity | ✅ Giữ |
| U-10 | Book a Tour<br>`POST /bookings` | 1. User chọn tour + departure, nhập số người lớn/trẻ em + thông tin liên hệ<br>2. Gửi `POST /bookings` kèm Bearer token<br>3. Server kiểm tra tour đã publish + departure thuộc tour và đang `OPEN`<br>4. **Kiểm tra ngày khởi hành: `startDate` đã qua → 400 `DEPARTURE_DEPARTED` (same-day vẫn đặt được)**<br>5. Kiểm tra sơ bộ còn đủ ghế (409 `SEATS_NOT_AVAILABLE` nếu thiếu)<br>6. Tính `totalAmount = (numAdults + numChildren) × (priceOverride ?? basePrice)`<br>7. Tạo booking `PENDING` + sinh mã `BK-XXXXXXXX` (base36 A-Z0-9)<br>8. Tạo Stripe Checkout session (metadata `bookingId`/`bookingCode`)<br>9. **Nếu Stripe lỗi → xóa booking vừa tạo (không để PENDING mồ côi) rồi trả lỗi**<br>10. Lưu `stripeSessionId`<br>11. Trả `{ bookingId, bookingCode, checkoutUrl, status }` | Customer | Booking, Tour, TourDeparture | bookings, tours, tour_departures | Sequence | 🔧 Đã điều chỉnh (2026-06-12) — thêm bước 4 (chặn departure quá khứ) + bước 9 (dọn booking mồ côi khi Stripe lỗi) |
| U-11 | Pay & Confirm Booking<br>`POST /payments/webhook` (Stripe→server) | 1. User thanh toán trên trang Stripe Checkout (`checkoutUrl`)<br>2. Stripe gửi webhook `checkout.session.completed` (có chữ ký) về server<br>3. Server verify chữ ký `Stripe-Signature`; sai → 400 `STRIPE_WEBHOOK_INVALID`<br>4. Idempotent theo `event.id` (UNIQUE trong `payment_events`): **bản ghi event lưu `received_at` lúc nhận và chỉ set `processed_at` khi xử lý XONG; gặp trùng mà `processed_at` còn NULL (lần trước crash giữa chừng) → xử lý lại thay vì bỏ qua**<br>5. Trong transaction + khóa hàng departure: nếu còn ghế → `seatsBooked += N`, booking → `PAID`, lưu `paidAt` + `stripePaymentIntentId`<br>6. Nếu hết ghế (race) → tự hoàn tiền + `CANCELLED`<br>7. Đánh dấu `processed_at` cho event<br>8. Gửi email xác nhận `bookingConfirmation` | System (Stripe) | Booking, TourDeparture, PaymentEvent | bookings, tour_departures, payment_events | Sequence | 🔧 Đã điều chỉnh (2026-06-12) — sửa lỗ hổng idempotency: event crash giữa chừng không còn bị skip vĩnh viễn (booking kẹt PENDING dù đã trả tiền) |
| U-12 | View My Bookings<br>`GET /bookings/me` | 1. User mở "Đơn của tôi"<br>2. Gửi `GET /bookings/me` kèm Bearer token<br>3. Server lọc booking theo `userId`, mới nhất trước (tối đa 50)<br>4. Kèm tiêu đề tour + ngày khởi hành<br>5. Trả danh sách | Customer | Booking, Tour, TourDeparture | bookings | Activity | 🕒 Tương lai — thêm pagination khi làm trang `/account/bookings` (Phase D) |
| U-13 | View Booking Detail<br>`GET /bookings/:code` | 1. User chọn một đơn theo mã<br>2. Gửi `GET /bookings/:code`<br>3. Server chỉ cho chủ đơn hoặc admin xem<br>4. Người không sở hữu nhận 404 `BOOKING_NOT_FOUND` (chống dò mã)<br>5. Trả chi tiết đơn + tour + departure | Customer | Booking, Tour, TourDeparture | bookings | Activity | ✅ Giữ |
| U-14 | Write Review<br>`POST /reviews` | 1. User chọn booking đã hoàn tất để đánh giá<br>2. Nhập `rating` (1–5), `title`, `body`<br>3. Gửi `POST /reviews` kèm `bookingCode`<br>4. Server kiểm tra booking tồn tại + thuộc về user + trạng thái `PAID`<br>5. Mỗi booking chỉ 1 review (`bookingId` UNIQUE)<br>6. Tạo review `isApproved = false` (chờ admin duyệt)<br>7. Trả review vừa tạo | Customer | Review, Booking | reviews, bookings | Activity | ✅ Giữ — đã cân nhắc auto-approve và quyết định GIỮ pre-moderation: verified-purchase chỉ chống fake review, không chống nội dung bẩn/PII trên trang public; volume thấp nên chi phí duyệt gần như 0 |
| U-15 | Add to Wishlist<br>`POST /wishlist/:tourId` | 1. User bấm yêu thích một tour<br>2. Gửi `POST /wishlist/:tourId`<br>3. Server kiểm tra tour tồn tại + đã publish (404 nếu không)<br>4. Upsert `(userId, tourId)` — idempotent<br>5. Trả bản ghi wishlist | Customer | Wishlist, Tour | wishlist | Activity | ✅ Giữ |
| U-16 | Remove from Wishlist<br>`DELETE /wishlist/:tourId` | 1. User bỏ yêu thích một tour<br>2. Gửi `DELETE /wishlist/:tourId`<br>3. Server xoá bản ghi (idempotent — không lỗi nếu không tồn tại)<br>4. Trả 204 No Content | Customer | Wishlist | wishlist | Activity | ✅ Giữ |
| U-17 | View Wishlist<br>`GET /wishlist/me` | 1. User mở danh sách yêu thích<br>2. Gửi `GET /wishlist/me`<br>3. Server trả danh sách mới nhất trước (tối đa 100), kèm preview tour (slug, tiêu đề, ảnh hero, `basePrice`, currency, số ngày) + cờ `isPublished` | Customer | Wishlist, Tour | wishlist, tours | Activity | 🕒 Tương lai — tour bị unpublish sau vẫn nằm trong wishlist (server expose cờ `isPublished` cho FE tự xử); quyết định ẩn/hiện khi làm wishlist FE |

---

## System / Public (không cần đăng nhập)

| Code | Functions | Description | Entity | Models | Database | Diagram | Trạng thái |
| ---- | --------- | ----------- | ------ | ------ | -------- | ------- | ---------- |
| S-01 | Liveness probe<br>`GET /health` | 1. Load balancer / uptime check gọi `GET /health`<br>2. Trả trạng thái `ok` + uptime — **không** chạm DB | System | — | — | — | ✅ Giữ |
| S-02 | Readiness probe<br>`GET /health/ready` | 1. Orchestrator gọi `GET /health/ready`<br>2. Server ping DB<br>3. Trả `checks.database = up/down` | System | — | — | — | ✅ Giữ |

> `POST /payments/webhook` đã liệt kê ở **U-11** vì nó nằm trong luồng thanh toán
> của khách hàng (Stripe gọi server-to-server).

---

## Lịch sử rà soát

- **2026-06-12** — Rà soát toàn bộ U-01→U-17 + S-01/S-02 (đối chiếu docs ↔ code).
  Sửa 3 lỗ hổng: U-10 chặn departure quá khứ (`DEPARTURE_DEPARTED`) + dọn booking
  mồ côi khi Stripe lỗi; U-11 sửa idempotency webhook (`processed_at` nullable —
  event crash giữa chừng được xử lý lại khi Stripe retry). Liên quan: mã booking
  đổi sang base36 thật (`BK-` + A-Z0-9, fix từ đợt schema-hardening cùng ngày).
