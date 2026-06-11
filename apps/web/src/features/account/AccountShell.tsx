import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

/**
 * Thin account layout: heading + a minimal nav list (Profile only today) +
 * single content column. Structured so Phase D (e.g. Bookings) can append nav
 * items / sibling routes without re-architecting this page. Not a sidebar.
 *
 * Note: the (site) layout wraps content in a plain <div>, not a <main>, so
 * this component uses <main> safely with no landmark nesting violation.
 */
export async function AccountShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("Account");
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </header>
      <nav aria-label={t("title")} className="mb-6">
        <ul className="flex gap-2 border-b border-border">
          <li>
            <span
              aria-current="page"
              className="inline-block border-b-2 border-primary px-1 pb-2 text-sm font-medium text-foreground"
            >
              {t("nav.profile")}
            </span>
          </li>
        </ul>
      </nav>
      <div>{children}</div>
    </main>
  );
}
