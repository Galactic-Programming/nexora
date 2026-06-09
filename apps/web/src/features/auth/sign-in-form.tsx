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
import { signInSchema, type SignInValues } from "./schemas";
import { sanitizeReturnTo } from "./redirect";
import { mapAuthError } from "./auth-error";
import { syncUser } from "./actions";
import { PasswordField } from "./password-field";

export function SignInForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const sp = useSearchParams();
  const returnTo = sanitizeReturnTo(sp.get("returnTo"));
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });

  async function onSubmit(values: SignInValues) {
    setFormError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      setFormError(t(mapAuthError(error)));
      return;
    }
    const sync = await syncUser();
    if (!sync.ok) {
      setFormError(t("errors.syncFailed"));
      return;
    }
    router.push(returnTo);
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
