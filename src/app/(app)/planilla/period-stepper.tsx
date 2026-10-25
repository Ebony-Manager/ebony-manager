"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Selector de quincena con flechas (Asistencia, cierre de Contratistas):
 * el mismo en todas las pestañas de Pagos. En el celular ocupa todo el
 * ancho, con las flechas en los extremos (fáciles de tocar).
 */
export function PeriodStepper({
  label,
  onPrev,
  onNext,
  className,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full items-center gap-1 rounded-lg border border-border px-1 sm:w-auto", className)}>
      <Button variant="ghost" size="icon" className="size-8 sm:size-7" onClick={onPrev}>
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-0 flex-1 truncate text-center text-sm font-medium text-foreground sm:min-w-52">{label}</span>
      <Button variant="ghost" size="icon" className="size-8 sm:size-7" onClick={onNext}>
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
