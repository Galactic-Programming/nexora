import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncUser } from "@/features/auth/actions";
import { getMyBookings, type Booking } from "@/lib/api/bookings";
import { ApiError } from "@/lib/api/errors";
import { AccountShell } from "@/features/account/AccountShell";
import { BookingsList } from "@/features/bookings-list/BookingsList";
import { mapBookingStatus } from "@/features/bookings-list/status";
import type { Locale } from "@/features/bookings-list/format";

const RETURN_TO = "/account/bookings";

/** Loads the caller's bookings, retrying once if the user isn't mirrored yet. */
async function loadBookings(token: string): Promise<Booking[]> {
  try {
    return await getMyBookings(token);
  } catch (err) {
    if (ApiError.isApiError(err) && err.code === "USER_NOT_SYNCED") {
      await syncUser();
      return await getMyBookings(token);
    }
    throw err;
  }
}

export default async function MyBookingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: { pathname: "/sign-in", query: { returnTo: RETURN_TO } }, locale });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    redirect({ href: { pathname: "/sign-in", query: { returnTo: RETURN_TO } }, locale });
  }
  const accessToken = session!.access_token;

  await syncUser();

  const t = await getTranslations("Bookings");
  const localeTag = locale === "vi" ? "vi-VN" : "en-US";
  const money = (amount: string, currency: string) =>
    new Intl.NumberFormat(localeTag, { style: "currency", currency }).format(Number(amount));

  try {
    const bookings = await loadBookings(accessToken);

    if (bookings.length === 0) {
      return (
        <AccountShell active="bookings">
          <div className="border-border rounded-xl border border-dashed p-10 text-center">
            <p className="text-muted-foreground mb-4">{t("list.empty")}</p>
            <Link href="/tours" className="text-primary text-sm font-medium hover:underline">
              {t("list.browseTours")}
            </Link>
          </div>
        </AccountShell>
      );
    }

    return (
      <AccountShell active="bookings">
        <BookingsList
          bookings={bookings}
          locale={locale as Locale}
          money={money}
          text={{
            statusLabel: (status) => t(mapBookingStatus(status).labelKey),
            seats: (adults, children) =>
              t("list.seats", { adults, children }),
            totalLabel: t("list.total"),
            truncatedNote: t("list.truncatedNote"),
          }}
        />
      </AccountShell>
    );
  } catch (error) {
    console.error("Failed to load bookings", error);
    return (
      <AccountShell active="bookings">
        <div className="border-border rounded-xl border border-dashed p-10 text-center">
          <p className="text-muted-foreground">{t("list.empty")}</p>
        </div>
      </AccountShell>
    );
  }
}
