# Runbook — Postman với Supabase Auth

> 🇬🇧 English version: [`../../en/runbooks/postman-auth.md`](../../en/runbooks/postman-auth.md).

Cách Postman collection xác thực với API.

## Cấu trúc collection (chỗ cần edit)

`docs/postman/tourism-api.json` là file **GENERATED**. Không edit trực tiếp.

```text
docs/postman/
├── src/
│   ├── collection.base.json        ← info + auth + pre-request collection-level
│   ├── build.mjs                   ← merger (Node script không cần dep)
│   └── folders/
│       ├── 01-health.json
│       ├── 02-auth.json
│       ├── 03-users.json
│       ├── 04-destinations-public.json
│       ├── 05-destinations-admin.json
│       └── 06-tours-admin.json
├── tourism-api.json                ← file được generate; Postman/Newman import file này
└── environments/
    └── local.postman_environment.json
```

Workflow khi thêm/sửa endpoint:

1. Edit (hoặc thêm) file trong `src/folders/`.
2. Nếu thêm folder mới, khai báo trong `collection.base.json` → `folders`.
3. Chạy `pnpm postman:build` → regenerate `tourism-api.json`.
4. Commit cả source change LẪN file generated.

CI chạy `pnpm postman:check` — sẽ fail khi file generated khác với source. Nhờ vậy không thể vô tình hand-edit `tourism-api.json` mà quên cập nhật source.

> **Mẹo — edit trong Postman GUI:** Postman GUI không hiểu cấu trúc split. Nếu thích edit trong GUI thì edit trên `tourism-api.json`, export overwrite file đó, rồi sync ngược diff về `src/folders/*.json`. Đa số case, edit trực tiếp source JSON nhanh hơn.

## Tóm tắt nhanh

Collection có **pre-request script ở cấp collection** tự gọi Supabase `signInWithPassword` và lưu `access_token` vào environment đang active. Mỗi request bảo mật kế thừa Bearer auth ở cấp collection, đọc biến `{{accessToken}}`.

Có 2 slot token theo vai trò + 1 slot generic Bearer dùng:

- `customerAccessToken` / `customerAccessTokenExpiresAt` — refresh từ `userEmail` + `userPassword`
- `adminAccessToken` / `adminAccessTokenExpiresAt` — refresh từ `adminEmail` + `adminPassword`
- `accessToken` — slot generic mà `{{accessToken}}` ở collection-level Bearer auth resolve về. Mỗi lần chạy, script ghi đè bằng token thuộc slot vai trò khớp với path, đồng thời clear ngay đầu script để nếu fetch thất bại thì request gửi Bearer rỗng → backend trả 401 rõ ràng, không silently dùng token cũ.

Script chọn slot admin khi path chứa `/auth/admin/` hoặc bất kỳ segment `/admin/`; ngược lại chọn slot customer. Bạn không cần làm gì thêm — chỉ cần điền credentials.

> **Cần "logout"?** Chạy `Auth → Reset tokens (test helper)` để xóa toàn bộ slot cache. Hữu ích khi cần test xoay vai trò liên tiếp (customer → admin → customer) để đảm bảo mỗi bước thực sự fetch lại token mới.

## Cài đặt một lần

1. Import `docs/postman/tourism-api.json`.
2. Import `docs/postman/environments/local.postman_environment.json`.
3. Sửa environment `local`, điền:
   - `supabaseUrl` (đã có sẵn từ `.env.example`)
   - `supabaseAnonKey` — Supabase Project Settings → API → `anon` `public`
   - `userEmail`, `userPassword` — tài khoản customer test đã confirmed
   - `adminEmail`, `adminPassword` — tài khoản có email nằm trong `ADMIN_EMAILS` của backend
4. Đảm bảo cả 2 tài khoản tồn tại trong Supabase Auth và đã **xác nhận email**. Nếu chưa, tạo qua Supabase Dashboard → Authentication → Users → `Add user` (bật "Auto Confirm User").

## Tạo user thủ công bằng service role key (CLI)

Khi dashboard bất tiện (hoặc cần seed user mới cho integration test):

```js
// Node.js one-off — KHÔNG commit service role key
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

await sb.auth.admin.createUser({
  email: 'customer@example.com',
  password: 'CustomerPass123!',
  email_confirm: true, // bỏ qua bước confirm email
});
```

## Chạy collection

### Trong Postman

Chọn collection → "Run" → chọn environment `local` → "Run Tourism API". Folder `Health`, `Auth`, `Users` sẽ pass khi:

- Backend đang chạy (`pnpm start:dev`)
- Project Supabase có các tài khoản test
- `ADMIN_EMAILS` trong `.env` của backend chứa `adminEmail`

### Headless qua Newman

```bash
pnpm dlx newman@6 run docs/postman/tourism-api.json \
  -e docs/postman/environments/local.postman_environment.json \
  --reporters cli
```

Mong đợi: `assertions: 14 executed, 0 failed` (Sprint B1).

## Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách fix |
| --- | --- | --- |
| Pre-request log `Supabase credentials missing` | `userEmail`/`userPassword` (hoặc admin) trống | Điền environment, chạy lại. |
| `401 UNAUTHORIZED` ở `/auth/sync` | Supabase token chưa được lấy (kiểm tra console của runner) | Mở request → Console → tìm `[pre-request] Supabase auth failed` |
| `401 USER_NOT_SYNCED` ở `/users/me` | Bạn chạy `/users/me` trước `/auth/sync` cho user mới | Chạy `/auth/sync` trước; thứ tự collection đã làm sẵn. |
| `403 NOT_ADMIN` ở `/auth/admin/sync` | Email không nằm trong `ADMIN_EMAILS` ở backend | Thêm email vào `.env` của backend `ADMIN_EMAILS=admin@example.com,...` và restart. |
| Endpoint customer trả role ADMIN | Pre-request dùng lại admin token từ request admin trước đó | Script tự xử lý theo path; nếu bạn ép `useAdminToken=true` ở đâu đó, hãy bỏ. |

## Tại sao dùng pre-request mà không dùng OAuth 2 helper của Postman?

Supabase không expose endpoint OAuth 2 chuẩn mà Postman helper hiểu được. Endpoint signInWithPassword bị scope theo project (cần header `apikey`). Pre-request script 30 dòng xử lý gọn gàng, tránh user phải copy-paste token thủ công.
