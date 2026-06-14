import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncUser } from "@/features/auth/actions";
import { getBookingByCode, type Booking } from "@/lib/api/bookings";
import { ApiError } from "@/lib/api/errors";
import { AccountShell } from "@/features/account/AccountShell";
import { BookingDetail } from "@/features/bookings-list/BookingDetail";
import { mapBookingStatus } from "@/features/bookings-list/status";
import type { Locale } from "@/features/bookings-list/format";

/** Loads one booking by code, retrying once if the user isn't mirrored yet. */
async function loadBooking(token: string, code: string): Promise<Booking> {
  try {
    return await getBookingByCode(token, code);
  } catch (err) {
    if (ApiError.isApiError(err) && err.code === "USER_NOT_SYNCED") {
      await syncUser();
      return await getBookingByCode(token, code);
    }
    throw err;
  }
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  setRequestLocale(locale);

  const returnTo = `/account/bookings/${code}`;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: { pathname: "/sign-in", query: { returnTo } }, locale });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    redirect({ href: { pathname: "/sign-in", query: { returnTo } }, locale });
  }
  const accessToken = session!.access_token;

  await syncUser();

  let booking: Booking;
  try {
    booking = await loadBooking(accessToken, code);
  } catch (err) {
    // Owner-or-admin scoping is enforced server-side; not-owned collapses into
    // BOOKING_NOT_FOUND (404), so a customer can never read another's booking.
    if (ApiError.isApiError(err) && err.status === 404) notFound();
    throw err;
  }

  const t = await getTranslations("Bookings");
  const localeTag = locale === "vi" ? "vi-VN" : "en-US";
  const money = (amount: string, currency: string) =>
    new Intl.NumberFormat(localeTag, { style: "currency", currency }).format(Number(amount));
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(localeTag, { dateStyle: "medium" }).format(new Date(iso));

  const statusView = mapBookingStatus(booking.status);

  return (
    <AccountShell active="bookings">
      <BookingDetail
        booking={booking}
        locale={locale as Locale}
        money={money}
        formatDate={formatDate}
        text={{
          back: t("detail.back"),
          statusLabel: t(statusView.labelKey),
          statusNote: t(`status.note.${booking.status.toLowerCase()}`),
          seats: t("list.seats", { adults: booking.numAdults, children: booking.numChildren }),
          viewTour: t("detail.viewTour"),
          labels: {
            departure: t("detail.departure"),
            travelers: t("detail.seats"),
            total: t("detail.totalPaid"),
            contact: t("detail.name"),
            email: t("detail.email"),
            phone: t("detail.phone"),
            specialRequests: t("detail.specialRequests"),
            paidAt: t("detail.paidAt"),
            cancelledAt: t("detail.cancelledAt"),
          },
        }}
      />
    </AccountShell>
  );
}
