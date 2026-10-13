import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-12 sm:px-7">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-9 w-full" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Skeleton className="h-[460px] w-full" />
        <Skeleton className="h-[460px] w-full" />
      </div>
    </div>
  );
}
