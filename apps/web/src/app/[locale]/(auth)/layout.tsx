import type { ReactNode } from "react";
import { redirect } from "@/i18n/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthShell } from "@/features/auth/auth-shell";

/** Auth pages are for signed-OUT users. If already signed in, bounce home. */
export default async function AuthLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect({ href: "/", locale });
  return <AuthShell>{children}</AuthShell>;
}
