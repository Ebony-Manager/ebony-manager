import { cn } from "@/lib/utils";

/**
 * A plain, hand-rolled progress bar rather than pulling in
 * @radix-ui/react-progress — the accessibility surface Radix adds
 * (value announcements via aria-valuenow) is easy to replicate directly
 * on a native progressbar role for something this simple.
 */
function Progress({
  value,
  className,
  ...props
}: React.ComponentProps<"div"> & { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <div
        className="h-full rounded-full bg-primary transition-all duration-300"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export { Progress };
