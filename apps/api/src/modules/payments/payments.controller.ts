import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { PaymentsService } from './payments.service';

/**
 * Stripe webhook receiver. The only public, unauthenticated mutation
 * endpoint in the whole API — Stripe authenticates by signing the
 * request body, not by JWT.
 *
 * Two framework opt-outs are mandatory here:
 *
 *  - `@Public()` — skip `SupabaseJwtGuard`. Stripe doesn't carry our JWT.
 *  - `@SkipTransform()` — skip the global `{ data, error }` envelope.
 *    Stripe ignores the body but human debuggers + log readers see the
 *    plain `{ received, eventId, type }` echo unchanged.
 *
 * Raw-body plumbing happens in `main.ts`: `express.raw({ type:
 * 'application/json' })` is mounted on this exact path BEFORE the global
 * JSON parser. So when the handler runs, `req.body` is a `Buffer` of the
 * untouched bytes Stripe signed — exactly what `constructEvent` needs.
 *
 * We deliberately return 200 on every recognised signature, even for
 * unhandled event types. Stripe retries 4xx/5xx for up to 3 days, which
 * would flood logs with re-runs of events we don't care about.
 */
@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * `POST /payments/webhook` — entry point for every Stripe event.
   *
   * Errors:
   *  - 400 `STRIPE_WEBHOOK_INVALID` — signature missing / wrong / tampered.
   *    Stripe will retry; the next attempt arrives a few seconds later
   *    so the rejection is recoverable (e.g. clock skew, secret rotated).
   *
   * Successful responses are intentionally a plain JSON object, NOT the
   * standard envelope. Stripe's webhook contract is "any 2xx is OK"; we
   * echo `received: true` plus the event id/type so manual replays via
   * `stripe events resend` produce readable logs.
   */
  @Post('webhook')
  @Public()
  @SkipTransform()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook receiver (signature-verified)' })
  @ApiResponse({ status: 200, description: 'Event processed or ignored' })
  @ApiResponse({ status: 400, description: 'Signature verification failed' })
  async handle(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: true; eventId: string; type: string }> {
    if (!signature) {
      throw new BadRequestException({
        code: 'STRIPE_WEBHOOK_INVALID',
        message: 'Missing Stripe-Signature header',
      });
    }
    // `express.raw()` populates `req.body` as a Buffer for this route
    // only — the global `ValidationPipe` never sees this handler because
    // we don't declare a `@Body()` DTO.
    const rawBody = req.body as Buffer;
    if (!Buffer.isBuffer(rawBody)) {
      throw new BadRequestException({
        code: 'STRIPE_WEBHOOK_INVALID',
        message:
          'Raw body missing — express.raw middleware likely not mounted on this path',
      });
    }
    return this.paymentsService.handleStripeEvent(rawBody, signature);
  }
}
