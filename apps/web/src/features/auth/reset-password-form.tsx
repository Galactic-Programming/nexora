"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@tourism/ui/components/legacy/button";
import { Field, FieldGroup } from "@tourism/ui/components/legacy/field";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { resetSchema, type ResetValues } from "./schemas";
import { mapAuthError } from "./auth-error";
import { PasswordField } from "./password-field";

export function ResetPasswordForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema) });

  async function onSubmit(values: ResetValues) {
    setFormError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      setFormError(t(mapAuthError(error)));
      return;
    }
    router.push("/sign-in");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-4">
        {formError && (
          <p role="alert" className="text-destructive text-sm">
            {formError}
          </p>
        )}
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
            {t("resetCta")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
