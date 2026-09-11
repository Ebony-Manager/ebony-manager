"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import toast from "react-hot-toast";

import type { ContractorType, LaborRate } from "@/types/contractors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { updateLaborRateAction } from "./actions";
import { LaborRateFormDialog } from "./labor-rate-form-dialog";

type TypeFilter = "all" | ContractorType;

/**
 * Pestaña "Tarifas" del módulo Contratistas — catálogo de precios de
 * mano de obra (`labor_rates`), filtrable por tipo. Editar abre el
 * formulario; activar/desactivar es un patch directo (nunca se borra un
 * registro, por trazabilidad histórica). El selector de ítems dentro de
 * "Agregar Movimiento" es la siguiente tanda — esta pantalla es solo la
 * administración del catálogo.
 */
export function LaborRatesView({ rates }: { rates: LaborRate[] }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);
  const router = useRouter();

  const [filter, setFilter] = React.useState<TypeFilter>("all");
  const [showInactive, setShowInactive] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<LaborRate | null>(null);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    return rates.filter((r) => {
      if (filter !== "all" && r.contractorType !== filter) return false;
      if (!showInactive && !r.activo) return false;
      return true;
    });
  }, [rates, filter, showInactive]);

  async function onToggleActive(rate: LaborRate) {
    setTogglingId(rate.id);
    try {
      await updateLaborRateAction(rate.id, { activo: !rate.activo });
      toast.success(rate.activo ? tt("rate_deactivated") : tt("rate_activated"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setTogglingId(null);
    }
  }

  function phaseLabel(rate: LaborRate) {
    if (!rate.fase) return "—";
    return rate.fase === "armado" ? tt("phase_armado") : tt("phase_instalacion");
  }

  function unitLabel(rate: LaborRate) {
    if (rate.unidad === "m2") return tt("unit_m2");
    if (rate.unidad === "ml") return tt("unit_ml");
    return tt("unit_unidad");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {(["all", "ebanista", "pintor"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "secondary" : "ghost"}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? tt("rates_filter_all") : f === "ebanista" ? tt("type_ebanista") : tt("type_pintor")}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? `✓ ${tt("rates_show_inactive")}` : tt("rates_show_inactive")}
          </Button>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" />
          {tt("add_rate")}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          {tt("rates_empty")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">{tt("rates_col_description")}</th>
                <th className="px-3 py-2 text-left font-medium">{tt("rates_col_phase")}</th>
                <th className="px-3 py-2 text-left font-medium">{tt("rates_col_unit")}</th>
                <th className="px-3 py-2 text-right font-medium">{tt("rates_col_price")}</th>
                <th className="px-3 py-2 text-left font-medium">{tt("rates_col_status")}</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                >
                  <td className="px-3 py-2 font-medium text-foreground">
                    {r.descripcion}
                    <Badge variant="outline" className="ml-2 align-middle">
                      {r.contractorType === "pintor" ? tt("type_pintor") : tt("type_ebanista")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{phaseLabel(r)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{unitLabel(r)}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">
                    {formatCents(r.precioCents)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={r.activo ? "secondary" : "outline"}>
                      {r.activo ? tt("rates_active") : tt("rates_inactive")}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-foreground"
                      title={tt("action_edit")}
                      onClick={() => setEditing(r)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-1 h-6 px-2 text-xs"
                      disabled={togglingId === r.id}
                      onClick={() => onToggleActive(r)}
                    >
                      {r.activo ? tt("action_deactivate") : tt("action_activate")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LaborRateFormDialog rate={null} open={addOpen} onOpenChange={setAddOpen} />
      <LaborRateFormDialog
        rate={editing}
        open={editing !== null}
        onOpenChange={(next) => !next && setEditing(null)}
      />
    </div>
  );
}
