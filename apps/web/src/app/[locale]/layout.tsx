import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Be_Vietnam_Pro, Fraunces, Geist_Mono } from 'next/font/google';
import { routing } from '@/i18n/routing';
import '../globals.css';
import { TooltipProvider } from '@tourism/ui/components/legacy/tooltip';
import { QueryProvider } from '@/providers/query-provider';

// Body / UI font — Be Vietnam Pro has first-class Vietnamese diacritics.
const bodyFont = Be_Vietnam_Pro({
  variable: '--font-body',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

// Display / heading font — Fraunces is a warm editorial serif (Vietnamese subset).
const displayFont = Fraunces({
  variable: '--font-display',
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
});

// Kept for code / numeric mono usage only.
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Tourism Platform',
  description: 'Discover and book curated tours.',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  // Validate the incoming `[locale]` segment.
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering for this locale.
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${bodyFont.variable} ${displayFont.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <QueryProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
