"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@tourism/ui/components/legacy/field";
import { Input } from "@tourism/ui/components/legacy/input";
import { Button } from "@tourism/ui/components/custom/button-custom";
import { Alert, AlertDescription } from "@tourism/ui/components/custom/alert-custom";
import { Rating } from "@tourism/ui/components/custom/rating";
import { reviewSchema, type ReviewValues } from "./schema";
import { mapReviewError } from "./review-error";
import { createReview } from "./actions";

export interface ReviewFormProps {
  bookingCode: string;
}

export function ReviewForm({ bookingCode }: ReviewFormProps) {
  const t = useTranslations("Review");
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0, title: "", body: "" },
  });

  async function onSubmit(values: ReviewValues) {
    setServerError(null);
    const res = await createReview(bookingCode, values);
    if (!res.ok) {
      setServerError(t(mapReviewError(res.code)));
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="space-y-4" role="status">
        <h2 className="text-2xl font-semibold text-foreground">{t("success.title")}</h2>
        <p className="text-muted-foreground">{t("success.body")}</p>
        <Link
          href={`/account/bookings/${bookingCode}`}
          className="text-primary inline-block text-sm hover:underline"
        >
          {t("success.backToBooking")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-xl space-y-6">
      <Field>
        <FieldLabel htmlFor="rating">{t("form.ratingLabel")}</FieldLabel>
        <Controller
          control={control}
          name="rating"
          render={({ field }) => (
            <Rating
              name="rating"
              value={field.value}
              onValueChange={(v) => field.onChange(v)}
              aria-label={t("form.ratingLabel")}
            />
          )}
        />
        {errors.rating ? <FieldError>{t(errors.rating.message ?? "errors.ratingRequired")}</FieldError> : null}
      </Field>

      <Field>
        <FieldLabel htmlFor="title">{t("form.titleLabel")}</FieldLabel>
        <Input
          id="title"
          placeholder={t("form.titlePlaceholder")}
          aria-invalid={errors.title ? true : undefined}
          {...register("title")}
        />
        {errors.title ? <FieldError>{t(errors.title.message ?? "errors.titleMax")}</FieldError> : null}
      </Field>

      <Field>
        <FieldLabel htmlFor="body">{t("form.bodyLabel")}</FieldLabel>
        <textarea
          id="body"
          rows={6}
          placeholder={t("form.bodyPlaceholder")}
          aria-invalid={errors.body ? true : undefined}
          className="border-input bg-background focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
          {...register("body")}
        />
        <FieldDescription>{t("form.bodyHelp")}</FieldDescription>
        {errors.body ? <FieldError>{t(errors.body.message ?? "errors.bodyMin")}</FieldError> : null}
      </Field>

      {serverError ? (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("form.submitting") : t("form.submit")}
        </Button>
        <Link
          href={`/account/bookings/${bookingCode}`}
          className="text-muted-foreground text-sm hover:text-foreground"
        >
          {t("form.back")}
        </Link>
      </div>
    </form>
  );
}
