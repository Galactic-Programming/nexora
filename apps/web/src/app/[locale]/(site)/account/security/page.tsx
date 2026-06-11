import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AccountShell } from "@/features/account/AccountShell";
import { MfaSection } from "@/features/account/MfaSection";

export default async function AccountSecurityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: { pathname: "/sign-in", query: { returnTo: "/account/security" } }, locale });
  }

  return (
    <AccountShell active="security">
      <MfaSection />
    </AccountShell>
  );
}
