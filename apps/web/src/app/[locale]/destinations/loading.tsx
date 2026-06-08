import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10" aria-busy="true" aria-label="Loading destinations">
      <ShimmerSkeleton aria-hidden="true" className="h-48 w-full rounded-3xl" />
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerSkeleton key={i} aria-hidden="true" className="h-64 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
