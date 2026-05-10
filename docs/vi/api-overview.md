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

Public list/detail (`GET /tours`, `GET /tours/:slug`) sẽ có ở Sprint B2.3; itinerary nested CRUD ở B2.4; departures + uploads ở B2.5–B2.6.

### Sprint kế tiếp (kế hoạch)

- B2.3: public `/tours` list + detail (filter, sort, phân trang)
- B2.4: `/admin/tours/:slug/itinerary` (TourItineraryDay nested CRUD)
- B2.5–B2.6: `/admin/tours/:slug/departures`, `/admin/uploads/signed-url`
- B3: `/bookings`, `/payments/webhook`, `/admin/bookings/:id/refund`
- B4: `/reviews`, `/wishlist`, `/admin/stats`

Xem [`roadmap.md`](../roadmap.md) để biết tracker chi tiết theo từng sub-feature.
