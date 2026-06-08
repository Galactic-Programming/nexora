import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col">
      <ShimmerSkeleton aria-hidden="true" className="h-[42vh] w-full" />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerSkeleton key={i} aria-hidden="true" className="h-72 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
