import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-5 px-4 pt-4 pb-10 sm:px-7 sm:pt-6">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-9 w-full max-w-md" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
