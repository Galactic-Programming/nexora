import type { Destination } from "@/lib/api/destinations";
import type { components } from "@/lib/api/schema";

type MediaItem = components["schemas"]["MediaItemDto"];

const isVi = (locale: string) => locale === "vi";

export interface DestinationVM {
  slug: string;
  href: string;
  name: string;
  region?: string;
  country: string;
  description?: string;
  heroImage?: string;
}

export function toDestinationModel(dest: Destination, locale: string): DestinationVM {
  const vi = isVi(locale);
  const media: MediaItem[] = dest.media ?? [];
  return {
    slug: dest.slug,
    href: `/destinations/${dest.slug}`,
    name: vi ? dest.nameVi : dest.nameEn,
    region: dest.region ?? undefined,
    country: dest.country,
    description: (vi ? dest.descriptionVi : dest.descriptionEn) ?? undefined,
    heroImage: media.find((m) => m.role === "hero")?.url ?? media[0]?.url,
  };
}
