import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncUser } from "@/features/auth/actions";
import { getMe } from "@/lib/api/users";
import { ApiError } from "@/lib/api/errors";
import { AccountShell } from "@/features/account/AccountShell";
import { IdentityBlock } from "@/features/account/IdentityBlock";
import { ProfileForm } from "@/features/account/ProfileForm";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@tourism/ui/components/custom/alert-custom";
import type { User } from "@/lib/api/users";

/**
 * Fetches the signed-in user's profile with a single retry on USER_NOT_SYNCED.
 * The first call may fail if the Supabase user hasn't been mirrored yet; the
 * preceding syncUser() call covers the normal path, but in races the retry
 * guarantees consistency.
 */
async function loadProfile(token: string): Promise<User> {
  try {
    return await getMe(token);
  } catch (err) {
    if (ApiError.isApiError(err) && err.code === "USER_NOT_SYNCED") {
      await syncUser();
      return await getMe(token);
    }
    throw err;
  }
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createSupabaseServerClient();

  // Secure gate: getUser() validates the JWT server-side (preferred over getSession()).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // redirect() is typed `never` — TypeScript narrows `user` as non-null below.
  if (!user) {
    redirect({
      href: { pathname: "/sign-in", query: { returnTo: "/account" } },
      locale,
    });
  }

  // We need the access token to call the backend API.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    redirect({
      href: { pathname: "/sign-in", query: { returnTo: "/account" } },
      locale,
    });
  }
  // redirect() throws internally (returns `never`), but tsc still widens the
  // type after the guard block. The non-null assertion is safe: we never reach
  // this point when session is null.
  const accessToken = session!.access_token;

  // Best-effort sync before fetching; loadProfile retries if still unsynced.
  await syncUser();

  const t = await getTranslations("Account");

  try {
    const profile = await loadProfile(accessToken);
    return (
      <AccountShell>
        <div className="space-y-8">
          <IdentityBlock user={profile} locale={locale} />
          <ProfileForm user={profile} />
        </div>
      </AccountShell>
    );
  } catch {
    return (
      <AccountShell>
        <Alert variant="destructive">
          <AlertTitle>{t("status.loadError")}</AlertTitle>
          <AlertDescription>
            <Link href="/account" className="underline">
              {t("status.retry")}
            </Link>
          </AlertDescription>
        </Alert>
      </AccountShell>
    );
  }
}
