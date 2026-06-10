import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthBrandPanel } from "./auth-brand-panel";

interface AuthShellProps {
  children: ReactNode;
}

/** Full-viewport split layout for auth pages: brand panel (lg+) + centered
 *  form column. The form column carries a compact brand lockup on mobile. */
export async function AuthShell({ children }: AuthShellProps) {
  const tNav = await getTranslations("Nav");
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <AuthBrandPanel />
      <div className="flex flex-col items-center justify-center px-6 py-10">
        <Link
          href="/"
          className="mb-8 text-lg font-semibold tracking-tight lg:hidden"
        >
          {tNav("brand")}
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}
