import { randomBytes } from 'node:crypto';

/**
 * True base36 alphabet (A-Z, 0-9) — the SAME contract the review flow's
 * `bookingCode` regex (`^BK-[A-Z0-9]{6,12}$`) validates against.
 *
 * History: the original generator used `base64url`, whose alphabet includes
 * `-` and `_`. ~22% of bookings got a code the review DTO rejected, so their
 * buyers could never submit a review. Keep this alphabet and that regex in
 * sync — there is a spec asserting the format over 2000 draws.
 */
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 8;

/**
 * Mints a human-readable booking code: `BK-` + 8 base36 chars.
 * 36^8 ≈ 2.8 × 10^12 distinct codes. The slight modulo bias (256 % 36 ≠ 0)
 * is irrelevant here — codes are identifiers, not secrets, and uniqueness is
 * enforced by the DB UNIQUE constraint + caller retry.
 */
export function mintBookingCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let suffix = '';
  for (const b of bytes) {
    suffix += CODE_ALPHABET[b % CODE_ALPHABET.length];
  }
  return `BK-${suffix}`;
}
