import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Booking,
  BookingStatus,
  DepartureStatus,
  Prisma,
  TourDeparture,
  UserRole,
} from '@prisma/client';
import { EmailService } from '../email/email.service';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { StripeService } from '../payments/stripe.service';

const makeEmail = (): EmailService =>
  ({
    sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
    sendBookingRefunded: jest.fn().mockResolvedValue(undefined),
  }) as unknown as EmailService;

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterAll(() => {
  jest.restoreAllMocks();
});

const sampleTour = {
  id: 't-1',
  slug: 'hoi-an-walking-tour',
  titleEn: 'Hoi An Walking Tour',
  currency: 'USD',
  basePrice: new Prisma.Decimal('49.50'),
};

const sampleDeparture: TourDeparture = {
  id: 'dep-1',
  tourId: 't-1',
  startDate: new Date('2026-08-15T00:00:00Z'),
  endDate: new Date('2026-08-15T00:00:00Z'),
  priceOverride: null,
  seatsTotal: 15,
  seatsBooked: 2,
  status: DepartureStatus.OPEN,
  createdAt: new Date('2026-05-08T00:00:00Z'),
  updatedAt: new Date('2026-05-08T00:00:00Z'),
};

const sampleBooking: Booking = {
  id: 'b-1',
  code: 'BK-ABCDEFGH',
  userId: 'u-customer',
  tourId: 't-1',
  departureId: 'dep-1',
  numAdults: 2,
  numChildren: 1,
  totalAmount: new Prisma.Decimal('148.50'),
  currency: 'USD',
  status: BookingStatus.PENDING,
  contactName: 'Test User',
  contactEmail: 'test@example.com',
  contactPhone: null,
  specialRequests: null,
  stripeSessionId: null,
  stripePaymentIntentId: null,
  refundReason: null,
  refundedById: null,
  paidAt: null,
  cancelledAt: null,
  createdAt: new Date('2026-05-12T00:00:00Z'),
  updatedAt: new Date('2026-05-12T00:00:00Z'),
};

const baseDto: CreateBookingDto = {
  tourSlug: 'hoi-an-walking-tour',
  departureId: 'dep-1',
  numAdults: 2,
  numChildren: 1,
  contactName: 'Test User',
  contactEmail: 'test@example.com',
};

function makePrisma(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    tour: {
      findFirst: overrides.tourFindFirst ?? jest.fn(),
    },
    tourDeparture: {
      findFirst: overrides.depFindFirst ?? jest.fn(),
    },
    booking: {
      findUnique: overrides.bookingFindUnique ?? jest.fn(),
      findMany: overrides.bookingFindMany ?? jest.fn(),
      create: overrides.bookingCreate ?? jest.fn(),
      update: overrides.bookingUpdate ?? jest.fn(),
      delete: overrides.bookingDelete ?? jest.fn(),
    },
  };
}

function makeStripe(
  createCheckoutSession: jest.Mock = jest.fn().mockResolvedValue({
    id: 'cs_test_123',
    url: 'https://checkout.stripe.com/c/pay/cs_test_123',
  }),
): StripeService {
  return { createCheckoutSession } as unknown as StripeService;
}

function makeConfig(
  values: Record<string, string> = {
    'app.frontendUrl': 'http://localhost:3001',
  },
): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => {
      const v = values[key];
      if (v === undefined) throw new Error(`missing config: ${key}`);
      return v;
    }),
  } as unknown as ConfigService;
}

describe('BookingsService.create', () => {
  it('rejects TOUR_NOT_FOUND when slug missing or unpublished', async () => {
    const tourFindFirst = jest.fn().mockResolvedValue(null);
    const bookingCreate = jest.fn();
    const prisma = makePrisma({ tourFindFirst, bookingCreate });
    const svc = new BookingsService(
      prisma as never,
      makeStripe(),
      makeConfig(),
      makeEmail(),
    );

    await expect(svc.create('u-customer', baseDto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('rejects DEPARTURE_NOT_OPEN when departure status is CLOSED', async () => {
    const tourFindFirst = jest.fn().mockResolvedValue(sampleTour);
    const depFindFirst = jest.fn().mockResolvedValue({
      ...sampleDeparture,
      status: DepartureStatus.CLOSED,
    });
    const bookingCreate = jest.fn();
    const prisma = makePrisma({ tourFindFirst, depFindFirst, bookingCreate });
    const svc = new BookingsService(
      prisma as never,
      makeStripe(),
      makeConfig(),
      makeEmail(),
    );

    await expect(svc.create('u-customer', baseDto)).rejects.toMatchObject({
      response: { code: 'DEPARTURE_NOT_OPEN' },
    });
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('rejects DEPARTURE_DEPARTED when startDate is in the past (even if OPEN)', async () => {
    const tourFindFirst = jest.fn().mockResolvedValue(sampleTour);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const depFindFirst = jest.fn().mockResolvedValue({
      ...sampleDeparture,
      startDate: yesterday,
      endDate: yesterday,
    });
    const bookingCreate = jest.fn();
    const prisma = makePrisma({ tourFindFirst, depFindFirst, bookingCreate });
    const svc = new BookingsService(
      prisma as never,
      makeStripe(),
      makeConfig(),
      makeEmail(),
    );

    await expect(svc.create('u-customer', baseDto)).rejects.toMatchObject({
      response: { code: 'DEPARTURE_DEPARTED' },
    });
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('allows booking a departure that starts TODAY (same-day is bookable)', async () => {
    const tourFindFirst = jest.fn().mockResolvedValue(sampleTour);
    const todayMidday = new Date();
    todayMidday.setHours(12, 0, 0, 0);
    const depFindFirst = jest.fn().mockResolvedValue({
      ...sampleDeparture,
      startDate: todayMidday,
      endDate: todayMidday,
    });
    const bookingCreate = jest.fn().mockResolvedValue(sampleBooking);
    const bookingUpdate = jest.fn().mockResolvedValue(sampleBooking);
    const prisma = makePrisma({
      tourFindFirst,
      depFindFirst,
      bookingCreate,
      bookingUpdate,
    });
    const svc = new BookingsService(
      prisma as never,
      makeStripe(),
      makeConfig(),
      makeEmail(),
    );

    const result = await svc.create('u-customer', baseDto);
    expect(result.checkoutUrl).toContain('checkout.stripe.com');
    expect(bookingCreate).toHaveBeenCalled();
  });

  it('deletes the orphan PENDING booking and rethrows when Stripe session creation fails', async () => {
    const tourFindFirst = jest.fn().mockResolvedValue(sampleTour);
    const depFindFirst = jest.fn().mockResolvedValue(sampleDeparture);
    const bookingCreate = jest.fn().mockResolvedValue(sampleBooking);
    const bookingDelete = jest.fn().mockResolvedValue(sampleBooking);
    const prisma = makePrisma({
      tourFindFirst,
      depFindFirst,
      bookingCreate,
      bookingDelete,
    });
    const stripeFail = jest.fn().mockRejectedValue(new Error('stripe is down'));
    const svc = new BookingsService(
      prisma as never,
      makeStripe(stripeFail),
      makeConfig(),
      makeEmail(),
    );

    await expect(svc.create('u-customer', baseDto)).rejects.toThrow(
      'stripe is down',
    );
    expect(bookingDelete).toHaveBeenCalledWith({
      where: { id: sampleBooking.id },
    });
  });

  it('rejects SEATS_NOT_AVAILABLE when remaining < requested', async () => {
    const tourFindFirst = jest.fn().mockResolvedValue(sampleTour);
    // 15 total - 14 booked = 1 remaining, but dto requests 3 (2+1).
    const depFindFirst = jest
      .fn()
      .mockResolvedValue({ ...sampleDeparture, seatsBooked: 14 });
    const bookingCreate = jest.fn();
    const prisma = makePrisma({ tourFindFirst, depFindFirst, bookingCreate });
    const svc = new BookingsService(
      prisma as never,
      makeStripe(),
      makeConfig(),
      makeEmail(),
    );

    await expect(svc.create('u-customer', baseDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(svc.create('u-customer', baseDto)).rejects.toMatchObject({
      response: { code: 'SEATS_NOT_AVAILABLE' },
    });
  });

  it('computes total = unitPrice * (adults+children) and uses priceOverride when set', async () => {
    const tourFindFirst = jest.fn().mockResolvedValue(sampleTour);
    // priceOverride supersedes tour.basePrice.
    const depFindFirst = jest.fn().mockResolvedValue({
      ...sampleDeparture,
      priceOverride: new Prisma.Decimal('60.00'),
    });
    const bookingFindUnique = jest.fn().mockResolvedValue(null);
    const bookingCreate = jest.fn().mockResolvedValue(sampleBooking);
    const bookingUpdate = jest.fn().mockResolvedValue(sampleBooking);
    const createCheckoutSession = jest.fn().mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/x',
    });
    const prisma = makePrisma({
      tourFindFirst,
      depFindFirst,
      bookingFindUnique,
      bookingCreate,
      bookingUpdate,
    });
    const svc = new BookingsService(
      prisma as never,
      makeStripe(createCheckoutSession),
      makeConfig(),
      makeEmail(),
    );

    await svc.create('u-customer', baseDto);

    // 3 seats × $60 = $180.00 → totalAmount stored as Decimal.
    type CreateCall = {
      data: { totalAmount: Prisma.Decimal; currency: string };
    };
    const calls = bookingCreate.mock.calls as unknown as CreateCall[][];
    const arg = calls[0][0];
    expect(arg.data.totalAmount.toString()).toBe('180');
    expect(arg.data.currency).toBe('USD');

    // Stripe gets unit_amount in cents: 60.00 * 100 = 6000, quantity = 3.
    type StripeCall = {
      unitAmount: number;
      quantity: number;
      bookingCode: string;
    };
    const stripeCalls = createCheckoutSession.mock
      .calls as unknown as StripeCall[][];
    const stripeArg = stripeCalls[0][0];
    expect(stripeArg.unitAmount).toBe(6000);
    expect(stripeArg.quantity).toBe(3);
    expect(stripeArg.bookingCode).toBe(sampleBooking.code);
  });

  it('persists stripeSessionId after Stripe returns the session', async () => {
    const tourFindFirst = jest.fn().mockResolvedValue(sampleTour);
    const depFindFirst = jest.fn().mockResolvedValue(sampleDeparture);
    const bookingFindUnique = jest.fn().mockResolvedValue(null);
    const bookingCreate = jest.fn().mockResolvedValue(sampleBooking);
    const bookingUpdate = jest.fn().mockResolvedValue(sampleBooking);
    const prisma = makePrisma({
      tourFindFirst,
      depFindFirst,
      bookingFindUnique,
      bookingCreate,
      bookingUpdate,
    });
    const svc = new BookingsService(
      prisma as never,
      makeStripe(),
      makeConfig(),
      makeEmail(),
    );

    const result = await svc.create('u-customer', baseDto);

    expect(result.checkoutUrl).toBe(
      'https://checkout.stripe.com/c/pay/cs_test_123',
    );
    expect(result.status).toBe(BookingStatus.PENDING);
    // The follow-up update writes back the session id.
    type UpdateCall = { data: { stripeSessionId: string } };
    const updateCalls = bookingUpdate.mock.calls as unknown as UpdateCall[][];
    expect(updateCalls[0][0].data.stripeSessionId).toBe('cs_test_123');
  });

  it('rejects when Stripe returns a session without a URL', async () => {
    const tourFindFirst = jest.fn().mockResolvedValue(sampleTour);
    const depFindFirst = jest.fn().mockResolvedValue(sampleDeparture);
    const bookingFindUnique = jest.fn().mockResolvedValue(null);
    const bookingCreate = jest.fn().mockResolvedValue(sampleBooking);
    const prisma = makePrisma({
      tourFindFirst,
      depFindFirst,
      bookingFindUnique,
      bookingCreate,
    });
    const stripeSessionFn = jest
      .fn()
      .mockResolvedValue({ id: 'cs_test_999', url: null });
    const svc = new BookingsService(
      prisma as never,
      makeStripe(stripeSessionFn),
      makeConfig(),
      makeEmail(),
    );

    await expect(svc.create('u-customer', baseDto)).rejects.toMatchObject({
      response: { code: 'STRIPE_SESSION_INVALID' },
    });
  });
});

describe('BookingsService.findByCodeForCaller', () => {
  it('returns the booking when caller is the owner', async () => {
    const bookingFindUnique = jest.fn().mockResolvedValue(sampleBooking);
    const prisma = makePrisma({ bookingFindUnique });
    const svc = new BookingsService(
      prisma as never,
      makeStripe(),
      makeConfig(),
      makeEmail(),
    );

    const result = await svc.findByCodeForCaller(sampleBooking.code, {
      id: sampleBooking.userId,
      role: UserRole.CUSTOMER,
    });

    expect(result.id).toBe(sampleBooking.id);
  });

  it('returns the booking when caller is an ADMIN (different userId)', async () => {
    const bookingFindUnique = jest.fn().mockResolvedValue(sampleBooking);
    const prisma = makePrisma({ bookingFindUnique });
    const svc = new BookingsService(
      prisma as never,
      makeStripe(),
      makeConfig(),
      makeEmail(),
    );

    const result = await svc.findByCodeForCaller(sampleBooking.code, {
      id: 'u-some-admin',
      role: UserRole.ADMIN,
    });

    expect(result.id).toBe(sampleBooking.id);
  });

  it('throws BOOKING_NOT_FOUND when non-owner CUSTOMER asks — not 403', async () => {
    // 404 (not 403) on purpose: don't leak booking-code existence to
    // enumeration attacks. Admins still see real not-found.
    const bookingFindUnique = jest.fn().mockResolvedValue(sampleBooking);
    const prisma = makePrisma({ bookingFindUnique });
    const svc = new BookingsService(
      prisma as never,
      makeStripe(),
      makeConfig(),
      makeEmail(),
    );

    await expect(
      svc.findByCodeForCaller(sampleBooking.code, {
        id: 'u-some-other',
        role: UserRole.CUSTOMER,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BOOKING_NOT_FOUND when code missing', async () => {
    const bookingFindUnique = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ bookingFindUnique });
    const svc = new BookingsService(
      prisma as never,
      makeStripe(),
      makeConfig(),
      makeEmail(),
    );

    await expect(
      svc.findByCodeForCaller('BK-GHOST', {
        id: 'u-anyone',
        role: UserRole.CUSTOMER,
      }),
    ).rejects.toMatchObject({ response: { code: 'BOOKING_NOT_FOUND' } });
  });
});

describe('BookingsService.refundByAdmin', () => {
  const paidBooking = {
    ...sampleBooking,
    status: BookingStatus.PAID,
    stripePaymentIntentId: 'pi_test_001',
    user: { locale: 'en' },
    tour: { titleEn: 'Hoi An Walking Tour', titleVi: 'Tour Hoi An' },
    departure: {
      startDate: sampleDeparture.startDate,
      endDate: sampleDeparture.endDate,
    },
  };

  it('rejects BOOKING_NOT_FOUND when id missing', async () => {
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const svc = new BookingsService(
      prisma as never,
      { createRefund: jest.fn() } as unknown as StripeService,
      makeConfig(),
      makeEmail(),
    );
    await expect(
      svc.refundByAdmin({ bookingId: 'missing', adminUserId: 'u-admin' }),
    ).rejects.toMatchObject({
      response: { code: 'BOOKING_NOT_FOUND' },
    });
  });

  it('rejects BOOKING_NOT_REFUNDABLE when status is not PAID', async () => {
    const prisma = {
      booking: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...paidBooking, status: BookingStatus.PENDING }),
      },
    };
    const svc = new BookingsService(
      prisma as never,
      { createRefund: jest.fn() } as unknown as StripeService,
      makeConfig(),
      makeEmail(),
    );
    await expect(
      svc.refundByAdmin({ bookingId: 'b-1', adminUserId: 'u-admin' }),
    ).rejects.toMatchObject({
      response: { code: 'BOOKING_NOT_REFUNDABLE' },
    });
  });

  it('refunds, decrements seats, marks REFUNDED, and emails the customer', async () => {
    const seatDecrement = jest.fn().mockResolvedValue(undefined);
    const bookingUpdate = jest
      .fn()
      .mockResolvedValue({ ...paidBooking, status: BookingStatus.REFUNDED });
    const tx = {
      tourDeparture: { update: seatDecrement },
      booking: { update: bookingUpdate },
    };
    const transaction = jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(tx),
    );
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue(paidBooking) },
      $transaction: transaction,
    };
    const refund = jest
      .fn()
      .mockResolvedValue({ id: 're_1', status: 'succeeded' });
    const sendBookingRefunded = jest.fn().mockResolvedValue(undefined);
    const email = {
      sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
      sendBookingRefunded,
    } as unknown as EmailService;
    const svc = new BookingsService(
      prisma as never,
      { createRefund: refund } as unknown as StripeService,
      makeConfig(),
      email,
    );

    await svc.refundByAdmin({
      bookingId: 'b-1',
      reason: 'Tour cancelled',
      adminUserId: 'u-admin',
    });

    expect(refund).toHaveBeenCalledWith({
      paymentIntentId: 'pi_test_001',
      reason: 'Tour cancelled',
    });
    type DepCall = { data: { seatsBooked: { decrement: number } } };
    const depCalls = seatDecrement.mock.calls as unknown as DepCall[][];
    expect(depCalls[0][0].data.seatsBooked.decrement).toBe(3);
    type BookCall = { data: { status: BookingStatus } };
    const bookCalls = bookingUpdate.mock.calls as unknown as BookCall[][];
    expect(bookCalls[0][0].data.status).toBe(BookingStatus.REFUNDED);
    expect(sendBookingRefunded).toHaveBeenCalled();
  });

  it('persists refundReason and refundedById on the booking (audit trail)', async () => {
    const bookingUpdate = jest
      .fn()
      .mockResolvedValue({ ...paidBooking, status: BookingStatus.REFUNDED });
    const tx = {
      tourDeparture: { update: jest.fn().mockResolvedValue(undefined) },
      booking: { update: bookingUpdate },
    };
    const transaction = jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(tx),
    );
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue(paidBooking) },
      $transaction: transaction,
    };
    const svc = new BookingsService(
      prisma as never,
      {
        createRefund: jest.fn().mockResolvedValue({ id: 're_1' }),
      } as unknown as StripeService,
      makeConfig(),
      makeEmail(),
    );

    await svc.refundByAdmin({
      bookingId: 'b-1',
      reason: 'Overbooked by operator',
      adminUserId: 'u-admin',
    });

    type AuditCall = {
      data: { refundReason: string | null; refundedById: string };
    };
    const calls = bookingUpdate.mock.calls as unknown as AuditCall[][];
    expect(calls[0][0].data.refundReason).toBe('Overbooked by operator');
    expect(calls[0][0].data.refundedById).toBe('u-admin');
  });

  it('converges to REFUNDED when Stripe reports charge_already_refunded', async () => {
    // The payment was refunded out-of-band (e.g. Stripe Dashboard). The DB
    // must still converge instead of leaving the booking stuck PAID.
    const bookingUpdate = jest
      .fn()
      .mockResolvedValue({ ...paidBooking, status: BookingStatus.REFUNDED });
    const tx = {
      tourDeparture: { update: jest.fn().mockResolvedValue(undefined) },
      booking: { update: bookingUpdate },
    };
    const transaction = jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(tx),
    );
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue(paidBooking) },
      $transaction: transaction,
    };
    const alreadyRefunded = Object.assign(
      new Error('Charge ch_x has already been refunded.'),
      { code: 'charge_already_refunded' },
    );
    const refund = jest.fn().mockRejectedValue(alreadyRefunded);
    const svc = new BookingsService(
      prisma as never,
      { createRefund: refund } as unknown as StripeService,
      makeConfig(),
      makeEmail(),
    );

    await expect(
      svc.refundByAdmin({ bookingId: 'b-1', adminUserId: 'u-admin' }),
    ).resolves.toMatchObject({ status: BookingStatus.REFUNDED });
    expect(transaction).toHaveBeenCalled();
  });

  it('rejects REFUND_FAILED and does not write to DB when Stripe errors', async () => {
    const transaction = jest.fn();
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue(paidBooking) },
      $transaction: transaction,
    };
    const refund = jest.fn().mockRejectedValue(new Error('charge expired'));
    const svc = new BookingsService(
      prisma as never,
      { createRefund: refund } as unknown as StripeService,
      makeConfig(),
      makeEmail(),
    );

    await expect(
      svc.refundByAdmin({ bookingId: 'b-1', adminUserId: 'u-admin' }),
    ).rejects.toMatchObject({
      response: { code: 'REFUND_FAILED' },
    });
    expect(transaction).not.toHaveBeenCalled();
  });
});

// Silence the unused-import diagnostic when BadRequestException isn't
// referenced — kept as a typed import for parity with the service file.
void BadRequestException;
