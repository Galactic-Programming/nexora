# Runbook — Uploads (Supabase Storage signed URLs)

> 🇬🇧 English version: [`../../en/runbooks/uploads.md`](../../en/runbooks/uploads.md).

Cách admin FE upload ảnh/file lên Supabase Storage mà không proxy bytes qua Nest backend.

## Vì sao dùng signed URL (không multipart upload vào Nest)

Nếu FE POST 5 MB ảnh vào `/admin/tours`, Nest sẽ buffer toàn bộ body trước khi dispatch handler. Block worker trong suốt thời gian upload, throughput bị buộc vào region Railway, và backend bloat thêm `multer`/`busboy`.

Flow signed URL lật ngược:

1. FE xin **backend** 1 signed URL ngắn hạn.
2. FE PUT file **trực tiếp** lên edge Supabase Storage.
3. FE báo backend "đây là path đã upload" qua endpoint resource liên quan (vd: `PATCH /admin/tours/:slug` với `heroImage = "tours/hero/1717..."`).

Nest không chạm vào bytes. Memory phẳng. Scale ngang dễ.

## Setup bucket (1 lần)

1. Supabase Dashboard → Storage → **New bucket**
2. Tên: `tourism-assets` (khớp env `SUPABASE_STORAGE_BUCKET`)
3. **Public bucket: YES** — ảnh tour đã published cần đọc được không cần token. Draft không leak được vì application gate, không phải Storage ACL.
4. File size limit: 10 MB (hero ảnh hiếm khi vượt).
5. Allowed MIME types: `image/jpeg,image/png,image/webp,image/avif,application/pdf` (PDF cho voucher B3).

### Thêm policy qua Supabase Dashboard UI

Policy editor trên dashboard làm cùng việc như raw SQL nhưng tự auto-scope vào bucket, đỡ phải nhớ filter `bucket_id`.

1. Storage → tab **Policies** (đầu section Files).
2. Trong section **Buckets**, search `tourism-assets`. Card có badge `PUBLIC` nếu bucket tạo với toggle public ON.
3. Bấm **New policy** trên card `TOURISM-ASSETS` (KHÔNG bấm card dưới "Schema" — đó là policy table-level cho mọi bucket, quá rộng).
4. Chọn **"For full customization"** (skip template — chúng thêm field không cần).
5. Điền **policy 1 — signed upload writes:**
   - Policy name: `signed upload writes`
   - Allowed operation: **INSERT**
   - Target roles: `authenticated`
   - WITH CHECK expression: `bucket_id = 'tourism-assets'`
   - (Để USING trống — INSERT chỉ dùng WITH CHECK)
6. Save, rồi **New policy** lần nữa cho **policy 2 — public read:**
   - Policy name: `public read`
   - Allowed operation: **SELECT**
   - Target roles: `anon, authenticated` (tương đương `public`)
   - USING expression: `bucket_id = 'tourism-assets'`
7. Card sẽ list 2 policy. Supabase tự append hậu tố random ngắn (vd `signed upload writes 15igvad_0`) — vô hại, backend không quan tâm tên policy.

### RLS policy template (raw SQL — tương đương UI walkthrough ở trên)

Storage RLS cho v1 giữ tối thiểu — gate chính là `@Roles(ADMIN)` server-side; policy Storage là belt-and-braces. Mở tab **Policies** của bucket, thêm:

```sql
-- Cho phép upload qua signed URL. Service role bypass RLS rồi,
-- policy này cho authenticated user dùng signed URL backend cấp.
create policy "signed upload writes" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tourism-assets');

-- Public read tất cả (khớp toggle "public bucket").
create policy "public read" on storage.objects
  for select to public
  using (bucket_id = 'tourism-assets');
```

Sau này khi có folder `vouchers/` chỉ owner booking được đọc, sẽ siết theo folder.

## Flow end-to-end

### 1. FE xin backend signed URL

```http
POST /api/v1/admin/uploads/signed-url
Authorization: Bearer <admin JWT>
Content-Type: application/json

{
  "purpose": "TOUR_HERO",
  "filename": "hoi-an-hero.jpg",
  "contentType": "image/jpeg"
}
```

`purpose` enum:

| Value | Folder trong bucket |
| --- | --- |
| `TOUR_HERO` | `tours/hero/` |
| `TOUR_GALLERY` | `tours/gallery/` |
| `DESTINATION_HERO` | `destinations/hero/` |
| `USER_AVATAR` | `users/avatars/` |

Response (200 OK):

```json
{
  "data": {
    "uploadUrl": "https://PROJECT_REF.supabase.co/storage/v1/object/upload/sign/tourism-assets/tours/hero/1717000000000-hoi-an-hero.jpg?token=...",
    "token": "eyJ...",
    "path": "tours/hero/1717000000000-hoi-an-hero.jpg",
    "bucket": "tourism-assets"
  },
  "error": null
}
```

### 2. FE upload trực tiếp lên Supabase

2 cách, tương đương:

**Supabase JS SDK (khuyến nghị):**

```ts
const { error } = await supabase.storage
  .from(bucket)
  .uploadToSignedUrl(path, token, file, {
    contentType: file.type,
  });
```

**Raw `fetch` PUT (không SDK):**

```ts
const res = await fetch(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
  body: file,
});
```

### 3. FE lưu path vào resource cha

```http
PATCH /api/v1/admin/tours/hoi-an-walking-tour
Authorization: Bearer <admin JWT>

{ "heroImage": "tours/hero/1717000000000-hoi-an-hero.jpg" }
```

Để resolve `heroImage` thành URL render được, FE prepend public bucket URL:

```url
https://PROJECT_REF.supabase.co/storage/v1/object/public/tourism-assets/<path>
```

## Quy tắc derive path

Backend rewrite `filename` từ FE trước khi sign:

- Strip directory prefix (chống `../../../etc/passwd`).
- Lowercase stem.
- Collapse non-`[a-z0-9]` runs thành `-`.
- Prefix `Date.now()` (Unix milliseconds) đảm bảo unique.
- Giữ extension (lowercased).

Vậy `My Hero Shot.JPG` → `tours/hero/1717000000000-my-hero-shot.jpg`.

## Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách fix |
| --- | --- | --- |
| `400 VALIDATION_ERROR` ở `signed-url` | DTO regex reject `purpose`, `filename`, hoặc `contentType` | Đọc message field-level — thường do slash hoặc ký tự lạ trong `filename`. |
| `502 STORAGE_SIGN_FAILED` | Supabase Storage reject yêu cầu sign | Kiểm tra bucket tồn tại, `SUPABASE_SERVICE_ROLE_KEY` đúng, project không bị pause. Backend log error chi tiết. |
| FE PUT trả 403 | Signed URL hết hạn (2h default) HOẶC FE reuse URL từ session cũ | Mint URL mới cho mỗi upload. |
| Ảnh không hiển thị sau upload | Bucket chưa public HOẶC path chưa lưu vào parent row | Verify bucket public; check cột `Tour.heroImage`. |

## Test

- **Newman/Postman**: folder `Uploads (Admin)` mint 2 URL (tour hero + destination hero). Status assertion accept cả `200` (sign OK) lẫn `502` (bucket thiếu trong test project) — cả 2 đều valid trong CI vì CI không có bucket thật.
- **Local**: chạy `pnpm start:dev`, hit `POST /admin/uploads/signed-url` từ Postman GUI, rồi `curl --upload-file ./test.jpg "$uploadUrl"` để verify URL hoạt động end-to-end.
