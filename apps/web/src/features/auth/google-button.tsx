"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@tourism/ui/components/legacy/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sanitizeReturnTo } from "./redirect";
import { buildOAuthRedirect } from "./oauth";

/**
 * Live "Continue with Google" — starts the Supabase OAuth flow. On success the
 * browser navigates away to Google, so the pending state persists until unload.
 * A returned error (e.g. provider not enabled) re-enables the button with an
 * inline alert.
 */
export function GoogleButton() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const sp = useSearchParams();
  const returnTo = sanitizeReturnTo(sp.get("returnTo"));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: buildOAuthRedirect(window.location.origin, locale, returnTo) },
    });
    if (oauthError) {
      setPending(false);
      setError(t("errors.oauthFailed"));
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={onClick}
      >
        {pending ? t("googleRedirecting") : t("googleCta")}
      </Button>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
