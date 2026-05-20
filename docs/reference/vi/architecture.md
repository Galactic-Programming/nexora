# Kiến trúc — tourism-be-api

> 🇬🇧 English version: [`../en/architecture.md`](../en/architecture.md).

## Tổng quan

```flow
                      ┌────────────────┐
   FE customer ─┐     │                │
                ├──►  │  NestJS API    │ ──► Prisma ──► Supabase Postgres
   FE admin   ──┘     │  (Express)     │ ──► @supabase/supabase-js (Storage signed URLs)
                      │                │ ──► Stripe SDK
                      └────────┬───────┘ ──► Resend (email)
                               │
                               ▼
                      Supabase JWKS (xác thực JWT)
```

- 3 repo riêng biệt: `tourism-be-api` (repo này), `tourism-frontend-customer`, `tourism-frontend-admin`.
- Backend là một service NestJS 11 duy nhất. Không dùng microservices cho phạm vi đồ án.
- Supabase Auth xử lý đăng nhập ở frontend; API này chỉ verify JWT và đồng bộ user vào bảng `users` cục bộ.

## Sơ đồ module

```structure
src/
├── main.ts                 Bootstrap (helmet, CORS, ValidationPipe, Swagger,
│                           raw body cho /payments/webhook)
├── app.module.ts           Kết nối Config, Logger, Throttler, Prisma, các
│                           filter/interceptor/guard global, các module
├── config/                 ConfigModule + Joi schema; cấu hình theo namespace
│                           (app, supabase, stripe, email, throttler)
├── prisma/                 PrismaService extends PrismaClient với PrismaPg
│                           adapter (Prisma 7 bắt buộc dùng driver adapter)
├── common/
│   ├── types/              ApiResponse envelope, AuthenticatedRequest
│   ├── dto/                ApiErrorDto, ApiMetaDto — class Swagger-renderable
│   │                       tương ứng với type envelope (B4.7)
│   ├── decorators/         @Public, @Roles, @CurrentUser, @SupabaseIdentity
│   ├── guards/             SupabaseJwtGuard (JWKS + fallback HS256),
│   │                       RolesGuard
│   ├── filters/            HttpExceptionFilter — định dạng lỗi đồng nhất
│   └── interceptors/       TransformInterceptor — bọc response trong
│                           {data, error, meta}
└── modules/                auth, users, destinations, tours, departures,
                            bookings, payments, reviews, wishlist, uploads,
                            admin-stats, email, health
```

Mỗi module có folder `dto/` chứa cả request DTO (vd `CreateTourDto`) và
response DTO (vd `TourDto`, `TourWithStatsDto`, `TourDetailDto`) để Swagger
render cho `openapi-typescript-codegen` consume. Xem
[roadmap.md](../../planning/roadmap.md) Sprint B4.7 để biết lý do thêm
response DTO coverage.

## Vòng đời request

1. **Throttler guard** — giới hạn tần suất global (mặc định 100 req / 60s).
2. **SupabaseJwtGuard** — xác thực `Authorization: Bearer <jwt>` qua Supabase
   JWKS. Route gắn `@Public()` sẽ bỏ qua. Sau khi verify, gán
   `req.supabaseUser` (danh tính từ JWT) và `req.currentUser` (record `User`
   trong DB cục bộ, có thể null cho lần gọi `/auth/sync` đầu tiên).
3. **RolesGuard** — kiểm tra `@Roles(UserRole.ADMIN)` v.v. dựa trên
   `req.currentUser.role`.
4. **ValidationPipe** — class-validator + class-transformer; whitelist +
   forbid non-whitelisted; ép kiểu ngầm.
5. **Controller** → service → Prisma.
6. **TransformInterceptor** — bọc giá trị trả về trong `{data, error: null}`.
7. **HttpExceptionFilter** — bắt mọi exception, trả về
   `{data: null, error: {code, message, details?}}` với HTTP status phù hợp.

## Định dạng response

Mọi response đều dùng:

```json
{
  "data": <payload> | null,
  "error": null | { "code": "STRING_CODE", "message": "...", "details": ... },
  "meta": { "page": 1, "pageSize": 20, "total": 42, "totalPages": 3 }
}
```

Phân trang: controller trả về `{ items, meta }`; interceptor sẽ chuyển
`items` thành `data` và `meta` lên cấp envelope.

## Xác thực

- Frontend gọi `supabase.auth.signInWithPassword()` / OAuth → nhận `access_token`.
- Mọi request bảo mật gắn header `Authorization: Bearer <access_token>`.
- `SupabaseJwtGuard` dùng [`jose`](https://github.com/panva/jose) — đây là library Supabase khuyến nghị trong docs verify JWT:
  - Đọc `alg` từ JWT protected header.
  - Với `ES256` / `RS256` / `EdDSA` (cơ chế signing keys bất đối xứng — mặc định cho project Supabase tạo mới từ 2025): verify qua `createRemoteJWKSet(SUPABASE_JWKS_URL)` với cache 10 phút (khớp với Supabase Edge cache TTL).
  - Với `HS256` (chỉ dành cho project legacy): verify bằng `SUPABASE_JWT_SECRET`. Nếu secret không được cấu hình, guard sẽ reject token HS256 với thông báo rõ ràng.
- Sau khi verify, load record user cục bộ theo `supabaseId` và gán vào request.

## Cơ sở dữ liệu

- Provider: PostgreSQL (Supabase quản lý).
- ORM: Prisma 7 với driver adapter **PrismaPg** (Prisma 7 bắt buộc — `url`/`directUrl` ở schema-level đã bị bỏ).
- Chiến lược kết nối qua Supabase **Supavisor** (hoạt động cho client IPv4 trên free tier):
  - `DATABASE_URL` → **Transaction pooler** (port 6543, `aws-N-<region>.pooler.supabase.com`). Thêm `?pgbouncer=true&connection_limit=1`. Dùng bởi `PrismaClient` ở runtime. Prepared statements tự động bị tắt.
  - `DIRECT_URL` → **Session pooler** (port 5432, cùng hostname). Dùng bởi `prisma migrate` (khai báo trong `prisma.config.ts`). Hỗ trợ prepared statements + long transactions mà migration cần.
  - Ta KHÔNG dùng "Direct Connection" thật (`db.<ref>.supabase.co:5432`) vì nó yêu cầu IPv6 hoặc IPv4 add-on (trả phí).
- Schema: xem [`erd.md`](../en/erd.md) và [`prisma/schema.prisma`](../../../prisma/schema.prisma).

## Cấu hình

- `@nestjs/config` với Joi validation (`src/config/env.validation.ts`).
- Process **không khởi động** nếu thiếu/sai bất kỳ biến required nào.
- Namespace qua `registerAs`:
  - `app.*`   — port, prefix, log level, CORS origins, frontendUrl
  - `supabase.*` — URL, keys, JWKS, danh sách email admin
  - `stripe.*` — secret key, webhook secret, currency mặc định
  - `email.*` — Resend API key, địa chỉ from
  - `throttler.*` — TTL, limit

## Logging

- `nestjs-pino` với `pino-pretty` ở dev; JSON ở production.
- Header xác thực được che (redacted).
- Tự động log request/response kèm thời gian.

## Stripe webhook

- Path: `POST /api/v1/payments/webhook` (Sprint B3).
- Cần raw body để verify signature — được wire trong `main.ts` **trước** JSON parser global qua `express.raw()`.
- Idempotency: bảng `payment_events` với UNIQUE `stripe_event_id`. Replay sẽ trả 200 mà không xử lý lại.

## Lưu ý

- Cảnh báo path-to-regexp khi boot (`Unsupported route path: "/api/v1/*"`) là vô hại. NestJS tự động convert syntax legacy.
- Prisma 7 đã loại bỏ `datasources` và `directUrl` khỏi schema; ta dùng `prisma.config.ts` thay thế.
