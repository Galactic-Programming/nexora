import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Locale } from '@prisma/client';
import { Resend } from 'resend';
import {
  BookingEmailVars,
  renderBookingConfirmation,
  renderBookingRefunded,
} from './email.templates';

/**
 * Transactional email surface backed by Resend.
 *
 * Defensive by design — every send is wrapped in try/catch and failures
 * are logged at WARN, never thrown. Rationale: a booking is already PAID
 * (or refunded) on the DB side by the time we get here; bouncing the
 * webhook back to 5xx because Resend hiccuped would have Stripe retry
 * the event, which is the wrong remediation. An operator inspecting
 * `payment_events.payload` plus the warn log can resend manually.
 *
 * Locale: caller passes `user.locale` (Prisma enum `Locale`). Templates
 * fall back to English for any value that isn't `vi`.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private resend!: Resend;
  private fromEmail!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.config.getOrThrow<string>('email.resendApiKey');
    this.fromEmail = this.config.getOrThrow<string>('email.fromEmail');
    this.resend = new Resend(apiKey);
  }

  async sendBookingConfirmation(args: {
    to: string;
    locale: Locale;
    vars: BookingEmailVars;
  }): Promise<void> {
    const rendered = renderBookingConfirmation(args.vars, args.locale);
    await this.dispatch({
      to: args.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tag: `booking-confirmation:${args.vars.code}`,
    });
  }

  async sendBookingRefunded(args: {
    to: string;
    locale: Locale;
    vars: BookingEmailVars;
  }): Promise<void> {
    const rendered = renderBookingRefunded(args.vars, args.locale);
    await this.dispatch({
      to: args.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tag: `booking-refunded:${args.vars.code}`,
    });
  }

  private async dispatch(args: {
    to: string;
    subject: string;
    html: string;
    text: string;
    tag: string;
  }): Promise<void> {
    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      });
      if (result.error) {
        this.logger.warn(
          `Resend rejected ${args.tag} → ${args.to}: ${result.error.message}`,
        );
        return;
      }
      this.logger.log(
        `Sent ${args.tag} → ${args.to} (resend_id=${result.data?.id ?? 'n/a'})`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      this.logger.warn(`Failed to send ${args.tag} → ${args.to}: ${message}`);
    }
  }
}
