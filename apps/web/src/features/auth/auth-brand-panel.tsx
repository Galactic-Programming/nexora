import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import AuthBackgroundShape from "@tourism/ui/assets/svg/auth-background-shape";

// Provisional brand image — a Cloudinary built-in sample (stable on every cloud).
// Swap for a curated asset in the later whole-product redesign pass.
const BRAND_IMAGE_URL =
  "https://res.cloudinary.com/dbkgeehow/image/upload/f_auto,q_auto,w_1200/samples/landscapes/nature-mountains.jpg";

/** Decorative brand panel for the auth split layout (left column, lg+ only). */
export async function AuthBrandPanel() {
  const tNav = await getTranslations("Nav");
  const tAuth = await getTranslations("Auth");
  return (
    <div className="bg-primary text-primary-foreground relative hidden overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between">
      <Image src={BRAND_IMAGE_URL} alt="" fill priority sizes="50vw" className="object-cover" />
      {/* brand-tint wash — token-driven, no hex */}
      <div
        className="from-primary/85 to-primary/40 absolute inset-0 bg-gradient-to-br"
        aria-hidden="true"
      />
      {/* wrapper-div fallback: SVG has hardcoded width/height attrs; CSS size-* reliably
          controls the container; h-full w-full fills it without fighting HTML attrs */}
      <div
        className="pointer-events-none absolute -top-16 -right-16 opacity-40"
        aria-hidden="true"
      >
        <div className="size-[28rem]">
          <AuthBackgroundShape className="h-full w-full" />
        </div>
      </div>
      <Link href="/" className="relative z-10 w-fit text-lg font-semibold tracking-tight">
        {tNav("brand")}
      </Link>
      <div className="relative z-10 max-w-sm">
        <p className="font-heading text-3xl leading-tight font-semibold">{tAuth("brandHeadline")}</p>
        <p className="text-primary-foreground/80 mt-3 text-sm">{tAuth("brandSubline")}</p>
      </div>
    </div>
  );
}
