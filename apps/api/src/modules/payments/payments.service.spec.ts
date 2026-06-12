import { BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, Prisma } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';

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

/**
 * Builds a fake Stripe Event object. The `constructEvent` mock returns
 * this verbatim, simulating a verified webhook payload.
 */
function makeEvent(args: {
  id?: string;
  type: string;
  bookingId?: string;
  bookingCode?: string;
  paymentIntentId?: string | null;
}) {
  return {
    id: args.id ?? 'evt_test_001',
    type: args.type,
    data: {
      object: {
        id: 'cs_test_001',
        metadata: {
          bookingId: args.bookingId,
          bookingCode: args.bookingCode ?? 'BK-TESTCODE',
        },
        payment_intent: args.paymentIntentId ?? 'pi_test_001',
      },
    },
  };
}

const sampleBooking = {
  id: 'b-1',
  code: 'BK-TESTCODE',
  numAdults: 2,
  numChildren: 1,
  status: BookingStatus.PENDING,
  departureId: 'dep-1',
  departure: { id: 'dep-1', seatsTotal: 15, seatsBooked: 2 },
};

function makePrisma(overrides: {
  bookingFindUnique?: jest.Mock;
  paymentEventCreate?: jest.Mock;
  paymentEventFindUnique?: jest.Mock;
  paymentEventUpdate?: jest.Mock;
  transactionResult?: 'paid' | 'overbooked' | 'already_processed';
  bookingUpdate?: jest.Mock;
}) {
  const transaction = jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
    // For the happy path tests, pass a minimal tx mock that returns the
    // outcome the test wants. The real `cb` is exercised indirectly via
    // the resolved value.
    if (overrides.transactionResult) {
      return overrides.transactionResult;
    }
    // Otherwise, run the callback against a fake tx with $queryRaw +
    // tourDeparture.update + booking.update + booking.findUnique stubs.
    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue(sampleBooking),
        update: jest.fn().mockResolvedValue(undefined),
      },
      tourDeparture: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ seatsTotal: 15, seatsBooked: 2 }]),
    };
    return cb(tx);
  });

  return {
    paymentEvent: {
      create: overrides.paymentEventCreate ?? jest.fn().mockResolvedValue({}),
      // Default for duplicate lookups: the prior row finished processing.
      findUnique:
        overrides.paymentEventFindUnique ??
        jest.fn().mockResolvedValue({ processedAt: new Date() }),
      update: overrides.paymentEventUpdate ?? jest.fn().mockResolvedValue({}),
    },
    booking: {
      findUnique: overrides.bookingFindUnique ?? jest.fn(),
      update: overrides.bookingUpdate ?? jest.fn(),
    },
    $transaction: transaction,
  };
}

function makeStripe(
  constructEvent: jest.Mock,
  createRefund: jest.Mock = jest.fn(),
): StripeService {
  return { constructEvent, createRefund } as unknown as StripeService;
}

function makeConfig(): ConfigService {
  return {
    getOrThrow: jest.fn(() => 'whsec_test'),
  } as unknown as ConfigService;
}

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('PaymentsService.handleStripeEvent', () => {
  it('rejects with STRIPE_WEBHOOK_INVALID when signature verification throws', async () => {
    const constructEvent = jest.fn().mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });
    const svc = new PaymentsService(
      makePrisma({}) as never,
      makeStripe(constructEvent),
      makeConfig(),
      makeEmail(),
    );

    await expect(
      svc.handleStripeEvent(Buffer.from('{}'), 'bad-sig'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.handleStripeEvent(Buffer.from('{}'), 'bad-sig'),
    ).rejects.toMatchObject({ response: { code: 'STRIPE_WEBHOOK_INVALID' } });
  });

  it('returns early without side effects when the duplicate event was FULLY processed', async () => {
    const constructEvent = jest.fn().mockReturnValue(
      makeEvent({
        id: 'evt_dup',
        type: 'checkout.session.completed',
        bookingId: 'b-1',
      }),
    );
    const paymentEventCreate = jest.fn().mockRejectedValue(p2002());
    const transaction = jest.fn();
    const prisma = {
      paymentEvent: {
        create: paymentEventCreate,
        findUnique: jest.fn().mockResolvedValue({ processedAt: new Date() }),
        update: jest.fn(),
      },
      $transaction: transaction,
    };

    const svc = new PaymentsService(
      prisma as never,
      makeStripe(constructEvent),
      makeConfig(),
      makeEmail(),
    );

    const result = await svc.handleStripeEvent(Buffer.from('{}'), 'good-sig');

    expect(result).toEqual({
      received: true,
      eventId: 'evt_dup',
      type: 'checkout.session.completed',
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('RE-PROCESSES a duplicate whose prior attempt never finished (processedAt null)', async () => {
    // Crash-after-insert scenario: the event row exists but processing died
    // before completing. Stripe's retry must run the handler again instead
    // of being swallowed by the duplicate check.
    const constructEvent = jest.fn().mockReturnValue(
      makeEvent({
        id: 'evt_crashed',
        type: 'checkout.session.completed',
        bookingId: 'b-1',
      }),
    );
    const paymentEventCreate = jest.fn().mockRejectedValue(p2002());
    const paymentEventFindUnique = jest
      .fn()
      .mockResolvedValue({ processedAt: null });
    const paymentEventUpdate = jest.fn().mockResolvedValue({});
    const bookingFindUnique = jest.fn().mockResolvedValue(undefined);
    const prisma = makePrisma({
      paymentEventCreate,
      paymentEventFindUnique,
      paymentEventUpdate,
      bookingFindUnique,
      transactionResult: 'paid',
    });

    const svc = new PaymentsService(
      prisma as never,
      makeStripe(constructEvent),
      makeConfig(),
      makeEmail(),
    );

    await svc.handleStripeEvent(Buffer.from('{}'), 'good-sig');

    // The handler ran (transaction invoked) AND the row was marked done.
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(paymentEventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeEventId: 'evt_crashed' },
        data: { processedAt: expect.any(Date) as Date },
      }),
    );
  });

  it('marks the event processed after a successful first-time dispatch', async () => {
    const constructEvent = jest.fn().mockReturnValue(
      makeEvent({
        id: 'evt_fresh',
        type: 'checkout.session.completed',
        bookingId: 'b-1',
      }),
    );
    const paymentEventUpdate = jest.fn().mockResolvedValue({});
    const bookingFindUnique = jest.fn().mockResolvedValue(undefined);
    const prisma = makePrisma({
      paymentEventUpdate,
      bookingFindUnique,
      transactionResult: 'paid',
    });

    const svc = new PaymentsService(
      prisma as never,
      makeStripe(constructEvent),
      makeConfig(),
      makeEmail(),
    );

    await svc.handleStripeEvent(Buffer.from('{}'), 'good-sig');

    expect(paymentEventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeEventId: 'evt_fresh' },
        data: { processedAt: expect.any(Date) as Date },
      }),
    );
  });

  it('ignores checkout.session.completed when metadata.bookingId is missing', async () => {
    const constructEvent = jest.fn().mockReturnValue({
      id: 'evt_meta_missing',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_x', metadata: {} } },
    });
    const transaction = jest.fn();
    const prisma = {
      paymentEvent: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ processedAt: new Date() }),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: transaction,
    };

    const svc = new PaymentsService(
      prisma as never,
      makeStripe(constructEvent),
      makeConfig(),
      makeEmail(),
    );

    await svc.handleStripeEvent(Buffer.from('{}'), 'good-sig');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('marks booking PAID + increments seats on the happy path', async () => {
    const event = makeEvent({
      type: 'checkout.session.completed',
      bookingId: 'b-1',
    });
    const constructEvent = jest.fn().mockReturnValue(event);

    const bookingUpdate = jest.fn().mockResolvedValue(undefined);
    const departureUpdate = jest.fn().mockResolvedValue(undefined);
    const bookingFindUniqueTx = jest.fn().mockResolvedValue(sampleBooking);
    const queryRaw = jest
      .fn()
      .mockResolvedValue([{ seatsTotal: 15, seatsBooked: 2 }]);

    const transaction = jest.fn(
      async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          booking: { findUnique: bookingFindUniqueTx, update: bookingUpdate },
          tourDeparture: { update: departureUpdate },
          $queryRaw: queryRaw,
        };
        return cb(tx);
      },
    );

    const prisma = {
      paymentEvent: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ processedAt: new Date() }),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: transaction,
    };
    const refund = jest.fn();
    const svc = new PaymentsService(
      prisma as never,
      makeStripe(constructEvent, refund),
      makeConfig(),
      makeEmail(),
    );

    await svc.handleStripeEvent(Buffer.from('{}'), 'good-sig');

    // 3 seats requested; total 15, booked 2 → fits. Departure update writes
    // back booked+3 = 5. Booking flips to PAID.
    type DepUpdateCall = { data: { seatsBooked: number } };
    const depCalls = departureUpdate.mock.calls as unknown as DepUpdateCall[][];
    expect(depCalls[0][0].data.seatsBooked).toBe(5);

    type BookingUpdateCall = {
      data: { status: BookingStatus; stripePaymentIntentId: string };
    };
    const bookingCalls = bookingUpdate.mock
      .calls as unknown as BookingUpdateCall[][];
    expect(bookingCalls[0][0].data.status).toBe(BookingStatus.PAID);
    expect(bookingCalls[0][0].data.stripePaymentIntentId).toBe('pi_test_001');

    // No refund on the happy path.
    expect(refund).not.toHaveBeenCalled();
  });

  it('refunds and CANCELS the booking when capacity check loses the race', async () => {
    const event = makeEvent({
      type: 'checkout.session.completed',
      bookingId: 'b-1',
    });
    const constructEvent = jest.fn().mockReturnValue(event);

    const bookingFindUniqueTx = jest.fn().mockResolvedValue(sampleBooking);
    // Race: 14 seats booked when the webhook tries to fit 3 more
    // (15 - 14 = 1 remaining; we need 3).
    const queryRaw = jest
      .fn()
      .mockResolvedValue([{ seatsTotal: 15, seatsBooked: 14 }]);
    const departureUpdate = jest.fn();
    const bookingUpdateInTx = jest.fn();

    const transaction = jest.fn(
      async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          booking: {
            findUnique: bookingFindUniqueTx,
            update: bookingUpdateInTx,
          },
          tourDeparture: { update: departureUpdate },
          $queryRaw: queryRaw,
        };
        return cb(tx);
      },
    );

    // Outside-tx booking.update used by `refundOverbookedAndCancel`.
    const bookingUpdateOutside = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      paymentEvent: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ processedAt: new Date() }),
        update: jest.fn().mockResolvedValue({}),
      },
      booking: { update: bookingUpdateOutside },
      $transaction: transaction,
    };

    const refund = jest
      .fn()
      .mockResolvedValue({ id: 're_001', status: 'succeeded' });
    const svc = new PaymentsService(
      prisma as never,
      makeStripe(constructEvent, refund),
      makeConfig(),
      makeEmail(),
    );

    await svc.handleStripeEvent(Buffer.from('{}'), 'good-sig');

    // Inside the tx we did NOT mutate seats or flip status (race lost).
    expect(departureUpdate).not.toHaveBeenCalled();
    expect(bookingUpdateInTx).not.toHaveBeenCalled();

    // Outside the tx the refund + booking REFUNDED writeback happened.
    expect(refund).toHaveBeenCalledWith({
      paymentIntentId: 'pi_test_001',
      reason: 'requested_by_customer',
    });
    type RefundUpdate = { data: { status: BookingStatus } };
    const outsideCalls = bookingUpdateOutside.mock
      .calls as unknown as RefundUpdate[][];
    expect(outsideCalls[0][0].data.status).toBe(BookingStatus.REFUNDED);
  });

  it('marks the booking CANCELLED on checkout.session.expired', async () => {
    const event = makeEvent({
      type: 'checkout.session.expired',
      bookingId: 'b-1',
    });
    const constructEvent = jest.fn().mockReturnValue(event);

    const bookingFindUnique = jest.fn().mockResolvedValue({
      id: 'b-1',
      code: 'BK-TESTCODE',
      status: BookingStatus.PENDING,
    });
    const bookingUpdate = jest.fn().mockResolvedValue(undefined);

    const prisma = {
      paymentEvent: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ processedAt: new Date() }),
        update: jest.fn().mockResolvedValue({}),
      },
      booking: { findUnique: bookingFindUnique, update: bookingUpdate },
      $transaction: jest.fn(),
    };

    const svc = new PaymentsService(
      prisma as never,
      makeStripe(constructEvent),
      makeConfig(),
      makeEmail(),
    );

    await svc.handleStripeEvent(Buffer.from('{}'), 'good-sig');

    type ExpUpdate = { data: { status: BookingStatus; cancelledAt: Date } };
    const calls = bookingUpdate.mock.calls as unknown as ExpUpdate[][];
    expect(calls[0][0].data.status).toBe(BookingStatus.CANCELLED);
    expect(calls[0][0].data.cancelledAt).toBeInstanceOf(Date);
  });

  it('is a no-op for unhandled event types but still returns 200', async () => {
    const event = makeEvent({
      type: 'payment_intent.created',
      bookingId: 'b-1',
    });
    const constructEvent = jest.fn().mockReturnValue(event);

    const transaction = jest.fn();
    const prisma = {
      paymentEvent: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ processedAt: new Date() }),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: transaction,
    };

    const svc = new PaymentsService(
      prisma as never,
      makeStripe(constructEvent),
      makeConfig(),
      makeEmail(),
    );

    const result = await svc.handleStripeEvent(Buffer.from('{}'), 'good-sig');
    expect(result.received).toBe(true);
    expect(result.type).toBe('payment_intent.created');
    expect(transaction).not.toHaveBeenCalled();
  });
});
