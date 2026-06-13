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
import { Button } from "@tourism/ui/components/custom/button-custom";
import { Alert, AlertDescription } from "@tourism/ui/components/custom/alert-custom";
import { PhoneInput } from "@tourism/ui/components/custom/phone-input";
import type { DepartureVM } from "@/features/tour-detail/detail-view-model";
import { bookingSchema, type BookingValues } from "./schema";
import { computeTotal } from "./pricing";
import { mapBookingError } from "./booking-error";
import { createBooking } from "./actions";

export interface BookingFormProps {
  tourSlug: string;
  currency: string;
  departures: DepartureVM[];
  preselectId: string | null;
  profile: { fullName: string | null; email: string; phone: string | null };
}

export function BookingForm({
  tourSlug,
  currency,
  departures,
  preselectId,
  profile,
}: BookingFormProps) {
  const t = useTranslations("Booking");
  const locale = useLocale();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BookingValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      departureId: preselectId ?? "",
      numAdults: 1,
      numChildren: 0,
      contactName: profile.fullName ?? "",
      contactEmail: profile.email,
      contactPhone: profile.phone ?? "",
      specialRequests: "",
    },
  });

  const [departureId, numAdults, numChildren] = watch([
    "departureId",
    "numAdults",
    "numChildren",
  ]);
  const selected = departures.find((d) => d.id === departureId) ?? null;

  const localeTag = locale === "vi" ? "vi-VN" : "en-US";

  const money = (n: number) =>
    new Intl.NumberFormat(localeTag, { style: "currency", currency }).format(n);

  const day = (d: string) =>
    new Intl.DateTimeFormat(localeTag, { dateStyle: "medium" }).format(
      new Date(d.length === 10 ? `${d}T00:00:00` : d),
    );

  const total =
    selected ? computeTotal(selected.price, numAdults || 0, numChildren || 0) : null;

  async function onSubmit(values: BookingValues) {
    setServerError(null);
    const res = await createBooking(tourSlug, values);
    if (!res.ok) {
      setServerError(t(mapBookingError(res.code)));
      return;
    }
    // Stripe's success URL only carries session_id — keep the code locally
    // so /checkout/success can poll the booking (backend-intended design).
    window.sessionStorage.setItem("booking:lastCode", res.bookingCode);
    window.location.assign(res.checkoutUrl);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-xl">
      <FieldGroup className="gap-5">
        {serverError ? (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        {/* Departure selection */}
        <Field className="gap-2">
          <FieldLabel htmlFor="departure-group">{t("form.departureLabel")}</FieldLabel>
          <Controller
            control={control}
            name="departureId"
            render={({ field }) => (
              <div id="departure-group" role="radiogroup" className="flex flex-col gap-2">
                {departures.map((d) => (
                  <label
                    key={d.id}
                    className={`border-border flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 ${
                      field.value === d.id ? "border-primary ring-ring ring-1" : ""
                    } ${d.soldOut ? "opacity-50" : ""}`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name={field.name}
                        value={d.id}
                        checked={field.value === d.id}
                        onChange={() => field.onChange(d.id)}
                        disabled={d.soldOut}
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          {day(d.startDate)} → {day(d.endDate)}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {d.soldOut
                            ? t("form.soldOut")
                            : t("form.seatsLeft", { count: d.seatsLeft })}
                        </span>
                      </span>
                    </span>
                    <span className="text-sm font-semibold">{money(d.price)}</span>
                  </label>
                ))}
              </div>
            )}
          />
          {errors.departureId?.message ? (
            <FieldError>{t(errors.departureId.message)}</FieldError>
          ) : null}
        </Field>

        {/* Pax counts */}
        <div className="grid grid-cols-2 gap-4">
          <Field className="gap-2">
            <FieldLabel htmlFor="numAdults">{t("form.adults")}</FieldLabel>
            <Input
              id="numAdults"
              type="number"
              min={1}
              max={20}
              {...register("numAdults", { valueAsNumber: true })}
            />
            {errors.numAdults?.message ? (
              <FieldError>{t(errors.numAdults.message)}</FieldError>
            ) : null}
          </Field>
          <Field className="gap-2">
            <FieldLabel htmlFor="numChildren">{t("form.children")}</FieldLabel>
            <Input
              id="numChildren"
              type="number"
              min={0}
              max={20}
              {...register("numChildren", { valueAsNumber: true })}
            />
            {errors.numChildren?.message ? (
              <FieldError>{t(errors.numChildren.message)}</FieldError>
            ) : null}
          </Field>
        </div>

        {/* Contact details */}
        <Field className="gap-2">
          <FieldLabel htmlFor="contactName">{t("form.contactName")}</FieldLabel>
          <Input
            id="contactName"
            autoComplete="name"
            aria-invalid={!!errors.contactName}
            {...register("contactName")}
          />
          {errors.contactName?.message ? (
            <FieldError>{t(errors.contactName.message)}</FieldError>
          ) : null}
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor="contactEmail">{t("form.contactEmail")}</FieldLabel>
          <Input
            id="contactEmail"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.contactEmail}
            {...register("contactEmail")}
          />
          {errors.contactEmail?.message ? (
            <FieldError>{t(errors.contactEmail.message)}</FieldError>
          ) : null}
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor="contactPhone">{t("form.contactPhone")}</FieldLabel>
          <Controller
            control={control}
            name="contactPhone"
            render={({ field }) => (
              <PhoneInput
                id="contactPhone"
                value={field.value || undefined}
                onChange={(v) => field.onChange(v ?? "")}
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.contactPhone?.message ? (
            <FieldError>{t(errors.contactPhone.message)}</FieldError>
          ) : null}
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor="specialRequests">{t("form.specialRequests")}</FieldLabel>
          <Input id="specialRequests" {...register("specialRequests")} />
          {errors.specialRequests?.message ? (
            <FieldError>{t(errors.specialRequests.message)}</FieldError>
          ) : null}
        </Field>

        {/* Running total */}
        {total !== null ? (
          <div className="border-border rounded-xl border px-4 py-3">
            <p className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("form.total")}</span>
              <span className="text-lg font-semibold">{money(total)}</span>
            </p>
            <FieldDescription>{t("form.totalNote")}</FieldDescription>
          </div>
        ) : null}

        {/* Submit */}
        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("form.submitting") : t("form.submit")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
