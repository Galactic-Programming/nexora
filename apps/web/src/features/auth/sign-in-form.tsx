"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@tourism/ui/components/legacy/button";
import { Field, FieldGroup, FieldLabel } from "@tourism/ui/components/legacy/field";
import { Input } from "@tourism/ui/components/legacy/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { signInSchema, type SignInValues } from "./schemas";
import { sanitizeReturnTo } from "./redirect";
import { mapAuthError, mapCallbackError } from "./auth-error";
import { shouldChallengeMfa, pickTotpFactor } from "./mfa";
import { syncUser } from "./actions";
import { PasswordField } from "./password-field";

type Step = { kind: "credentials" } | { kind: "totp"; factorId: string };

export function SignInForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const sp = useSearchParams();
  const returnTo = sanitizeReturnTo(sp.get("returnTo"));
  // Seed the form error from a /auth/callback `?error=` flag (link/oauth);
  // cleared on the next submit attempt like any other form error.
  const callbackErrorKey = mapCallbackError(sp.get("error"));
  const [formError, setFormError] = useState<string | null>(
    callbackErrorKey ? t(callbackErrorKey) : null,
  );
  const [step, setStep] = useState<Step>({ kind: "credentials" });
  const [totpCode, setTotpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });

  /** Shared tail of both steps: mirror the user, then hard-nav to the target. */
  async function completeSignIn() {
    const sync = await syncUser();
    if (!sync.ok) {
      setFormError(t("errors.syncFailed"));
      return;
    }
    window.location.assign(`/${locale}${returnTo}`);
  }

  async function onSubmit(values: SignInValues) {
    setFormError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      setFormError(t(mapAuthError(error)));
      return;
    }
    // 2FA step-up: password sign-ins with a verified factor must verify a code.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (shouldChallengeMfa(aal ?? null)) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = pickTotpFactor(factors ?? null);
      if (factor) {
        setStep({ kind: "totp", factorId: factor.id });
        return;
      }
      // Factor vanished (e.g. admin removed it) — proceed normally.
    }
    await completeSignIn();
  }

  async function onVerifyTotp(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind !== "totp") return;
    setFormError(null);
    setVerifying(true);
    const supabase = createSupabaseBrowserClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: step.factorId,
    });
    if (challengeError || !challenge) {
      setVerifying(false);
      setFormError(t("errors.generic"));
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: step.factorId,
      challengeId: challenge.id,
      code: totpCode.trim(),
    });
    if (verifyError) {
      setVerifying(false);
      setFormError(t(mapAuthError(verifyError)));
      return;
    }
    await completeSignIn();
    setVerifying(false);
  }

  if (step.kind === "totp") {
    return (
      <form onSubmit={onVerifyTotp} noValidate>
        <FieldGroup className="gap-4">
          <div>
            <h2 className="font-medium text-card-foreground">{t("mfa.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("mfa.help")}</p>
          </div>
          {formError && (
            <p role="alert" className="text-destructive text-sm">
              {formError}
            </p>
          )}
          <Field className="gap-2">
            <FieldLabel htmlFor="totp-code">{t("mfa.codeLabel")}</FieldLabel>
            <Input
              id="totp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
            />
          </Field>
          <Field>
            <Button
              type="submit"
              className="w-full"
              disabled={verifying || totpCode.trim().length < 6}
            >
              {t("mfa.verifyCta")}
            </Button>
          </Field>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:underline"
            onClick={() => {
              setStep({ kind: "credentials" });
              setTotpCode("");
              setFormError(null);
            }}
          >
            {t("mfa.back")}
          </button>
        </FieldGroup>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-4">
        {formError && (
          <p role="alert" className="text-destructive text-sm">
            {formError}
          </p>
        )}
        <Field className="gap-2">
          <FieldLabel htmlFor="email">{t("emailLabel")}</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
          {errors.email?.message ? (
            <p id="email-error" role="alert" className="text-destructive text-sm">
              {t(errors.email.message)}
            </p>
          ) : null}
        </Field>
        <PasswordField
          id="password"
          label={t("passwordLabel")}
          autoComplete="current-password"
          placeholder={t("passwordPlaceholder")}
          registration={register("password")}
          error={errors.password?.message ? t(errors.password.message) : undefined}
        />
        <Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {t("signInCta")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
