import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Reusable horizontal sub-tab bar (solid walnut, ~46px tall) for the top of
 * a module's own content area — first built for Planilla's tab row, meant
 * to be reused as-is by Contratistas and future modules. Deliberately
 * generic: it only lays out a left zone ("tabs", but really any content)
 * and a right zone ("actions"), with zero knowledge of tab state — the
 * caller owns which tab is active and what changing it means (e.g. the
 * `value`/`onValueChange` that already drives an underlying <Tabs>).
 */
export function SectionSubbar({
  tabs,
  actions,
  className,
}: {
  tabs: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-[46px] shrink-0 items-center justify-between gap-3 bg-walnut px-3 sm:px-4", className)}>
      <div className="flex h-full items-center gap-1 overflow-x-auto">{tabs}</div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * The tab look SectionSubbar was built for: white/65% when inactive, solid
 * white + a white underline when active. A plain button, not tied to Radix
 * Tabs — the caller decides what "active" and "click" mean (usually the
 * same `value`/`onValueChange` state also passed to <Tabs>).
 */
export function SectionSubbarTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex h-full shrink-0 items-center px-3 text-sm font-medium whitespace-nowrap transition-colors",
        active ? "text-white" : "text-white/65 hover:text-white/85",
      )}
    >
      {children}
      {active && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-white" />}
    </button>
  );
}
