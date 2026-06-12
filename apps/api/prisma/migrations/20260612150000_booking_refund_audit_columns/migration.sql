-- Refund audit trail (2026-06-12): who refunded and why used to live only in
-- Stripe (and only when the reason matched Stripe's enum). Persist both
-- locally so operators don't need the Stripe Dashboard for internal audits.
-- `refunded_by` is a users.id snapshot WITHOUT an FK (MediaAsset.owner_id
-- precedent; users are never deletable via the API so it cannot dangle).
ALTER TABLE "bookings" ADD COLUMN     "refund_reason" VARCHAR(500),
ADD COLUMN     "refunded_by" UUID;
