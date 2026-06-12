import { mintBookingCode } from './booking-code';

describe('mintBookingCode', () => {
  it('always matches the public review-DTO contract /^BK-[A-Z0-9]{8}$/', () => {
    // The old base64url generator emitted '-' and '_' roughly 1 - (62/64)^8
    // ≈ 22% of the time, producing bookings that could never be reviewed.
    // 2000 samples make a regression statistically impossible to miss.
    for (let i = 0; i < 2000; i++) {
      expect(mintBookingCode()).toMatch(/^BK-[A-Z0-9]{8}$/);
    }
  });

  it('produces distinct codes across draws (sanity, not a uniqueness proof)', () => {
    const codes = new Set(
      Array.from({ length: 1000 }, () => mintBookingCode()),
    );
    expect(codes.size).toBe(1000);
  });
});
