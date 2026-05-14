# Runbook — Database seed

> 🇬🇧 English version: [`../en/seed.md`](../en/seed.md).

Populate Supabase Postgres với catalog thực tế (4 destination, 10 tour, 30 departure, 2 itinerary day) cho local dev, Postman runs, và demo screenshot.

## Cách chạy

```bash
pnpm db:seed
```

Đây là alias cho `pnpm prisma db seed`. Prisma 7 đọc từ `prisma.config.ts` (field `migrations.seed`). Dùng `ts-node --transpile-only` nên không cần compile trước.

Output mong đợi:

```text
[seed] connecting to DB...
[seed] upserting 4 destinations...
[seed] upserting 10 tours...
[seed] resetting departures for 10 tours, inserting 30 new rows...
[seed] done.
```

Target DB ở `DIRECT_URL` (Supabase direct, port 5432). Fallback sang `DATABASE_URL` (Supavisor pooler) nếu `DIRECT_URL` không có.

## Tạo những gì

| Entity | Số lượng | Ghi chú |
| --- | --- | --- |
| Destination | 4 | Hội An, Hà Nội, Sa Pa, Phú Quốc (tất cả `isActive=true`) |
| Tour | 9 published + 1 draft (`hoi-an-cooking-class`, `isPublished=false`) | Có 1 draft để smoke-test filter public-catalog |
| TourItineraryDay | 2 | Day 1 + Day 2 của `sa-pa-trek-2d1n` để test nested CRUD |
| TourDeparture | 30 | 3/tour ở +30d / +75d / +150d tính từ hôm nay; `seatsTotal = ceil(maxGroupSize * 0.6)` để chừa chỗ cho booking Postman (B3) |

Slug của tour draft: `hoi-an-cooking-class`. KHÔNG được xuất hiện ở `GET /tours` và PHẢI xuất hiện ở `GET /admin/tours/hoi-an-cooking-class`. Dùng làm regression check sau mỗi lần đụng vào public/admin split.

## Idempotency

Re-run seed an toàn và có chủ ý:

- **Destinations + Tours** — `upsert` theo `slug`. ID được giữ nguyên giữa các lần chạy, nên biến môi trường Postman như `tourSlug` vẫn dùng được không cần refresh.
- **Itinerary days** — `upsert` theo `(tourId, dayNumber)`.
- **Departures** — không có unique key tự nhiên (nhiều departure có thể cùng `startDate`), nên seed `deleteMany` mọi departure thuộc tour seeded, rồi `createMany` 30 row mới. Date luôn re-anchor "hôm nay", catalog không bị stale.

Reset departure dùng Booking FK (`Restrict`). Nếu tour seeded đã có booking thật, delete sẽ fail loud — đây là chủ ý: seed không được silent vứt data khách hàng thật. Move booking sang tour khác trước, hoặc đổi tour slug trong `prisma/seed.ts`.

## Reset toàn bộ (DESTRUCTIVE)

Khi DB local drift và muốn clean slate:

```bash
pnpm prisma migrate reset
```

Drop tất cả table, replay migration, chạy seed ở cuối. **Không bao giờ** chạy command này với DB bạn quan tâm — đây là escape hatch dev-only.

## Khi nào cần re-seed

- Sau `prisma migrate reset` (tự động ở cuối).
- Sau khi pull branch đổi seed data (chạy `pnpm db:seed` thủ công).
- Trước demo Postman / screencast — refresh departure date tương lai để catalog trông "live".

## Verify trong Supabase Studio

1. Mở Supabase Dashboard → Table editor.
2. `destinations` → 4 row, slug `hoi-an`, `ha-noi`, `sa-pa`, `phu-quoc`.
3. `tours` → 10 row. Filter `is_published = false` → đúng 1 row (`hoi-an-cooking-class`).
4. `tour_departures` → 30 row. Sort `start_date` asc → date sớm nhất ~ hôm nay + 30 ngày.
5. `tour_itinerary_days` → 2 row, cả 2 `tour_id` trỏ về tour Sa Pa trek.

Hoặc qua Postman: `Tours (Public) → GET /tours` trả 9 row (draft bị ẩn), `Tours (Public) — Departures → GET /tours/sa-pa-trek-2d1n/departures` trả 3 departure OPEN sắp tới.

## Tuỳ biến seed

Edit trực tiếp `prisma/seed.ts`. Data nằm ở 2 mảng đầu file (`DESTINATIONS`, `TOURS`) — đổi field nào, re-run `pnpm db:seed`, upsert path giữ ID stable.

Tránh đổi slug trừ khi tự clean row cũ — seed chỉ upsert slug nó biết, đổi tên sẽ để lại row mồ côi.
