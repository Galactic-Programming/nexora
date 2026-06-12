/**
 * Normalises arbitrary admin input ("Hội An 2024", "ĐÀ NẴNG / Huế", …) into
 * the canonical kebab slug format enforced across the API
 * (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`).
 *
 * Steps:
 *  1. NFD-decompose + strip combining diacritics (ấ → a, ữ → u, …).
 *  2. Map đ/Đ → d explicitly — they are standalone letters, NOT base+combining
 *     pairs, so NFD alone leaves them untouched (classic Vietnamese gotcha).
 *  3. Lowercase, collapse every non-alphanumeric run into a single hyphen,
 *     trim leading/trailing hyphens.
 *
 * Symbol-only input yields `''` — the caller decides whether to fall back
 * (e.g. generate from another field) or reject.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
