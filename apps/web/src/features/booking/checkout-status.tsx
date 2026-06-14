"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@tourism/ui/components/custom/alert-custom";
import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";
import { getBookingStatus, type BookingStatusResult } from "./actions";
import { nextPollState, POLL_INTERVAL_MS, type PollState } from "./poll";

const STORAGE_KEY = "booking:lastCode";

export function CheckoutStatus() {
  const t = useTranslations("Booking");
  const locale = useLocale();
  const [state, setState] = useState<PollState | { kind: "loading" }>({
    kind: "loading",
  });
  const [booking, setBooking] = useState<
    Extract<BookingStatusResult, { ok: true }>["booking"] | null
  >(null);
  const startedAt = useRef<number>(Date.now());
  const retries = useRef(0);

  useEffect(() => {
    const code = window.sessionStorage.getItem(STORAGE_KEY);
    if (!code) {
      setState({ kind: "fallback" });
      return;
    }
    let cancelled = false;

    async function tick() {
      const result = await getBookingStatus(code!);
      if (cancelled) return;
      if (result.ok) setBooking(result.booking);
      const next = nextPollState(
        result.ok ? { ok: true, status: result.status } : { ok: false },
        Date.now() - startedAt.current,
        retries.current,
      );
      if (next.kind === "polling") {
        retries.current = next.retries ?? retries.current;
        setState(next);
        setTimeout(() => void tick(), POLL_INTERVAL_MS);
        return;
      }
      if (next.kind === "paid") window.sessionStorage.removeItem(STORAGE_KEY);
      setState(next);
    }
    void tick();
    return () => {
      cancelled = true;
    };
  }, []);

  const localeTag = locale === "vi" ? "vi-VN" : "en-US";
  const money = (amount: string, currency: string) =>
    new Intl.NumberFormat(localeTag, { style: "currency", currency }).format(
      Number(amount),
    );

  if (state.kind === "loading" || state.kind === "polling") {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <p className="text-lg font-medium">{t("success.processing")}</p>
        <ShimmerSkeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (state.kind === "paid" && booking) {
    return (
      <div className="space-y-4">
        <h2 className="font-heading text-2xl font-semibold">
          {t("success.paidTitle")}
        </h2>
        <p className="text-muted-foreground">{t("success.paidBody")}</p>
        <dl className="border-border grid gap-2 rounded-xl border p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("success.code")}</dt>
            <dd className="font-mono font-semibold">{booking.code}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              {t("success.seats", {
                adults: booking.numAdults,
                children: booking.numChildren,
              })}
            </dt>
            <dd />
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("success.total")}</dt>
            <dd className="font-semibold">
              {money(booking.totalAmount, booking.currency)}
            </dd>
          </div>
        </dl>
        <Link href={`/account/bookings/${booking.code}`} className="underline">
          {t("success.viewBooking")}
        </Link>
      </div>
    );
  }

  const messageKey =
    state.kind === "timeout"
      ? "success.timeout"
      : state.kind === "expired"
        ? "success.expired"
        : state.kind === "refunded"
          ? "success.refunded"
          : "success.missingCode";

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>{t(messageKey)}</AlertTitle>
        <AlertDescription>
          <Link href="/account/bookings" className="underline">
            {t("success.viewBookings")}
          </Link>
        </AlertDescription>
      </Alert>
    </div>
  );
}
