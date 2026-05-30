/**
 * Database seed — populates the Supabase Postgres with a realistic catalog
 * for local development, Postman runs, and demo screenshots.
 *
 * Idempotency strategy:
 *  - Destinations + Tours: `upsert` keyed by `slug` so re-running the
 *    seed refreshes content without duplicating rows. Existing IDs are
 *    preserved, which matters because Postman scripts cache things like
 *    `tourSlug` between runs.
 *  - Itinerary days: same — `(tourId, dayNumber)` is unique, so we
 *    upsert per (tour, day).
 *  - Departures: no natural unique key (multiple departures can share a
 *    start date), so we `deleteMany` all departures for the seeded
 *    tours first, then `createMany`. The Booking FK is `Restrict`, so
 *    if any seeded tour has a real booking the delete fails loudly —
 *    that's the right behaviour for a dev tool.
 *
 * Run via:
 *   pnpm prisma db seed
 *
 * Or to reset everything and reseed (DESTRUCTIVE — drops all data):
 *   pnpm prisma migrate reset
 *
 * Targets the DB pointed at by DIRECT_URL (Supabase direct port 5432),
 * matching the migration engine — see prisma.config.ts.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { DepartureStatus, PrismaClient, TourCategory } from '@prisma/client';

/**
 * Prisma 7 requires a driver adapter (or another option block) — bare
 * `new PrismaClient()` throws `PrismaClientInitializationError` at
 * construction time. Mirror the runtime wiring from `PrismaService` but
 * point at `DIRECT_URL` (unpooled 5432) — seeding does multiple
 * `deleteMany`/`createMany`/`upsert` round-trips and the Supavisor
 * transaction pooler complicates long-lived sessions.
 */
const connectionString =
  process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '';
if (!connectionString) {
  throw new Error(
    '[seed] missing DIRECT_URL (preferred) or DATABASE_URL in environment',
  );
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// ────────────────────────────────────────────────────────────────────────────
// Seed data
// ────────────────────────────────────────────────────────────────────────────

interface DestinationSeed {
  slug: string;
  nameEn: string;
  nameVi: string;
  country: string;
  region: string;
  heroImage: string;
  descriptionEn: string;
  descriptionVi: string;
}

const DESTINATIONS: DestinationSeed[] = [
  {
    slug: 'hoi-an',
    nameEn: 'Hoi An',
    nameVi: 'Hội An',
    country: 'Vietnam',
    region: 'Central',
    heroImage:
      'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1200&q=80',
    descriptionEn:
      'UNESCO-listed Ancient Town glowing with silk lanterns, riverside cafés, and centuries-old merchant houses.',
    descriptionVi:
      'Phố cổ được UNESCO công nhận, lung linh đèn lồng lụa, quán cafe ven sông và những ngôi nhà cổ hàng trăm năm tuổi.',
  },
  {
    slug: 'ha-noi',
    nameEn: 'Hanoi',
    nameVi: 'Hà Nội',
    country: 'Vietnam',
    region: 'North',
    heroImage:
      'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1200&q=80',
    descriptionEn:
      'A thousand-year-old capital where French colonial boulevards meet bustling motorbike-filled alleys.',
    descriptionVi:
      'Thủ đô nghìn năm tuổi nơi đại lộ kiểu Pháp gặp gỡ những con ngõ rộn ràng xe máy.',
  },
  {
    slug: 'sa-pa',
    nameEn: 'Sapa',
    nameVi: 'Sa Pa',
    country: 'Vietnam',
    region: 'Northwest',
    heroImage:
      'https://images.unsplash.com/photo-1493957988430-a5f2e15f39a3?auto=format&fit=crop&w=1200&q=80',
    descriptionEn:
      'Misty mountain town overlooking emerald rice terraces and home to Vietnam’s highest peak, Fansipan.',
    descriptionVi:
      'Thị trấn núi mờ sương nhìn ra ruộng bậc thang xanh ngắt, quê hương đỉnh Fansipan cao nhất Việt Nam.',
  },
  {
    slug: 'phu-quoc',
    nameEn: 'Phu Quoc',
    nameVi: 'Phú Quốc',
    country: 'Vietnam',
    region: 'South',
    heroImage:
      'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=1200&q=80',
    descriptionEn:
      'Tropical island getaway with white-sand beaches, pepper farms, and Vietnam’s clearest snorkelling waters.',
    descriptionVi:
      'Đảo nhiệt đới với bãi cát trắng, vườn tiêu và làn nước trong nhất Việt Nam để lặn ngắm.',
  },
];

interface TourSeed {
  slug: string;
  destinationSlug: string;
  titleEn: string;
  titleVi: string;
  summaryEn: string;
  summaryVi: string;
  durationDays: number;
  maxGroupSize: number;
  basePrice: number;
  category: TourCategory;
  difficulty?: string;
  isPublished: boolean;
  isFeatured: boolean;
  heroImage: string;
  gallery: string[];
  included: string[];
  excluded: string[];
  meetingPoint: string;
  itinerary?: {
    dayNumber: number;
    titleEn: string;
    titleVi: string;
    descriptionEn: string;
    descriptionVi: string;
  }[];
}

const TOURS: TourSeed[] = [
  {
    slug: 'hoi-an-walking-tour',
    destinationSlug: 'hoi-an',
    titleEn: 'Hoi An Ancient Town Walking Tour',
    titleVi: 'Tour bộ phố cổ Hội An',
    summaryEn: 'Half-day stroll through lantern-lit alleys with a local guide.',
    summaryVi:
      'Tour bộ nửa ngày qua các con hẻm đèn lồng cùng hướng dẫn viên địa phương.',
    durationDays: 1,
    maxGroupSize: 12,
    basePrice: 39,
    category: TourCategory.DAY,
    difficulty: 'easy',
    isPublished: true,
    isFeatured: true,
    heroImage:
      'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=80',
    ],
    included: ['Local guide', 'Bottled water', 'Heritage site entrance'],
    excluded: ['Lunch', 'Personal expenses'],
    meetingPoint: 'Hoi An tourist info centre, 78 Le Loi street',
  },
  {
    slug: 'hoi-an-lantern-night',
    destinationSlug: 'hoi-an',
    titleEn: 'Hoi An Lantern Festival Night',
    titleVi: 'Đêm hội đèn lồng Hội An',
    summaryEn:
      'Evening river cruise with paper lantern release, live traditional music performances, and street food sampling.',
    summaryVi:
      'Du thuyền sông buổi tối với thả đèn hoa đăng, biểu diễn nhạc truyền thống và nếm món ăn đường phố.',
    durationDays: 1,
    maxGroupSize: 20,
    basePrice: 29,
    category: TourCategory.MUSICAL,
    difficulty: 'easy',
    isPublished: true,
    isFeatured: true,
    heroImage:
      'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1200&q=80',
    ],
    included: ['Boat ride', 'Lantern', 'Street food vouchers'],
    excluded: ['Tips'],
    meetingPoint: 'Bach Dang street pier',
  },
  {
    slug: 'hoi-an-cooking-class',
    destinationSlug: 'hoi-an',
    titleEn: 'Hoi An Market & Cooking Class',
    titleVi: 'Chợ quê & Lớp nấu ăn Hội An',
    summaryEn:
      'Morning market tour, basket boat ride, then cook 4 classic Hoi An dishes.',
    summaryVi:
      'Tham quan chợ sáng, chèo thuyền thúng và nấu 4 món Hội An kinh điển.',
    durationDays: 1,
    maxGroupSize: 10,
    basePrice: 59,
    category: TourCategory.DAY,
    difficulty: 'easy',
    // Draft on purpose so the public catalog filters can be tested — this
    // tour MUST NOT appear in GET /tours but MUST appear in /admin/tours.
    isPublished: false,
    isFeatured: false,
    heroImage:
      'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=80',
    gallery: [],
    included: ['Market tour', 'Basket boat', 'Cooking class', 'Lunch'],
    excluded: ['Drinks'],
    meetingPoint: 'Tra Que village entrance',
  },
  {
    slug: 'ha-noi-old-quarter',
    destinationSlug: 'ha-noi',
    titleEn: 'Hanoi Old Quarter Discovery',
    titleVi: 'Khám phá phố cổ Hà Nội',
    summaryEn:
      'Cyclo + walking tour of the 36 streets with a stop at Hoan Kiem Lake.',
    summaryVi: 'Tour xích lô + đi bộ qua 36 phố cổ và dừng tại hồ Hoàn Kiếm.',
    durationDays: 1,
    maxGroupSize: 15,
    basePrice: 35,
    category: TourCategory.DAY,
    difficulty: 'easy',
    isPublished: true,
    isFeatured: false,
    heroImage:
      'https://images.unsplash.com/photo-1555921015-5532091f6026?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?auto=format&fit=crop&w=1200&q=80',
    ],
    included: ['Cyclo ride', 'Local guide', 'Bottled water'],
    excluded: ['Lunch'],
    meetingPoint: 'St Joseph cathedral, Nha Tho street',
  },
  {
    slug: 'ha-long-bay-day-cruise',
    destinationSlug: 'ha-noi',
    titleEn: 'Ha Long Bay Day Cruise from Hanoi',
    titleVi: 'Du thuyền vịnh Hạ Long trong ngày từ Hà Nội',
    summaryEn:
      'Round-trip bus + 4-hour bay cruise with kayaking and seafood lunch.',
    summaryVi:
      'Xe khứ hồi + du thuyền 4 giờ trên vịnh, có chèo kayak và bữa trưa hải sản.',
    durationDays: 1,
    maxGroupSize: 25,
    basePrice: 79,
    category: TourCategory.DAY,
    difficulty: 'easy',
    isPublished: true,
    isFeatured: true,
    heroImage:
      'https://images.unsplash.com/photo-1620625515032-6ed0c1790c75?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1620625515032-6ed0c1790c75?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=1200&q=80',
    ],
    included: ['Coach transfer', 'Boat cruise', 'Kayak', 'Seafood lunch'],
    excluded: ['Tips', 'Drinks beyond water'],
    meetingPoint: 'Hanoi Opera House',
  },
  {
    slug: 'ha-noi-food-tour',
    destinationSlug: 'ha-noi',
    titleEn: 'Hanoi Street Food Walking Tour',
    titleVi: 'Tour ẩm thực đường phố Hà Nội',
    summaryEn:
      'Sample 8+ classic Hanoi dishes with a local food blogger guide.',
    summaryVi: 'Nếm hơn 8 món Hà Nội kinh điển cùng food blogger địa phương.',
    durationDays: 1,
    maxGroupSize: 8,
    basePrice: 45,
    category: TourCategory.DAY,
    difficulty: 'easy',
    isPublished: true,
    isFeatured: false,
    heroImage:
      'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?auto=format&fit=crop&w=1200&q=80',
    gallery: [],
    included: ['All food + drinks', 'Local guide'],
    excluded: ['Tips'],
    meetingPoint: 'Hang Be market entrance',
  },
  {
    slug: 'sa-pa-trek-2d1n',
    destinationSlug: 'sa-pa',
    titleEn: 'Sapa Rice Terrace Trek (2D1N Homestay)',
    titleVi: 'Trekking ruộng bậc thang Sa Pa (2N1Đ homestay)',
    summaryEn:
      'Two-day moderate trek through Cat Cat + Lao Chai villages with a Hmong homestay.',
    summaryVi:
      'Trek 2 ngày mức trung bình qua bản Cát Cát + Lao Chải, ngủ homestay người Mông.',
    durationDays: 2,
    maxGroupSize: 12,
    basePrice: 119,
    category: TourCategory.PACKAGE,
    difficulty: 'moderate',
    isPublished: true,
    isFeatured: true,
    heroImage:
      'https://images.unsplash.com/photo-1493957988430-a5f2e15f39a3?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1493957988430-a5f2e15f39a3?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80',
    ],
    included: ['Guide', 'Homestay night', '3 meals', 'Insurance'],
    excluded: ['Personal trekking gear', 'Drinks'],
    meetingPoint: 'Sapa central square',
    itinerary: [
      {
        dayNumber: 1,
        titleEn: 'Cat Cat Village & Muong Hoa Valley',
        titleVi: 'Bản Cát Cát & Thung lũng Mường Hoa',
        descriptionEn:
          'Morning trek into Cat Cat village to meet Hmong artisans, then descend into Muong Hoa rice terraces. Lunch at a local family home. Arrive at the Lao Chai homestay by 16:00 for tea and dinner.',
        descriptionVi:
          'Buổi sáng trek vào bản Cát Cát gặp nghệ nhân Mông, sau đó xuống thung lũng ruộng bậc thang Mường Hoa. Ăn trưa tại nhà dân. Đến homestay Lao Chải lúc 16:00 dùng trà và ăn tối.',
      },
      {
        dayNumber: 2,
        titleEn: 'Ta Van Ridge & return',
        titleVi: 'Sống núi Tả Van & quay về',
        descriptionEn:
          'Sunrise trek up the Ta Van ridge for panoramic terrace views. Breakfast at the homestay, then descend through Giang Ta Chai village back to Sapa town by 14:00.',
        descriptionVi:
          'Trek lúc bình minh lên sống núi Tả Van ngắm toàn cảnh ruộng bậc thang. Ăn sáng tại homestay, sau đó xuống bản Giàng Tà Chải về Sa Pa lúc 14:00.',
      },
    ],
  },
  {
    slug: 'sa-pa-fansipan-cable',
    destinationSlug: 'sa-pa',
    titleEn: 'Fansipan Summit by Cable Car',
    titleVi: 'Chinh phục Fansipan bằng cáp treo',
    summaryEn:
      'Half-day cable car ride to Indochina’s highest peak with summit time included.',
    summaryVi:
      'Đi cáp treo nửa ngày lên đỉnh cao nhất Đông Dương, có thời gian ở đỉnh.',
    durationDays: 1,
    maxGroupSize: 20,
    basePrice: 65,
    category: TourCategory.DAY,
    difficulty: 'easy',
    isPublished: true,
    isFeatured: false,
    heroImage:
      'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80',
    gallery: [],
    included: ['Cable car ticket', 'Funicular', 'Guide'],
    excluded: ['Meals'],
    meetingPoint: 'Sapa cable car station',
  },
  {
    slug: 'phu-quoc-island-hopping',
    destinationSlug: 'phu-quoc',
    titleEn: 'Phu Quoc 3-Island Snorkelling',
    titleVi: 'Tour 3 đảo lặn ngắm san hô Phú Quốc',
    summaryEn:
      'Full-day speedboat tour of An Thoi archipelago with two snorkel stops and BBQ lunch.',
    summaryVi:
      'Tour cano cả ngày quần đảo An Thới, 2 điểm lặn ngắm san hô và bữa trưa BBQ.',
    durationDays: 1,
    maxGroupSize: 18,
    basePrice: 49,
    category: TourCategory.DAY,
    difficulty: 'easy',
    isPublished: true,
    isFeatured: true,
    heroImage:
      'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80',
    ],
    included: ['Speedboat', 'Snorkel gear', 'BBQ lunch', 'Insurance'],
    excluded: ['Drinks', 'Underwater camera rental'],
    meetingPoint: 'An Thoi port',
  },
  {
    slug: 'phu-quoc-sunset-cruise',
    destinationSlug: 'phu-quoc',
    titleEn: 'Phu Quoc Romantic Sunset Sail',
    titleVi: 'Du thuyền hoàng hôn lãng mạn Phú Quốc',
    summaryEn:
      'Private-feel sunset sail along the west coast with sparkling wine, tapas, and a couples-friendly itinerary.',
    summaryVi:
      'Du thuyền hoàng hôn riêng tư dọc bờ tây cùng vang sủi, đồ ăn nhẹ, lịch trình thân thiện cho cặp đôi.',
    durationDays: 1,
    maxGroupSize: 16,
    basePrice: 55,
    category: TourCategory.HONEYMOON,
    difficulty: 'easy',
    isPublished: true,
    isFeatured: true,
    heroImage:
      'https://images.unsplash.com/photo-1493780474015-ba834fd0ce2f?auto=format&fit=crop&w=1200&q=80',
    gallery: [],
    included: ['Sailing boat', 'Sparkling wine', 'Tapas', 'Guide'],
    excluded: ['Tips'],
    meetingPoint: 'Duong Dong harbour pier 3',
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Returns a date at 00:00:00 UTC, `daysAhead` days from today. Used to
 * stamp departure start/end dates relative to wherever "today" is when
 * the seed runs — so the catalog always shows upcoming dates regardless
 * of when you reseed.
 */
function dateOffset(daysAhead: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysAhead,
    ),
  );
}

/**
 * Builds 3 departures per tour with realistic spread:
 *  - +30 days → OPEN  (close enough that the FE date picker shows it)
 *  - +75 days → OPEN  (mid-term)
 *  - +150 days → OPEN (long-term planning)
 *
 * For multi-day tours (`durationDays > 1`), `endDate` is offset
 * accordingly. For single-day tours `startDate === endDate` (allowed
 * by the schema; `endDate < startDate` is the only invalid case).
 *
 * Seats: 60% of `maxGroupSize` rounded up, leaving headroom for the
 * Postman booking flow (B3) to fill without immediately closing.
 */
function buildDepartures(
  tourId: string,
  maxGroupSize: number,
  durationDays: number,
): Array<{
  tourId: string;
  startDate: Date;
  endDate: Date;
  seatsTotal: number;
  status: DepartureStatus;
}> {
  const seatsTotal = Math.max(5, Math.ceil(maxGroupSize * 0.6));
  // `durationDays = 1` → same start/end. `durationDays = 2` → end is +1 day.
  const dayLength = Math.max(0, durationDays - 1);

  return [30, 75, 150].map((daysAhead) => ({
    tourId,
    startDate: dateOffset(daysAhead),
    endDate: dateOffset(daysAhead + dayLength),
    seatsTotal,
    status: DepartureStatus.OPEN,
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('[seed] connecting to DB...');

  // 1. Destinations — upsert by slug.
  console.log(`[seed] upserting ${DESTINATIONS.length} destinations...`);
  const destinationIdBySlug = new Map<string, string>();
  for (const d of DESTINATIONS) {
    const row = await prisma.destination.upsert({
      where: { slug: d.slug },
      create: { ...d, isActive: true },
      update: {
        nameEn: d.nameEn,
        nameVi: d.nameVi,
        country: d.country,
        region: d.region,
        heroImage: d.heroImage,
        descriptionEn: d.descriptionEn,
        descriptionVi: d.descriptionVi,
        isActive: true,
      },
    });
    destinationIdBySlug.set(d.slug, row.id);
  }

  // 2. Tours — upsert by slug. Carries itinerary for one tour.
  console.log(`[seed] upserting ${TOURS.length} tours...`);
  const tourIdBySlug = new Map<string, string>();
  for (const t of TOURS) {
    const destinationId = destinationIdBySlug.get(t.destinationSlug);
    if (!destinationId) {
      throw new Error(
        `[seed] tour "${t.slug}" references unknown destination "${t.destinationSlug}"`,
      );
    }

    const data = {
      titleEn: t.titleEn,
      titleVi: t.titleVi,
      summaryEn: t.summaryEn,
      summaryVi: t.summaryVi,
      destinationId,
      durationDays: t.durationDays,
      maxGroupSize: t.maxGroupSize,
      basePrice: t.basePrice,
      currency: 'USD',
      category: t.category,
      difficulty: t.difficulty,
      isPublished: t.isPublished,
      isFeatured: t.isFeatured,
      heroImage: t.heroImage,
      gallery: t.gallery,
      included: t.included,
      excluded: t.excluded,
      meetingPoint: t.meetingPoint,
    };
    const row = await prisma.tour.upsert({
      where: { slug: t.slug },
      create: { ...data, slug: t.slug },
      update: data,
    });
    tourIdBySlug.set(t.slug, row.id);

    // Itinerary — upsert each day individually (unique on tourId+dayNumber).
    if (t.itinerary && t.itinerary.length > 0) {
      for (const day of t.itinerary) {
        await prisma.tourItineraryDay.upsert({
          where: {
            tourId_dayNumber: { tourId: row.id, dayNumber: day.dayNumber },
          },
          create: {
            tourId: row.id,
            dayNumber: day.dayNumber,
            titleEn: day.titleEn,
            titleVi: day.titleVi,
            descriptionEn: day.descriptionEn,
            descriptionVi: day.descriptionVi,
          },
          update: {
            titleEn: day.titleEn,
            titleVi: day.titleVi,
            descriptionEn: day.descriptionEn,
            descriptionVi: day.descriptionVi,
          },
        });
      }
    }
  }

  // 3. Departures — reset + recreate for seeded tours.
  //
  // We can't upsert here (no natural unique key — multiple departures can
  // share a start date), so we clear and re-insert. The Booking FK is
  // Restrict, so this will fail loudly if a seeded tour already has a
  // real booking — which is the right behaviour, surfacing the conflict
  // instead of silently leaving stale departures around.
  const tourIds = Array.from(tourIdBySlug.values());
  const departures = TOURS.flatMap((t) => {
    const id = tourIdBySlug.get(t.slug);
    if (!id) return [];
    return buildDepartures(id, t.maxGroupSize, t.durationDays);
  });

  // Reset departures only for tours that have no bookings yet — wiping
  // a departure with an FK-referencing booking violates the constraint
  // and aborts the whole seed (we already saw this in real testing).
  // Tours with live bookings keep their existing departures untouched.
  const tourIdsWithBookings = new Set(
    (
      await prisma.booking.findMany({
        where: { tourId: { in: tourIds } },
        select: { tourId: true },
        distinct: ['tourId'],
      })
    ).map((b) => b.tourId),
  );
  const resettableTourIds = tourIds.filter(
    (id) => !tourIdsWithBookings.has(id),
  );
  const resettableDepartures = departures.filter((d) =>
    resettableTourIds.includes(d.tourId),
  );

  console.log(
    `[seed] resetting departures for ${resettableTourIds.length}/${tourIds.length} tours ` +
      `(${tourIdsWithBookings.size} have live bookings, keeping their departures); ` +
      `inserting ${resettableDepartures.length} new rows...`,
  );
  await prisma.tourDeparture.deleteMany({
    where: { tourId: { in: resettableTourIds } },
  });
  await prisma.tourDeparture.createMany({ data: resettableDepartures });

  console.log('[seed] done.');
}

main()
  .catch((err: unknown) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
