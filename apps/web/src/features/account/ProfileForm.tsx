"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@tourism/ui/components/legacy/field";
import { Input } from "@tourism/ui/components/legacy/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@tourism/ui/components/legacy/native-select";
import { Button } from "@tourism/ui/components/custom/button-custom";
import { PhoneInput } from "@tourism/ui/components/custom/phone-input";
import { Alert, AlertDescription } from "@tourism/ui/components/custom/alert-custom";
import type { User } from "@/lib/api/users";
import { profileSchema, type ProfileValues } from "./schema";
import { updateProfile } from "./actions";

type Status = "idle" | "saved" | "noChanges" | "error";

export function ProfileForm({ user }: { user: User }) {
  const t = useTranslations("Account");
  const locale = useLocale();
  const [status, setStatus] = useState<Status>("idle");

  const original = {
    fullName: user.fullName,
    phone: user.phone,
    locale: user.locale,
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user.fullName ?? "",
      phone: user.phone ?? "",
      locale: user.locale,
    },
  });

  async function onSubmit(values: ProfileValues) {
    setStatus("idle");
    const res = await updateProfile({ locale, original, values });
    if (res.ok && "noop" in res) {
      setStatus("noChanges");
      return;
    }
    if (res.ok) {
      setStatus("saved");
      reset(values);
      return;
    }
    setStatus("error");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-md">
      <FieldGroup className="gap-4">
        {status === "saved" && (
          <Alert variant="success">
            <AlertDescription>{t("status.saved")}</AlertDescription>
          </Alert>
        )}
        {status === "noChanges" && (
          <Alert>
            <AlertDescription>{t("status.noChanges")}</AlertDescription>
          </Alert>
        )}
        {status === "error" && (
          <Alert variant="destructive">
            <AlertDescription>{t("status.error")}</AlertDescription>
          </Alert>
        )}

        <Field className="gap-2">
          <FieldLabel htmlFor="fullName">{t("fields.fullName")}</FieldLabel>
          <Input
            id="fullName"
            autoComplete="name"
            placeholder={t("fields.fullNamePlaceholder")}
            aria-invalid={!!errors.fullName}
            {...register("fullName")}
          />
          {errors.fullName?.message ? (
            <FieldError>{t(errors.fullName.message)}</FieldError>
          ) : null}
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor="phone">{t("fields.phone")}</FieldLabel>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <PhoneInput
                id="phone"
                value={field.value || undefined}
                onChange={(v) => field.onChange(v ?? "")}
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.phone?.message ? (
            <FieldError>{t(errors.phone.message)}</FieldError>
          ) : null}
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor="locale">{t("fields.locale")}</FieldLabel>
          <NativeSelect id="locale" {...register("locale")}>
            <NativeSelectOption value="en">{t("fields.localeEn")}</NativeSelectOption>
            <NativeSelectOption value="vi">{t("fields.localeVi")}</NativeSelectOption>
          </NativeSelect>
          <FieldDescription>{t("fields.localeHelp")}</FieldDescription>
        </Field>

        <Field>
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? t("actions.saving") : t("actions.save")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
