"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@tourism/ui/components/legacy/button";
import { Field, FieldGroup, FieldLabel } from "@tourism/ui/components/legacy/field";
import { Input } from "@tourism/ui/components/legacy/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { signUpSchema, type SignUpValues } from "./schemas";
import { sanitizeReturnTo } from "./redirect";
import { mapAuthError } from "./auth-error";
import { syncUser } from "./actions";
import { PasswordField } from "./password-field";
import { CheckEmailNotice } from "./check-email-notice";

export function SignUpForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const sp = useSearchParams();
  const returnTo = sanitizeReturnTo(sp.get("returnTo"));
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema) });

  async function onSubmit(values: SignUpValues) {
    setFormError(null);
    const supabase = createSupabaseBrowserClient();
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`;
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { emailRedirectTo },
    });
    if (error) {
      setFormError(t(mapAuthError(error)));
      return;
    }
    if (data.session) {
      // Confirm-email OFF → already signed in.
      const sync = await syncUser();
      if (!sync.ok) {
        setFormError(t("errors.syncFailed"));
        return;
      }
      router.push(returnTo);
      router.refresh();
      return;
    }
    // Confirm-email ON → show the check-email panel.
    setSentTo(values.email);
  }

  if (sentTo) return <CheckEmailNotice email={sentTo} />;

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
          autoComplete="new-password"
          placeholder={t("passwordPlaceholder")}
          registration={register("password")}
          error={errors.password?.message ? t(errors.password.message) : undefined}
        />
        <PasswordField
          id="confirmPassword"
          label={t("confirmPasswordLabel")}
          autoComplete="new-password"
          placeholder={t("passwordPlaceholder")}
          registration={register("confirmPassword")}
          error={errors.confirmPassword?.message ? t(errors.confirmPassword.message) : undefined}
        />
        <Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {t("signUpCta")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
