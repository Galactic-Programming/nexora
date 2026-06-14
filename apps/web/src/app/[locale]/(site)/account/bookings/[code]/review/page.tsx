import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { redirect, Link } from "@/i18n/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncUser } from "@/features/auth/actions";
import { getBookingByCode, type Booking } from "@/lib/api/bookings";
import { ApiError } from "@/lib/api/errors";
import { AccountShell } from "@/features/account/AccountShell";
import { ReviewForm } from "@/features/review/ReviewForm";
import { pickTourTitle, type Locale } from "@/features/bookings-list/format";

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

export default async function WriteReviewPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  setRequestLocale(locale);

  const returnTo = `/account/bookings/${code}/review`;
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
    // 404 (missing) or 403 (not the caller's booking) → can't review it.
    if (ApiError.isApiError(err) && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  }

  const t = await getTranslations("Review");
  const tourTitle = pickTourTitle(booking.tour, locale as Locale);

  // Eligibility gate: only completed (PAID) bookings can be reviewed. Mirrors
  // the backend REVIEW_NOT_ELIGIBLE guard so a non-PAID deep-link is graceful.
  if (booking.status !== "PAID") {
    return (
      <AccountShell active="bookings">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">{t("ineligible.title")}</h2>
          <p className="text-muted-foreground">{t("ineligible.body")}</p>
          <Link
            href={`/account/bookings/${code}`}
            className="text-primary inline-block text-sm hover:underline"
          >
            {t("ineligible.backToBooking")}
          </Link>
        </div>
      </AccountShell>
    );
  }

  return (
    <AccountShell active="bookings">
      <div className="space-y-6">
        <header className="space-y-1">
          <h2 className="text-2xl font-semibold text-foreground">{t("form.title")}</h2>
          <p className="text-muted-foreground">{t("form.subtitle", { tour: tourTitle })}</p>
        </header>
        <ReviewForm bookingCode={code} />
      </div>
    </AccountShell>
  );
}
