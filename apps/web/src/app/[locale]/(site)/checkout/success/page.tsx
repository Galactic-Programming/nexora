import { setRequestLocale } from "next-intl/server";
import { CheckoutStatus } from "@/features/booking/checkout-status";

export default async function CheckoutSuccessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="mx-auto max-w-2xl px-4 py-14">
      <CheckoutStatus />
    </main>
  );
}
