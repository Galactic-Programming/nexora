import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";

export default function MyBookingsLoading() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <ShimmerSkeleton className="mb-2 h-9 w-48" />
      <ShimmerSkeleton className="mb-8 h-5 w-72" />
      <div className="space-y-3">
        <ShimmerSkeleton className="h-24 w-full rounded-xl" />
        <ShimmerSkeleton className="h-24 w-full rounded-xl" />
        <ShimmerSkeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}
