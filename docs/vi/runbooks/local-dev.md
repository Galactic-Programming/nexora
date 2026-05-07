# Runbook — Phát triển local

> 🇬🇧 English version: [`../../en/runbooks/local-dev.md`](../../en/runbooks/local-dev.md).

## Yêu cầu

- Node.js ≥ 22 (TypeScript build target ES2023)
- pnpm ≥ 10
- Một Supabase project (free tier đủ dùng)
- Một Stripe test account

## 1. Clone & cài đặt

```bash
git clone <repo-url> tourism-be-api
cd tourism-be-api
pnpm install
```

## 2. Biến môi trường

```bash
cp .env.example .env
```

Điền các giá trị placeholder trong `.env`. Hai biến quan trọng nhất hiện tại:

| Biến | Lấy ở đâu |
| --- | --- |
| `DATABASE_URL` | Supabase Dashboard → Connect → **Transaction pooler** (port **6543**, host `aws-N-<region>.pooler.supabase.com`). Thêm `?pgbouncer=true&connection_limit=1`. Prisma dùng ở runtime. |
| `DIRECT_URL` | Cùng trang Connect → **Session pooler** (port **5432**, cùng hostname). Dùng cho `prisma migrate`. **KHÔNG** thêm `pgbouncer=true` ở đây. |
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Project Settings → API → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` (giữ kín) |
| `SUPABASE_JWKS_URL` | `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` |
| `SUPABASE_JWT_SECRET` | **Tùy chọn.** Chỉ điền cho project legacy còn dùng HS256. Project mới (asymmetric ES256/RS256/EdDSA — mặc định từ 2025) không cần. Cách check: mở `SUPABASE_JWKS_URL` trên trình duyệt; thấy `"alg":"ES256"` (hoặc RS256/EdDSA) → để trống. |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → Secret key (test mode) |
| `STRIPE_WEBHOOK_SECRET` | Có sau khi chạy `stripe listen` (xem runbook Sprint B3) |
| `RESEND_API_KEY` | Resend Dashboard → API Keys |

App sẽ từ chối khởi động nếu thiếu bất kỳ biến required nào — Joi sẽ in ra danh sách tất cả vi phạm.

### Tại sao dùng pooler thay vì "Direct connection"?

Supabase cung cấp 3 đường connect. Ta chọn pooler cho cả 2 URL:

| Đường | Port | Hostname | Lý do (không) dùng |
| --- | --- | --- | --- |
| Direct connection | 5432 | `db.<ref>.supabase.co` | **Bỏ qua** — IPv6 only trên free tier. |
| Session pooler | 5432 | `aws-N-<region>.pooler.supabase.com` | ✅ `DIRECT_URL` cho migrations (hỗ trợ prepared statements + long transactions). |
| Transaction pooler | 6543 | `aws-N-<region>.pooler.supabase.com` | ✅ `DATABASE_URL` cho query runtime (thân thiện serverless, không prepared statements). |

Setup này hoạt động được mà không cần mua IPv4 add-on.

## 3. Migrate database

```bash
pnpm exec prisma migrate dev --name init
pnpm exec prisma generate
```

`prisma.config.ts` tự động đọc `DIRECT_URL` cho migrations. `PrismaClient` runtime dùng `DATABASE_URL` qua adapter `PrismaPg`.

## 4. Chạy dev server

```bash
pnpm start:dev
```

Bạn sẽ thấy:

```terminal
🚀 Tourism API listening on http://localhost:3000/api/v1
📚 Swagger UI: http://localhost:3000/api/docs
```

## 5. Smoke test

```bash
curl http://localhost:3000/api/v1/health
# {"data":{"status":"ok","uptime":...,"timestamp":"..."},"error":null}

curl http://localhost:3000/api/v1/health/ready
# {"data":{"status":"ok","checks":{"database":"up"},"timestamp":"..."},"error":null}
```

Mở <http://localhost:3000/api/docs> để xem Swagger UI.

## 6. Postman

Import:

1. `docs/postman/tourism-api.json` (collection)
2. `docs/postman/environments/local.postman_environment.json` (environment)

Chọn environment `tourism-api · local` trong Postman, sau đó chạy folder **Health**. Tất cả request đều phải pass.

> **Quy tắc workflow:** mỗi khi thêm endpoint mới, BẮT BUỘC cập nhật file Postman collection JSON trong repo và commit cùng code.

## 7. Script hữu ích

```bash
pnpm lint           # eslint --fix
pnpm format         # prettier --write
pnpm build          # nest build (type-check + transpile)
pnpm test           # jest
pnpm test:cov       # jest + coverage
pnpm exec prisma studio   # GUI duyệt DB
pnpm exec prisma validate # validate schema.prisma
```

## Khắc phục sự cố

| Triệu chứng | Cách fix |
| --- | --- |
| `Config validation error: "X" is required` | Thiếu env var. Copy từ `.env.example`, điền, restart. |
| `PrismaClientInitializationError ... requires either "adapter" or "accelerateUrl"` | Prisma 7 bắt buộc driver adapter. Repo đã wire sẵn `PrismaPg`; chạy `pnpm install` nếu vừa xóa `node_modules`. |
| Cảnh báo `Unsupported route path: "/api/v1/*"` lúc boot | **Vô hại.** NestJS 11 set global prefix, nội bộ đăng ký catch-all `/api/v1/*`. path-to-regexp v8 đã bỏ syntax `*`; `LegacyRouteConverter` của Nest tự rewrite thành `/api/v1/{*path}` lúc startup. App vẫn serve đúng mọi route. Chờ Nest dọn upstream. |
| `Warning: --localstorage-file was provided without a valid path` (jest) | **Vô hại.** Known issue Node.js 25 + jest — flag rỗng bị forward sang worker process. Không ảnh hưởng kết quả test. Bỏ qua hoặc downgrade về Node 22 LTS. |
| `Synced customer undefined (supabaseId=undefined)` trong output `jest` | Không nên xuất hiện nữa — `auth.service.spec.ts` đã silence `Logger.prototype.log` ở `beforeAll`. Nếu vẫn thấy, có thể bạn đã revert mock đó. |
| `prisma migrate dev` báo "Can't reach database" | Đảm bảo `DIRECT_URL` (port 5432) được set, không chỉ pooler. Pooler không hỗ trợ session-mode statements mà migration cần. |
| Stripe webhook trả 400 "Invalid signature" | Middleware raw body phải đăng ký **trước** JSON parser global. Code đã wire sẵn trong `main.ts`. Kiểm tra path khớp với `STRIPE_WEBHOOK_SECRET`. |
