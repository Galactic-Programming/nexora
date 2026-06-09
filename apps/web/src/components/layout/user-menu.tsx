import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@tourism/ui/components/custom/button-custom";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UserMenuActions } from "./user-menu-actions";

/** Server component: shows Sign in when logged out, dropdown when logged in. */
export async function UserMenu() {
  const t = await getTranslations("Nav");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Button nativeButton={false} render={<Link href="/sign-in" />}>
        {t("signIn")}
      </Button>
    );
  }
  return <UserMenuActions email={user.email ?? ""} />;
}
