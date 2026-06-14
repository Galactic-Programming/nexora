import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";

export default function BookingDetailLoading() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <ShimmerSkeleton className="mb-2 h-9 w-48" />
      <ShimmerSkeleton className="mb-8 h-5 w-72" />
      <ShimmerSkeleton className="mb-4 h-6 w-40" />
      <ShimmerSkeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
