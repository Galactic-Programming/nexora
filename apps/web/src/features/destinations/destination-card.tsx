import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { DestinationVM } from "./destination-view-model";

export function DestinationCard({ destination }: { destination: DestinationVM }) {
  return (
    <Link href={destination.href} className="group border-border block overflow-hidden rounded-2xl border">
      <div className="bg-muted relative aspect-[4/3] overflow-hidden">
        {destination.heroImage && (
          <Image
            src={destination.heroImage}
            alt=""
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, 33vw"
          />
        )}
      </div>
      <div className="p-4">
        <h3 className="font-heading text-lg font-semibold">{destination.name}</h3>
        <p className="text-muted-foreground text-xs">
          {[destination.region, destination.country].filter(Boolean).join(", ")}
        </p>
        {destination.description && (
          <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">{destination.description}</p>
        )}
      </div>
    </Link>
  );
}
