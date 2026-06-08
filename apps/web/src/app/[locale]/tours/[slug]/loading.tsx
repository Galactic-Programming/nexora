import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col">
      <ShimmerSkeleton aria-hidden="true" className="h-[42vh] w-full" />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-12 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          <ShimmerSkeleton aria-hidden="true" className="h-10 w-2/3 rounded-lg" />
          <ShimmerSkeleton aria-hidden="true" className="h-40 w-full rounded-xl" />
        </div>
        <ShimmerSkeleton aria-hidden="true" className="h-72 w-full rounded-2xl" />
      </div>
    </div>
  );
}
