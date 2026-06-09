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
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@tourism/ui/components/legacy/input-group";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { signInSchema, type SignInValues } from "./schemas";
import { sanitizeReturnTo } from "./redirect";
import { mapAuthError } from "./auth-error";
import { syncUser } from "./actions";

export function SignInForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const sp = useSearchParams();
  const returnTo = sanitizeReturnTo(sp.get("returnTo"));
  const [showPw, setShowPw] = useState(false);
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
    await syncUser();
    router.push(returnTo);
    router.refresh();
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
            {...register("email")}
          />
          {errors.email?.message ? (
            <p className="text-destructive text-sm">{t(errors.email.message)}</p>
          ) : null}
        </Field>
        <Field className="w-full gap-2">
          <FieldLabel htmlFor="password">{t("passwordLabel")}</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              placeholder={t("passwordPlaceholder")}
              {...register("password")}
            />
            <InputGroupAddon align="inline-end" className="pr-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowPw((s) => !s)}
                className="text-muted-foreground hover:bg-transparent"
              >
                {showPw ? <EyeOffIcon /> : <EyeIcon />}
                <span className="sr-only">
                  {showPw ? t("hidePassword") : t("showPassword")}
                </span>
              </Button>
            </InputGroupAddon>
          </InputGroup>
          {errors.password?.message ? (
            <p className="text-destructive text-sm">{t(errors.password.message)}</p>
          ) : null}
        </Field>
        <Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {t("signInCta")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
