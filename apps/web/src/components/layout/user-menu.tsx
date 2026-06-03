import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@tourism/ui/components/custom/button-custom";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Server component: shows Sign in when logged out, the email when logged in. */
export async function UserMenu() {
  const t = await getTranslations("Nav");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Button render={<Link href="/sign-in" />}>
        {t("signIn")}
      </Button>
    );
  }
  return (
    <span className="text-sm font-medium" data-testid="user-email">
      {user.email}
    </span>
  );
}
