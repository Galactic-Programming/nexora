import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";

export default function WriteReviewLoading() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <ShimmerSkeleton className="mb-2 h-9 w-48" />
      <ShimmerSkeleton className="mb-8 h-5 w-72" />
      <div className="max-w-xl space-y-4">
        <ShimmerSkeleton className="h-8 w-40" />
        <ShimmerSkeleton className="h-10 w-full" />
        <ShimmerSkeleton className="h-32 w-full" />
        <ShimmerSkeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
