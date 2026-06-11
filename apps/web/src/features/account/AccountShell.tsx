import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type AccountSection = "profile" | "security";

const NAV_ITEMS: {
  section: AccountSection;
  href: "/account" | "/account/security";
  labelKey: "nav.profile" | "nav.security";
}[] = [
  { section: "profile", href: "/account", labelKey: "nav.profile" },
  { section: "security", href: "/account/security", labelKey: "nav.security" },
];

/**
 * Thin account layout: heading + a minimal nav list + single content column.
 * Structured so Phase D (e.g. Bookings) can append nav items without
 * re-architecting. Not a sidebar.
 *
 * Note: the (site) layout wraps content in a plain <div>, not a <main>, so
 * this component uses <main> safely with no landmark nesting violation.
 */
export async function AccountShell({
  active,
  children,
}: {
  active: AccountSection;
  children: ReactNode;
}) {
  const t = await getTranslations("Account");
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </header>
      <nav aria-label={t("title")} className="mb-6">
        <ul className="flex gap-4 border-b border-border">
          {NAV_ITEMS.map((item) =>
            item.section === active ? (
              <li key={item.section}>
                <span
                  aria-current="page"
                  className="inline-block border-b-2 border-primary px-1 pb-2 text-sm font-medium text-foreground"
                >
                  {t(item.labelKey)}
                </span>
              </li>
            ) : (
              <li key={item.section}>
                <Link
                  href={item.href}
                  className="inline-block px-1 pb-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  {t(item.labelKey)}
                </Link>
              </li>
            ),
          )}
        </ul>
      </nav>
      <div>{children}</div>
    </main>
  );
}
