"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@tourism/ui/components/legacy/button";
import { Field, FieldGroup, FieldLabel } from "@tourism/ui/components/legacy/field";
import { Input } from "@tourism/ui/components/legacy/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { forgotSchema, type ForgotValues } from "./schemas";
import { mapAuthError } from "./auth-error";
import { CheckEmailNotice } from "./check-email-notice";

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) });

  async function onSubmit(values: ForgotValues) {
    setFormError(null);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, { redirectTo });
    if (error) {
      setFormError(t(mapAuthError(error)));
      return;
    }
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
        <Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {t("forgotCta")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
