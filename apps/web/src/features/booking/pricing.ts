/**
 * DISPLAY-ONLY estimate mirroring the backend formula
 * `totalAmount = (numAdults + numChildren) × effectiveUnitPrice`.
 * The server always recomputes from DB prices — this never goes on the wire.
 */
export function computeTotal(unitPrice: number, adults: number, children: number): number {
  return Math.round(unitPrice * (adults + children) * 100) / 100;
}
