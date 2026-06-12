-- Defense-in-depth pass (2026-06-12): mirror the DTO validation bounds as DB
-- column constraints so a write path that bypasses class-validator (manual SQL,
-- dashboard edit, future service bug) cannot insert out-of-contract data.
-- Bounds match the input DTOs 1:1 — see the audit in this migration's PR.

-- CreateEnum
CREATE TYPE "MediaRole" AS ENUM ('hero', 'gallery', 'avatar');

-- AlterTable
ALTER TABLE "bookings" ALTER COLUMN "code" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "contact_name" SET DATA TYPE VARCHAR(120),
ALTER COLUMN "contact_email" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "contact_phone" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "special_requests" SET DATA TYPE VARCHAR(1000),
ALTER COLUMN "stripe_session_id" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "stripe_payment_intent_id" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "destinations" ALTER COLUMN "slug" SET DATA TYPE VARCHAR(80),
ALTER COLUMN "name_en" SET DATA TYPE VARCHAR(120),
ALTER COLUMN "name_vi" SET DATA TYPE VARCHAR(120),
ALTER COLUMN "country" SET DATA TYPE VARCHAR(60),
ALTER COLUMN "region" SET DATA TYPE VARCHAR(80),
ALTER COLUMN "description_en" SET DATA TYPE VARCHAR(2000),
ALTER COLUMN "description_vi" SET DATA TYPE VARCHAR(2000);

-- AlterTable. NOTE: Prisma's generated diff used DROP COLUMN + ADD COLUMN for
-- the text -> enum change, which loses data and fails on NOT NULL. Hand-edited
-- to an in-place cast (all existing values are valid enum members; verified).
ALTER TABLE "media_assets" ALTER COLUMN "public_id" SET DATA TYPE VARCHAR(300),
ALTER COLUMN "role" SET DATA TYPE "MediaRole" USING "role"::"MediaRole",
ALTER COLUMN "format" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "poster_id" SET DATA TYPE VARCHAR(300);

-- AlterTable
ALTER TABLE "payment_events" ALTER COLUMN "stripe_event_id" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "type" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "reviews" ALTER COLUMN "title" SET DATA TYPE VARCHAR(120),
ALTER COLUMN "body" SET DATA TYPE VARCHAR(2000);

-- AlterTable
ALTER TABLE "tour_itinerary_days" ALTER COLUMN "title_en" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "title_vi" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "description_en" SET DATA TYPE VARCHAR(2000),
ALTER COLUMN "description_vi" SET DATA TYPE VARCHAR(2000);

-- AlterTable
ALTER TABLE "tours" ALTER COLUMN "slug" SET DATA TYPE VARCHAR(120),
ALTER COLUMN "title_en" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "title_vi" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "summary_en" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "summary_vi" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "difficulty" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "meeting_point" SET DATA TYPE VARCHAR(300);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "full_name" SET DATA TYPE VARCHAR(120),
ALTER COLUMN "phone" SET DATA TYPE VARCHAR(20);

-- Rating range guard: public tour aggregates (avg rating) depend on 1..5, so
-- this one numeric bound earns a DB-level CHECK on top of the DTO validation.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

-- Security advisor remediation: rls_auto_enable() is SECURITY DEFINER and was
-- executable by anon/authenticated via PostgREST RPC. Nothing client-side ever
-- calls it — it is an owner-side trigger helper.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
