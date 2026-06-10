import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10" aria-busy="true" aria-label="Loading tours">
      <ShimmerSkeleton aria-hidden="true" className="h-64 w-full rounded-3xl" />
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <ShimmerSkeleton key={i} aria-hidden="true" className="h-48 w-full rounded-xl" />
          ))}
        </div>
        <ShimmerSkeleton aria-hidden="true" className="h-96 w-full rounded-2xl" />
      </div>
    </div>
  );
}
