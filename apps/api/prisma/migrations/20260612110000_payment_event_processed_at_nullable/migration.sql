-- Webhook idempotency fix: `processed_at` used to be NOT NULL DEFAULT now()
-- (set at INSERT — i.e. "received at"), which made the duplicate check lie:
-- an event whose handler crashed mid-way was already marked as done, so the
-- Stripe retry was skipped and the booking stayed PENDING despite payment.
--
-- New semantics: `processed_at` is set ONLY after the handler completes;
-- NULL = received but unfinished → a retry with the same event id re-runs
-- the (booking-level idempotent) handler. `received_at` takes over the old
-- insert-timestamp role. Existing rows keep their timestamps (all of them
-- finished processing under the old code path).
ALTER TABLE "payment_events" ADD COLUMN     "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "processed_at" DROP NOT NULL,
ALTER COLUMN "processed_at" DROP DEFAULT;
