import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";

export default function AccountSecurityLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <ShimmerSkeleton className="mb-2 h-9 w-48" />
      <ShimmerSkeleton className="mb-8 h-5 w-72" />
      <ShimmerSkeleton className="mb-3 h-6 w-56" />
      <ShimmerSkeleton className="mb-3 h-10 w-full" />
      <ShimmerSkeleton className="h-10 w-32" />
    </div>
  );
}
