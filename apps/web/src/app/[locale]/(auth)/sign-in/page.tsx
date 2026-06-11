import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Separator } from "@tourism/ui/components/legacy/separator";
import { AuthCard } from "@/features/auth/auth-card";
import { GoogleButton } from "@/features/auth/google-button";
import { SignInForm } from "@/features/auth/sign-in-form";

export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  return (
    <AuthCard
      title={t("signInTitle")}
      subtitle={t("signInSubtitle")}
      footer={
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="hover:underline">
              {t("forgotLink")}
            </Link>
            <span>
              {t("noAccount")}{" "}
              <Link href="/sign-up" className="text-card-foreground hover:underline">
                {t("createAccount")}
              </Link>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-sm">{t("orDivider")}</span>
            <Separator className="flex-1" />
          </div>
          <GoogleButton />
        </div>
      }
    >
      <SignInForm />
    </AuthCard>
  );
}
