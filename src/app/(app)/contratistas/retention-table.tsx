"use client";

import { Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

export interface RetentionTableRow {
  key: string;
  /** Proyecto (en la ficha del contratista) o contratista (en la del proyecto). */
  label: string;
  heldCents: number;
  releasedCents: number;
  pendingCents: number;
  /** El proyecto ya se entregó: se puede devolver. */
  canRelease: boolean;
}

/** Retención de garantía: retenido / devuelto / por devolver, con "Devolver". */
export function RetentionTable({
  rows,
  labelHeader,
  busyKey,
  onRelease,
}: {
  rows: RetentionTableRow[];
  labelHeader: string;
  busyKey: string | null;
  onRelease: (row: RetentionTableRow) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  return (
    <div className="overflow-x-auto rounded-xl border border-ink-900/8 bg-card">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-900/8 text-xs text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">{labelHeader}</th>
            <th className="px-3 py-2 text-right font-medium">{tt("ret_col_held")}</th>
            <th className="px-3 py-2 text-right font-medium">{tt("ret_col_released")}</th>
            <th className="px-3 py-2 text-right font-medium">{tt("ret_col_pending")}</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-border last:border-0">
              <td className="px-3 py-2 font-medium text-foreground">{r.label}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatCents(r.heldCents)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatCents(r.releasedCents)}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${r.pendingCents > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                {formatCents(r.pendingCents)}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right">
                {r.pendingCents > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={!r.canRelease || busyKey === r.key}
                    title={r.canRelease ? undefined : tt("ret_not_delivered")}
                    onClick={() => onRelease(r)}
                  >
                    <Undo2 className="size-3.5" />
                    {tt("ret_release")}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
