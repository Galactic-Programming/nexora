"use client";

import { useState } from "react";
import { TourCard } from "@tourism/ui/components/custom/tour-card";

export function TourCardDemo() {
  const [liked, setLiked] = useState(false);

  return (
    <TourCard
      href="/tours/ha-long-bay"
      image="https://cdn.shadcnstudio.com/ss-assets/components/card/image-2.png?height=280&format=auto"
      title="Ha Long Bay Cruise 2D1N"
      summary="Overnight cruise through emerald waters and limestone karsts, with kayaking and a sunset deck party."
      destination="Quang Ninh"
      price={189}
      currency="USD"
      durationDays={2}
      category="PACKAGE"
      featured
      rating={4.8}
      reviewCount={126}
      liked={liked}
      onLike={() => setLiked(!liked)}
    />
  );
}
