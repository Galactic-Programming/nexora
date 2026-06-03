"use client";

import { useState } from "react";
import { MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@tourism/ui/components/custom/button-custom";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@tourism/ui/components/legacy/sheet";

export function MobileNav() {
  const t = useTranslations("Nav");
  const [open, setOpen] = useState(false);
  const items = [
    { href: "/", label: t("home") },
    { href: "/tours", label: t("tours") },
    { href: "/destinations", label: t("destinations") },
  ] as const;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            size="icon"
            variant="outline"
            className="md:hidden"
            aria-label={t("openMenu")}
          >
            <MenuIcon />
          </Button>
        }
      />
      <SheetContent side="left" className="w-64">
        <SheetTitle>{t("ariaLabel")}</SheetTitle>
        <nav className="mt-6 flex flex-col gap-4">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="text-foreground text-base font-medium"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
