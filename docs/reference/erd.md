<!-- markdownlint-disable MD013 -->
<!-- MD013 (line length): reference tables and technical one-liners (URLs, SQL,
     roadmap rows) cannot wrap without breaking GFM rendering. -->

# Tourism API — Entity Relationship Diagram

> Source of truth: [`prisma/schema.prisma`](../../apps/api/prisma/schema.prisma).
> Render with [dbdiagram.io](https://dbdiagram.io) or VS Code Mermaid preview.

## Mermaid ER

```mermaid
erDiagram
    User ||--o{ Booking : places
    User ||--o{ Review : writes
    User ||--o{ Wishlist : keeps
    Destination ||--o{ Tour : contains
    Tour ||--o{ TourItineraryDay : has
    Tour ||--o{ TourDeparture : schedules
    Tour ||--o{ Booking : booked_via
    Tour ||--o{ Review : receives
    Tour ||--o{ Wishlist : favourited_in
    TourDeparture ||--o{ Booking : on_date
    Booking ||--|| Review : verified_by

    User {
        uuid id PK
        uuid supabase_id UK
        string email UK
        string full_name
        string phone
        enum locale "en|vi"
        enum role "CUSTOMER|ADMIN"
        timestamp created_at
        timestamp updated_at
    }

    Destination {
        uuid id PK
        string slug UK
        string name_en
        string name_vi
        string country
        string region
        text description_en
        text description_vi
        bool is_active
    }

    Tour {
        uuid id PK
        string slug UK
        string title_en
        string title_vi
        text summary_en
        text summary_vi
        uuid destination_id FK
        int duration_days
        int max_group_size
        decimal base_price
        string currency
        enum category "DAY|PACKAGE|CUSTOM|HONEYMOON|MUSICAL"
        string difficulty
        bool is_published
        bool is_featured
        jsonb included
        jsonb excluded
        string meeting_point
    }

    TourItineraryDay {
        uuid id PK
        uuid tour_id FK
        int day_number
        string title_en
        string title_vi
        text description_en
        text description_vi
    }

    TourDeparture {
        uuid id PK
        uuid tour_id FK
        date start_date
        date end_date
        decimal price_override
        int seats_total
        int seats_booked
        enum status "OPEN|CLOSED|CANCELLED"
    }

    Booking {
        uuid id PK
        string code UK
        uuid user_id FK
        uuid tour_id FK
        uuid departure_id FK
        int num_adults
        int num_children
        decimal total_amount
        string currency
        enum status "PENDING|PAID|CANCELLED|REFUNDED"
        string contact_name
        string contact_email
        string contact_phone
        text special_requests
        string stripe_session_id UK
        string stripe_payment_intent_id
        string refund_reason "audit; VarChar(500)"
        uuid refunded_by "users.id snapshot; no FK"
        timestamp paid_at
        timestamp cancelled_at
    }

    Review {
        uuid id PK
        uuid tour_id FK
        uuid user_id FK
        uuid booking_id FK,UK
        int rating
        string title
        text body
        bool is_approved
    }

    Wishlist {
        uuid user_id PK,FK
        uuid tour_id PK,FK
        timestamp created_at
    }

    PaymentEvent {
        uuid id PK
        string stripe_event_id UK
        string type
        jsonb payload
        timestamp received_at "insert time"
        timestamp processed_at "NULLABLE — set only when handler finished; NULL duplicate is re-processed"
    }

    MediaAsset {
        uuid id PK
        string public_id "Cloudinary public_id"
        enum type "IMAGE|VIDEO"
        enum owner_type "TOUR|DESTINATION|USER"
        uuid owner_id "polymorphic — no hard FK"
        enum role "MediaRole: hero|gallery|avatar"
        string format
        int width
        int height
        float duration_sec
        string poster_id
        int bytes
        int sort_order
    }
```

> **`MediaAsset` is polymorphic** (`owner_type` + `owner_id`) and has **no
> DB-level FK** to its owner — it is therefore not drawn with a relation edge
> above. Referential integrity + orphan cleanup are enforced in `MediaService`
> inside the same transaction that mutates the owner. Photos/clips live in
> Cloudinary; we store `public_id` and build delivery URLs at read time.
>
> **Column constraints (2026-06-12 hardening):** the `string`/`text` types in
> the diagram are shorthand — in Postgres every bounded string is
> `VARCHAR(n)` with caps mirroring the DTO validators 1:1 (e.g. `users.email`
> 255, `full_name` 120, `phone` 20; tour titles 200; review body 2000; see
> `schema.prisma`). `reviews.rating` additionally carries a raw-SQL
> `CHECK (rating BETWEEN 1 AND 5)`. `bookings.refunded_by` deliberately has
> NO FK (audit snapshot; users are never deletable via the API).

## Indexes (critical)

| Table | Index | Reason |
| --- | --- | --- |
| `tours` | `(slug)` UNIQUE | Public detail lookup |
| `tours` | `(is_published, category)` | Filtered catalog query |
| `tours` | `(destination_id)` | List by destination |
| `tours` | `(is_featured, is_published)` | Home page featured strip (published + featured combo) |
| `tour_departures` | `(tour_id, start_date)` | Upcoming departures of a tour |
| `bookings` | `(user_id, status)` | "My bookings" history |
| `bookings` | `(stripe_session_id)` UNIQUE | Webhook lookup |
| `reviews` | `(tour_id, is_approved)` | Show approved reviews |
| `payment_events` | `(stripe_event_id)` UNIQUE | Webhook idempotency |
| `media_assets` | `(owner_type, owner_id, role)` | Batch-load an owner's media |

## Bilingual content strategy

For every user-facing text on Destination, Tour, and TourItineraryDay we store **both** `*_en` and `*_vi` columns. Frontend selects by `user.locale` or browser preference. No translation table — keeps queries simple, acceptable for 2 languages. If we add ZH later we will refactor to a `translations` join table.

## Migrations

```bash
# Local dev (against direct connection)
pnpm --filter @tourism/api exec prisma migrate dev --name <name>

# Production
pnpm --filter @tourism/api exec prisma migrate deploy
```

`prisma.config.ts` reads `DIRECT_URL` (port 5432) for migration commands;
runtime `PrismaClient` reads `DATABASE_URL` (Supabase pooler, port 6543).

> `migrate dev` refuses to run in a non-interactive shell when a change is
> data-lossy (e.g. dropping a populated column). In that case author the
> `migrations/<ts>_<name>/migration.sql` by hand and apply it with
> `migrate deploy`. Recipe (Prisma 7):
>
> ```bash
> pnpm --filter @tourism/api exec prisma migrate diff \
>   --from-config-datasource --to-schema prisma/schema.prisma --script
> # → inspect, write migrations/<ts>_<name>/migration.sql, then:
> pnpm --filter @tourism/api exec prisma migrate deploy
> ```
>
> **Inspect the generated SQL before applying** — Prisma's diff for a
> text→enum column change emits `DROP COLUMN + ADD COLUMN` (data loss / NOT
> NULL failure); hand-edit it to
> `ALTER COLUMN ... TYPE "Enum" USING col::"Enum"` instead (done for
> `media_assets.role`, 2026-06-12).
