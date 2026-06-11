"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@tourism/ui/components/custom/button-custom";
import { Alert, AlertDescription } from "@tourism/ui/components/custom/alert-custom";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@tourism/ui/components/legacy/field";
import { Input } from "@tourism/ui/components/legacy/input";
import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { pickTotpFactor, type TotpFactorLike } from "@/features/auth/mfa";
import { mapAuthError } from "@/features/auth/auth-error";

type View =
  | { kind: "loading" }
  | { kind: "disabled" }
  | { kind: "enrolling"; factorId: string; qrCode: string; secret: string }
  | { kind: "enabled"; factor: TotpFactorLike }
  | { kind: "removing"; factor: TotpFactorLike };

/**
 * Manages the user's single TOTP factor: status, enroll (QR + secret + code
 * verify), and code-gated removal (challenge+verify guarantees aal2 even for
 * OAuth sessions before unenroll).
 */
export function MfaSection() {
  const t = useTranslations("Account");
  const tAuth = useTranslations("Auth");
  const [view, setView] = useState<View>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError(t("security.genericError"));
      setView({ kind: "disabled" });
      return;
    }
    const factor = pickTotpFactor(data);
    setView(factor ? { kind: "enabled", factor } : { kind: "disabled" });
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function resetTransient() {
    setCode("");
    setError(null);
  }

  async function startEnroll() {
    resetTransient();
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      // Re-check fresh state: a verified factor may exist if the mount-time
      // listFactors failed (the disabled view is also the error fallback) —
      // never enroll a second factor on top of it.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const verified = pickTotpFactor(existing);
      if (verified) {
        setView({ kind: "enabled", factor: verified });
        return;
      }
      // Clean up an abandoned unverified factor from a previous attempt.
      const stale = existing?.totp?.find((f) => f.status !== "verified");
      if (stale) await supabase.auth.mfa.unenroll({ factorId: stale.id });

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (enrollError || !data) {
        setError(t("security.genericError"));
        return;
      }
      setView({
        kind: "enrolling",
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } finally {
      setBusy(false);
    }
  }

  /** challenge + verify the given factor with the entered code. */
  async function verifyCode(factorId: string): Promise<boolean> {
    const supabase = createSupabaseBrowserClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError || !challenge) {
      setError(t("security.genericError"));
      return false;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) {
      setError(tAuth(mapAuthError(verifyError)));
      return false;
    }
    return true;
  }

  async function confirmEnroll() {
    if (view.kind !== "enrolling") return;
    setError(null);
    setBusy(true);
    try {
      const ok = await verifyCode(view.factorId);
      if (ok) {
        resetTransient();
        setView({ kind: "loading" });
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnroll() {
    if (view.kind !== "enrolling") return;
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: view.factorId,
      });
      if (unenrollError) {
        // Stay on the enroll panel so the user sees the failure; the stale
        // factor is also cleaned up by the next startEnroll attempt.
        setError(t("security.genericError"));
        return;
      }
      resetTransient();
      setView({ kind: "disabled" });
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    if (view.kind !== "removing") return;
    setError(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ok = await verifyCode(view.factor.id);
      if (!ok) return;
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: view.factor.id,
      });
      if (unenrollError) {
        setError(t("security.genericError"));
        return;
      }
      resetTransient();
      setView({ kind: "loading" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (view.kind === "loading") {
    return (
      <div className="space-y-3">
        <ShimmerSkeleton className="h-6 w-56" />
        <ShimmerSkeleton className="h-10 w-full" />
        <ShimmerSkeleton className="h-10 w-32" />
      </div>
    );
  }

  return (
    <section aria-label={t("security.title")} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{t("security.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("security.description")}</p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {view.kind === "disabled" && (
        <div className="space-y-3">
          <p className="text-sm text-foreground">{t("security.statusDisabled")}</p>
          <Button type="button" onClick={startEnroll} disabled={busy}>
            {t("security.enableCta")}
          </Button>
        </div>
      )}

      {view.kind === "enabled" && (
        <div className="space-y-3">
          <p className="text-sm text-foreground">{t("security.statusEnabled")}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetTransient();
              setView({ kind: "removing", factor: view.factor });
            }}
            disabled={busy}
          >
            {t("security.removeCta")}
          </Button>
        </div>
      )}

      {view.kind === "enrolling" && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <h3 className="font-medium text-foreground">{t("security.enrollTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("security.enrollHelp")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URI QR from Supabase */}
          <img
            src={view.qrCode}
            alt={t("security.qrAlt")}
            width={176}
            height={176}
            className="rounded bg-white p-2"
          />
          <div className="text-sm">
            <span className="text-muted-foreground">{t("security.secretLabel")}: </span>
            <code className="select-all break-all text-foreground">{view.secret}</code>
          </div>
          <FieldGroup className="gap-3">
            <Field className="gap-2">
              <FieldLabel htmlFor="mfa-code">{t("security.codeLabel")}</FieldLabel>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={confirmEnroll}
                disabled={busy || code.trim().length < 6}
              >
                {t("security.verifyCta")}
              </Button>
              <Button type="button" variant="ghost" onClick={cancelEnroll} disabled={busy}>
                {t("security.cancelCta")}
              </Button>
            </div>
          </FieldGroup>
        </div>
      )}

      {view.kind === "removing" && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <h3 className="font-medium text-foreground">{t("security.removeTitle")}</h3>
          <FieldGroup className="gap-3">
            <Field className="gap-2">
              <FieldLabel htmlFor="mfa-remove-code">{t("security.codeLabel")}</FieldLabel>
              <Input
                id="mfa-remove-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <FieldDescription>{t("security.removeHelp")}</FieldDescription>
            </Field>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                onClick={confirmRemove}
                disabled={busy || code.trim().length < 6}
              >
                {t("security.removeConfirmCta")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  resetTransient();
                  setView({ kind: "enabled", factor: view.factor });
                }}
                disabled={busy}
              >
                {t("security.cancelCta")}
              </Button>
            </div>
          </FieldGroup>
        </div>
      )}
    </section>
  );
}
