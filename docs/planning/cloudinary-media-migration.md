# Plan note — Media storage migration: Supabase Storage → Cloudinary

> **Loại tài liệu:** Note kế hoạch tạm thời (working note), tạo trước khi code.
> **Trạng thái:** 📝 PLANNED — chưa bắt đầu implement.
> **Ngày tạo:** 2026-06-03.
> **Vòng đời:** Tài liệu này sống độc lập trong suốt đợt triển khai. Sau khi
> code xong + test ổn, các phần còn giá trị sẽ được **gộp vào docs cũ** (xem
> [§ Dọn dẹp tài liệu](#dọn-dẹp-tài-liệu-sau-khi-ship)) rồi **xóa note này**.
> Trong thời gian đó **KHÔNG sửa** `docs/runbooks/uploads.md`, `docs/reference/*`
> hay schema docs cũ — mọi thay đổi kế hoạch ghi tại đây.

## Mục tiêu

Tách rõ trách nhiệm lưu trữ:

- **Supabase** → chỉ giữ **data** (Postgres) + **Auth** (JWT/JWKS). Không còn
  giữ file media.
- **Cloudinary** → lưu **photos + clips (video)**. Lý do chọn: dung lượng/quota
  thoải mái hơn, có transcoding + adaptive delivery cho video (thứ Supabase
  Storage không có).

## Quyết định đã chốt (2026-06-03)

| # | Chủ đề | Quyết định | Hệ quả |
| --- | --- | --- | --- |
| 1 | Cơ chế upload | **Signed upload** — backend ký signature, FE PUT thẳng lên Cloudinary | Giữ nguyên triết lý "backend không chạm bytes" của luồng signed-URL hiện tại |
| 2 | Schema media | **Bảng `MediaAsset` riêng** (polymorphic) | Hỗ trợ video first-class; thay cho `Tour.gallery String[]` + các cột `heroImage` |
| 3 | Phạm vi video | **Làm video/clip ngay đợt này** | Thêm `UploadPurpose` video + validation theo loại + poster/duration |
| 4 | Migrate dữ liệu cũ | **Không migrate** (media hiện tại chủ yếu là seed/placeholder) | Chỉ re-seed trỏ Cloudinary; ảnh cũ trên Supabase Storage bị bỏ rơi (orphan) |
| 5 | Persist `MediaAsset` | **Phương án lai**: KHÔNG có endpoint `confirm` riêng; FE gửi media payload kèm trong `PATCH`/`POST` resource; logic Cloudinary gom vào **`MediaService` dùng chung** | Atomic (1 transaction, không mồ côi), giải được `ownerId` khi tạo mới, tránh lặp code giữa tours/destinations/users |

## Nguyên tắc giữ lại từ kiến trúc hiện tại

- Backend **không stream bytes** của file → signed upload.
- Gate **`@Roles(ADMIN)`** ở controller giữ nguyên.
- Backend **không hardcode delivery URL** — lưu `publicId`, build URL +
  transformation ở tầng đọc (giống cách FE đang prepend public bucket URL).

---

## Lộ trình triển khai (5 phase, mỗi phase ~1 PR nhỏ)

### Phase 0 — Nền tảng Cloudinary (config + SDK)

1. Thêm dependency `cloudinary` (Node SDK v2) vào `apps/api`.
2. Env mới trong `apps/api/src/config/env.validation.ts` (nhóm `── Cloudinary ──`):
   - `CLOUDINARY_CLOUD_NAME` (required)
   - `CLOUDINARY_API_KEY` (required)
   - `CLOUDINARY_API_SECRET` (required, **server-side only**)
   - `CLOUDINARY_UPLOAD_FOLDER` (default `tourism`)
3. Config namespace mới `cloudinary.config.ts` (song song `supabase.config.ts`),
   pattern `registerAs('cloudinary', …)`.
4. Cập nhật `apps/api/.env` + `.env.example`; đăng ký config trong `app.module.ts`.

> **Lưu ý:** `supabase.config.ts` vẫn giữ `url/anonKey/serviceRoleKey/jwks` cho
> **Auth** (KHÔNG bỏ). Chỉ `storageBucket` thành legacy → xóa ở Phase 4.

### Phase 1 — Schema: bảng `MediaAsset`

`apps/api/prisma/schema.prisma`:

```prisma
enum MediaType { IMAGE  VIDEO }
enum MediaOwnerType { TOUR  DESTINATION  USER }

model MediaAsset {
  id           String         @id @default(uuid()) @db.Uuid
  publicId     String         @map("public_id")        // Cloudinary public_id
  type         MediaType
  ownerType    MediaOwnerType @map("owner_type")
  ownerId      String         @map("owner_id") @db.Uuid
  role         String         // 'hero' | 'gallery' | 'avatar'
  format       String?        // jpg, webp, mp4...
  width        Int?
  height       Int?
  durationSec  Float?         @map("duration_sec")     // video only
  posterId     String?        @map("poster_id")        // video thumbnail public_id
  bytes        Int?
  sortOrder    Int            @default(0) @map("sort_order")
  createdAt    DateTime       @default(now()) @map("created_at")

  @@index([ownerType, ownerId, role])
  @@map("media_assets")
}
```

**Chiến lược không phá vỡ code đang chạy:** giữ tạm `Tour.heroImage`,
`Tour.gallery`, `Destination.heroImage` ở phase này; chỉ DROP ở Phase 4 sau khi
service đã đọc từ `MediaAsset`.

Migration: `pnpm --filter @tourism/api prisma migrate dev --name add_media_assets`.

### Phase 2 — Module `uploads` viết lại cho Cloudinary signed upload

`apps/api/src/modules/uploads/`:

1. Bỏ `@supabase/supabase-js` trong `uploads.service.ts`, thay bằng Cloudinary SDK
   (cấu hình từ `cloudinary.config`).
2. `createSignedUploadSignature(dto)` thay cho `createSignedUploadUrl`:
   - `paramsToSign = { timestamp, folder, public_id?, resource_type }`
   - `cloudinary.utils.api_sign_request(params, apiSecret)`
   - Trả về: `{ signature, timestamp, apiKey, cloudName, folder, publicId, resourceType, uploadUrl }`
3. `UploadPurpose` mở rộng trong `dto/create-signed-upload-url.dto.ts`:
   `TOUR_HERO`, `TOUR_GALLERY`, **`TOUR_VIDEO`**, `DESTINATION_HERO`,
   **`DESTINATION_VIDEO`**, `USER_AVATAR`.
4. `resourceTypeForPurpose()` → map purpose ⇒ `image` | `video`.
5. `folderForPurpose()` đổi sang Cloudinary folder (`tourism/tours/hero`…).
6. **Validation theo loại** (vá điểm yếu hiện tại — MIME chỉ chặn ở bucket):
   `maxBytes` + allowed formats riêng cho image vs video, ngay trong DTO/service.
7. **KHÔNG có endpoint `confirm` riêng.** Module `uploads` thu hẹp đúng 1 việc:
   cấp quyền upload (ký signature). Việc tạo `MediaAsset` xảy ra khi FE gửi media
   payload kèm trong `PATCH`/`POST` resource (xem Phase 3) — chốt theo phương án
   lai (quyết định #5).
8. Cập nhật `admin-uploads.controller.ts` + `uploads.service.spec.ts`
   (mock `api_sign_request`).

### Phase 3 — `MediaService` dùng chung + Tours / Destinations đọc-ghi qua `MediaAsset`

**`MediaService` (mới)** — nơi DUY NHẤT hiểu về Cloudinary + `MediaAsset`:

- `syncAssets(ownerType, ownerId, payload[], tx)`: tạo/cập nhật/xóa `MediaAsset`
  của owner trong **cùng transaction Prisma** mà service gọi truyền vào (`tx`).
  → atomic với update resource, không mồ côi.
- `tours.service`/`destinations.service`/`users` gọi `MediaService` bên trong
  `prisma.$transaction(...)` của chính nó → không lặp logic, không coupling
  trực tiếp với Cloudinary.

**Ghi (write):**

- DTO resource (`create-tour.dto.ts`, `update-tour.dto.ts`, destinations tương tự)
  thêm field `media?: MediaInputDto[]` với shape **thuần dữ liệu**
  `{ publicId, type, role, width?, height?, durationSec?, posterId?, sortOrder? }`
  — KHÔNG chứa signature/secret.
- `tours.service.update/create`: mở `$transaction`, update tour + gọi
  `MediaService.syncAssets(...)` trong cùng `tx`.

**Đọc (read):**

- `tours.service`/`destinations.service`: include `MediaAsset`, map ra DTO.
- DTO trả về (`tour.dto.ts`, `destination.dto.ts`): shape media chuẩn
  `{ url, type, posterUrl?, width?, height? }`, build từ `publicId`.
- Helper `lib/cloudinary-url.ts`: ráp
  `https://res.cloudinary.com/<cloud>/<resource>/upload/<transform>/<publicId>`.
  - Image: `f_auto,q_auto`.
  - Video: poster `so_0` + streaming profile.

- Cập nhật `*.service.spec.ts` + thêm `media.service.spec.ts`.

### Phase 4 — Dọn dẹp Supabase Storage

1. Migration DROP `Tour.heroImage`, `Tour.gallery`, `Destination.heroImage`.
2. Bỏ env `SUPABASE_STORAGE_BUCKET` + comment liên quan.
3. Cập nhật `prisma/seed.ts` → tạo `MediaAsset` trỏ Cloudinary publicId
   (cần upload seed assets lên Cloudinary 1 lần, hoặc dùng publicId demo).
4. Cập nhật Postman/Newman collection folder `Uploads (Admin)`.

---

## Test & verify

- Unit: `uploads.service` — signature đúng; validation image vs video;
  purpose→resource_type.
- Unit: `media.service` — `syncAssets` tạo/cập nhật/xóa đúng; chạy trong `tx`
  truyền vào; dọn asset mồ côi khi role/owner thay đổi.
- Unit: helper `buildCloudinaryUrl` — image transform; video poster.
- Integration: tours/destinations ghi media atomic (update fail → rollback cả
  `MediaAsset`); đọc trả media DTO đúng từ `MediaAsset`.
- Newman: cập nhật assertion cho endpoint signature mới.
- Mục tiêu coverage ≥ 80% (theo rule TDD của repo).

## Rủi ro cần theo dõi

1. **`MediaAsset` polymorphic** không có FK cứng tới Tour/Destination → cleanup
   orphan media tập trung trong `MediaService` (xóa owner ⇒ xóa asset trong cùng
   `tx`); không rải rác ở từng service.
2. **Quota Cloudinary**: video trên free plan giới hạn dung lượng/transform/
   bandwidth — xác nhận plan trước khi đẩy clip nặng.
3. **Không migrate** → ảnh cũ trên Supabase Storage thành orphan; môi trường nào
   có ảnh thật sẽ mất link sau Phase 4.

---

## Dọn dẹp tài liệu (sau khi ship)

Khi code xong + test xanh, gộp nội dung còn giá trị vào docs cũ rồi **xóa file này**:

| Nội dung trong note | Gộp vào |
| --- | --- |
| Luồng signed upload Cloudinary + env + bucket/folder | `docs/runbooks/uploads.md` (viết lại) |
| Bảng `MediaAsset`, enums | `docs/reference/erd.md` |
| Endpoint `signed-url` mới + field `media[]` trong PATCH/POST resource | `docs/reference/api-overview.md`, `functions-admin.md` |
| Mục sprint/changelog | `docs/planning/roadmap.md` hoặc `sprints/` |

Checklist khi gộp:

- [ ] Code đã merge và test xanh
- [ ] `docs/runbooks/uploads.md` viết lại theo Cloudinary
- [ ] ERD + api-overview cập nhật
- [ ] Postman collection cập nhật
- [ ] Xóa `docs/planning/cloudinary-media-migration.md` (file này)
