/** Shape of supabase `mfa.getAuthenticatorAssuranceLevel()` data we read. */
export interface AalLevels {
  currentLevel: string | null;
  nextLevel: string | null;
}

/** True iff the session must step up to aal2 (a verified factor exists). */
export function shouldChallengeMfa(aal: AalLevels | null): boolean {
  return aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";
}

/** Minimal factor shape we read off supabase `mfa.listFactors()` data. */
export interface TotpFactorLike {
  id: string;
  status: string;
}

/** First VERIFIED totp factor, or null. Unverified leftovers are ignored. */
export function pickTotpFactor(
  factors: { totp?: TotpFactorLike[] } | null,
): TotpFactorLike | null {
  return factors?.totp?.find((f) => f.status === "verified") ?? null;
}
