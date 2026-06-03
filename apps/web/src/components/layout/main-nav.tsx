import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function MainNav() {
  const t = useTranslations("Nav");
  const items = [
    { href: "/", label: t("home") },
    { href: "/tours", label: t("tours") },
    { href: "/destinations", label: t("destinations") },
  ] as const;
  return (
    <nav aria-label={t("ariaLabel")} className="hidden items-center gap-6 md:flex">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
