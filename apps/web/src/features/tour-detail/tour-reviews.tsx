import { StarIcon } from "lucide-react";
import type { ReviewVM } from "./detail-view-model";

interface Text { title: string; empty: string; average: string; }

export function TourReviews({
  reviews, averageRating, reviewCount, text, localeTag,
}: {
  reviews: ReviewVM[];
  averageRating: number | null;
  reviewCount: number;
  text: Text;
  localeTag: string;
}) {
  return (
    <section id="reviews" className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-6 flex items-baseline gap-3">
        <h2 className="font-heading text-2xl font-semibold">{text.title}</h2>
        {averageRating !== null && (
          <span className="text-muted-foreground flex items-center gap-1 text-sm">
            <StarIcon className="size-4 fill-current" /> {averageRating.toFixed(1)} · {reviewCount}
          </span>
        )}
      </div>
      {reviews.length === 0 ? (
        <p className="text-muted-foreground py-8">{text.empty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {reviews.map((r) => (
            <li key={r.id} className="border-border rounded-2xl border p-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{r.author}</span>
                <span className="flex items-center gap-0.5 text-sm">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <StarIcon key={i} className="size-3.5 fill-current" />
                  ))}
                </span>
              </div>
              {r.title && <p className="font-medium">{r.title}</p>}
              <p className="text-muted-foreground text-sm">{r.body}</p>
              <time className="text-muted-foreground mt-2 block text-xs">
                {new Intl.DateTimeFormat(localeTag, { dateStyle: "medium" }).format(new Date(r.date))}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
