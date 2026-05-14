import { Locale } from '@prisma/client';

/**
 * Inline bilingual email templates. Kept as plain template literals (no
 * Handlebars / MJML / react-email) on purpose — the thesis demo ships
 * two transactional emails and pulling in a template engine here is the
 * kind of premature abstraction the project lead pushed back on earlier.
 *
 * Locale resolution: caller passes `user.locale` (Prisma enum `Locale`).
 * Anything other than `vi` falls back to English so a missing/garbled
 * locale never blocks a confirmation send.
 */
export interface BookingEmailVars {
  code: string;
  tourTitle: string;
  contactName: string;
  totalAmount: string;
  currency: string;
  numAdults: number;
  numChildren: number;
  startDate?: Date | null;
  endDate?: Date | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const formatDate = (d: Date | null | undefined, locale: Locale): string => {
  if (!d) return '—';
  const lang = locale === Locale.vi ? 'vi-VN' : 'en-US';
  return new Intl.DateTimeFormat(lang, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
};

export const renderBookingConfirmation = (
  vars: BookingEmailVars,
  locale: Locale,
): RenderedEmail => {
  const isVi = locale === Locale.vi;
  const start = formatDate(vars.startDate, locale);
  const end = formatDate(vars.endDate, locale);

  if (isVi) {
    const subject = `Xác nhận đặt tour ${vars.code}`;
    const text = [
      `Xin chào ${vars.contactName},`,
      ``,
      `Cảm ơn bạn đã đặt tour "${vars.tourTitle}". Thanh toán đã được xác nhận thành công.`,
      ``,
      `Mã booking: ${vars.code}`,
      `Số khách: ${vars.numAdults} người lớn + ${vars.numChildren} trẻ em`,
      `Khởi hành: ${start} → ${end}`,
      `Tổng tiền: ${vars.totalAmount} ${vars.currency}`,
      ``,
      `Đội ngũ sẽ gửi voucher chi tiết trước ngày khởi hành 24 giờ.`,
      `Mọi thắc mắc xin liên hệ trực tiếp qua email này.`,
    ].join('\n');
    return { subject, text, html: textToHtml(text) };
  }

  const subject = `Booking confirmed — ${vars.code}`;
  const text = [
    `Hi ${vars.contactName},`,
    ``,
    `Thank you for booking "${vars.tourTitle}". Your payment is confirmed.`,
    ``,
    `Booking code: ${vars.code}`,
    `Travelers: ${vars.numAdults} adult(s) + ${vars.numChildren} child(ren)`,
    `Departure: ${start} → ${end}`,
    `Total paid: ${vars.totalAmount} ${vars.currency}`,
    ``,
    `Your detailed voucher will arrive 24 hours before departure.`,
    `Reply to this email for any questions.`,
  ].join('\n');
  return { subject, text, html: textToHtml(text) };
};

export const renderBookingRefunded = (
  vars: BookingEmailVars,
  locale: Locale,
): RenderedEmail => {
  const isVi = locale === Locale.vi;

  if (isVi) {
    const subject = `Hoàn tiền booking ${vars.code}`;
    const text = [
      `Xin chào ${vars.contactName},`,
      ``,
      `Booking "${vars.tourTitle}" (mã ${vars.code}) đã được hoàn tiền.`,
      `Số tiền hoàn: ${vars.totalAmount} ${vars.currency}`,
      ``,
      `Tiền sẽ về thẻ trong vòng 5–10 ngày làm việc, tùy ngân hàng.`,
      `Nếu cần hỗ trợ thêm xin liên hệ qua email này.`,
    ].join('\n');
    return { subject, text, html: textToHtml(text) };
  }

  const subject = `Refund processed — ${vars.code}`;
  const text = [
    `Hi ${vars.contactName},`,
    ``,
    `Your booking "${vars.tourTitle}" (${vars.code}) has been refunded.`,
    `Refund amount: ${vars.totalAmount} ${vars.currency}`,
    ``,
    `The amount will return to the original card within 5–10 business days.`,
    `Reply to this email if you need further help.`,
  ].join('\n');
  return { subject, text, html: textToHtml(text) };
};

/**
 * Minimal text-to-HTML — wraps each line in <p>, preserves blank lines as
 * spacers. Stripe/Resend deliverability prefers a real HTML body even when
 * the content is plain prose, so we always send both parts.
 */
const textToHtml = (text: string): string => {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = text
    .split('\n')
    .map((line) =>
      line.trim() === '' ? '<p>&nbsp;</p>' : `<p>${escape(line)}</p>`,
    )
    .join('');
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">${body}</body></html>`;
};
