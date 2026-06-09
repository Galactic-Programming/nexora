import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Separator } from "@tourism/ui/components/legacy/separator";
import { AuthCard } from "@/features/auth/auth-card";
import { GoogleButton } from "@/features/auth/google-button";
import { SignUpForm } from "@/features/auth/sign-up-form";

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  return (
    <AuthCard
      title={t("signUpTitle")}
      subtitle={t("signUpSubtitle")}
      footer={
        <div className="space-y-4">
          <p className="text-sm">
            {t("haveAccount")}{" "}
            <Link href="/sign-in" className="text-card-foreground hover:underline">
              {t("backToSignIn")}
            </Link>
          </p>
          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-sm">{t("orDivider")}</span>
            <Separator className="flex-1" />
          </div>
          <GoogleButton label={t("googleCta")} soon={t("googleSoon")} />
        </div>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
