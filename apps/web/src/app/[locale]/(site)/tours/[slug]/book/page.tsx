import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncUser } from "@/features/auth/actions";
import { getMe } from "@/lib/api/users";
import { ApiError } from "@/lib/api/errors";
import { getTour, getTourDepartures, type TourDetail, type Departure } from "@/lib/api/tours";
import { toDepartureModel } from "@/features/tour-detail/detail-view-model";
import { BookingForm } from "@/features/booking/booking-form";

/** Fetches the signed-in user's profile with a single retry on USER_NOT_SYNCED. */
async function loadProfile(token: string) {
  try {
    return await getMe(token);
  } catch (err) {
    if (ApiError.isApiError(err) && err.code === "USER_NOT_SYNCED") {
      await syncUser();
      return await getMe(token);
    }
    throw err;
  }
}

export default async function BookTourPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ departure?: string }>;
}) {
  const { locale, slug } = await params;
  const { departure } = await searchParams;
  setRequestLocale(locale);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const returnTo = `/tours/${slug}/book${departure ? `?departure=${departure}` : ""}`;
    redirect({ href: { pathname: "/sign-in", query: { returnTo } }, locale });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect({
      href: { pathname: "/sign-in", query: { returnTo: `/tours/${slug}/book` } },
      locale,
    });
  }

  // redirect() returns `never`; non-null assertion is safe — we never reach
  // this point when session is null.
  const accessToken = session!.access_token;

  await syncUser();

  const t = await getTranslations("Booking");

  // Tour + departures failing means the tour is gone → 404.
  let tour: TourDetail;
  let departures: Departure[];
  try {
    [tour, departures] = await Promise.all([getTour(slug), getTourDepartures(slug)]);
  } catch {
    notFound();
  }

  // Profile load is auth-domain — use the sync-retry helper.
  const profile = await loadProfile(accessToken);

  const models = departures.map((d) => toDepartureModel(d, tour, locale));
  const preselectId =
    departure && models.some((m) => m.id === departure) ? departure : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-semibold">{t("form.title")}</h1>
        <p className="text-muted-foreground mt-1">
          {locale === "vi" ? tour.titleVi : tour.titleEn}
        </p>
      </header>
      {models.length === 0 ? (
        <div className="space-y-4">
          <p className="text-muted-foreground">{t("form.empty")}</p>
          <Link href={`/tours/${slug}`} className="underline">
            {t("form.backToTour")}
          </Link>
        </div>
      ) : (
        <BookingForm
          tourSlug={slug}
          currency={tour.currency}
          departures={models}
          preselectId={preselectId}
          profile={{ fullName: profile.fullName, email: profile.email, phone: profile.phone }}
        />
      )}
    </main>
  );
}
