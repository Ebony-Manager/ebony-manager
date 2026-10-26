"use client";

import * as React from "react";
import { Download } from "lucide-react";

import type { getRegistroAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ACH_CONCEPT_ORDER,
  buildAchPayload,
  type AchAccountType,
  type AchConcept,
  type AchProblem,
} from "@/lib/planilla/bank-export";
import { formatCents, monthLabel, type Period } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

type Row = Awaited<ReturnType<typeof getRegistroAction>>[number];

const CONCEPT_LABEL: Record<AchConcept, keyof typeof strings.planilla> = {
  quincena: "ach_concept_quincena",
  decimo: "ach_concept_decimo",
  vacacion: "ach_concept_vacacion",
  prima: "ach_concept_prima",
};

const PROBLEM_KEY: Record<AchProblem, keyof typeof strings.planilla> = {
  no_id: "ach_missing_id",
  no_account: "ach_missing_account",
  no_account_type: "ach_missing_type",
};

/**
 * Vista previa + descarga del archivo de pago para la banca en línea
 * (plantilla TR_ACH). Muestra quién entra, quién queda fuera y por qué,
 * ANTES de bajar nada. Usa las mismas funciones puras que la descarga
 * (`buildAchPayload`), así que lo que se ve es lo que sale en el archivo.
 */
export function BankExportDialog({
  open,
  onOpenChange,
  period,
  rows,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: Period;
  rows: Row[];
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const quincena = `${period.half === 1 ? "1Q" : "2Q"} ${monthLabel(lang, period.month)} ${period.year}`;
  const [text, setText] = React.useState("");
  // Ruta del banco: la misma para todos. Se recuerda en este navegador; si
  // se deja vacía, la columna RUTA BANCO sale vacía y nadie queda fuera.
  const [route, setRoute] = React.useState("");
  /* eslint-disable react-hooks/set-state-in-effect -- lee localStorage post-hidratación. */
  React.useEffect(() => {
    try {
      setRoute(window.localStorage.getItem("ebony:ach-route") ?? "");
    } catch {
      /* ignore */
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const onRoute = (v: string) => {
    setRoute(v);
    try {
      window.localStorage.setItem("ebony:ach-route", v);
    } catch {
      /* ignore */
    }
  };
  const addendaText = text.trim() || `${tt("ach_default_text")} ${quincena}`;

  const payload = React.useMemo(
    () =>
      buildAchPayload(
        rows.map(({ employee, total }) => ({
          employeeId: employee.id,
          name: employee.name,
          idDocument: employee.idDocument,
          bankRoutingCode: employee.bankRoutingCode,
          bankAccountNumber: employee.bankAccountNumber,
          bankAccountType: employee.bankAccountType as AchAccountType | null,
          paymentMethod: total.entry?.paymentMethod ?? "transferencia",
          netCents: total.totalCents,
          benefits: {
            decimoCents: total.entry?.decimoPaidCents ?? 0,
            vacationCents: total.entry?.vacationPaidCents ?? 0,
            primaCents: total.entry?.primaAntiguedadPaidCents ?? 0,
          },
          benefitsPaidExternally: Boolean(employee.benefitsExternalCompany),
        })),
        addendaText,
        route,
        {
          decimo: `${tt("ach_text_decimo")} ${quincena}`,
          vacacion: `${tt("ach_text_vacacion")} ${quincena}`,
          prima: `${tt("ach_text_prima")} ${quincena}`,
        }
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tt` solo cambia con el idioma.
    [rows, addendaText, route, lang, quincena]
  );

  const url = `/planilla/export/ach?year=${period.year}&month=${period.month}&half=${period.half}&text=${encodeURIComponent(addendaText)}&route=${encodeURIComponent(route.trim())}&decimo=${encodeURIComponent(`${tt("ach_text_decimo")} ${quincena}`)}&vacacion=${encodeURIComponent(`${tt("ach_text_vacacion")} ${quincena}`)}&prima=${encodeURIComponent(`${tt("ach_text_prima")} ${quincena}`)}`;
  const notTransfer = payload.skipped.filter((s) => s.reason === "not_transfer").length;
  const zero = payload.skipped.filter((s) => s.reason === "zero").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tt("ach_title")}</DialogTitle>
          <DialogDescription>
            {tt("ach_desc")} · {quincena}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">{tt("ach_in_file")}</p>
            <p className="text-xl font-semibold tabular-nums text-foreground">{payload.rows.length}</p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">{tt("ach_total")}</p>
            <p className="text-xl font-semibold tabular-nums text-foreground">{formatCents(payload.totalCents)}</p>
          </div>
        </div>

        {(payload.totalsByConcept.decimo.count > 0 ||
          payload.totalsByConcept.vacacion.count > 0 ||
          payload.totalsByConcept.prima.count > 0) && (
          <div className="rounded-lg border border-border p-3 text-xs">
            <p className="mb-1 font-medium text-foreground">{tt("ach_by_concept")}</p>
            <ul className="flex flex-col gap-0.5">
              {ACH_CONCEPT_ORDER.filter((c) => payload.totalsByConcept[c].count > 0).map((c) => (
                <li key={c} className="flex justify-between gap-3 text-muted-foreground">
                  <span>
                    {tt(CONCEPT_LABEL[c])} · {payload.totalsByConcept[c].count}
                  </span>
                  <span className="tabular-nums text-foreground">{formatCents(payload.totalsByConcept[c].cents)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {payload.incomplete.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-foreground">
              {payload.incomplete.length} {tt("ach_incomplete_title")}
            </p>
            <p className="mb-2 text-xs text-muted-foreground">{tt("ach_incomplete_hint")}</p>
            <ul className="max-h-40 overflow-y-auto text-xs">
              {payload.incomplete.map((e) => (
                <li key={e.employeeId} className="flex items-start justify-between gap-3 border-t border-border/60 py-1">
                  <span className="text-foreground">
                    {e.name} · {formatCents(e.netCents)}
                  </span>
                  <span className="text-right text-muted-foreground">
                    {e.problems.map((p) => tt(PROBLEM_KEY[p])).join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(notTransfer > 0 || zero > 0) && (
          <p className="text-xs text-muted-foreground">
            {tt("ach_skipped")}: {notTransfer > 0 && `${notTransfer} ${tt("ach_skipped_method")}`}
            {notTransfer > 0 && zero > 0 && " · "}
            {zero > 0 && `${zero} ${tt("ach_skipped_zero")}`}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="ach-addenda">
            {tt("ach_addenda")}
          </label>
          <Input
            id="ach-addenda"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`${tt("ach_default_text")} ${quincena}`}
            maxLength={60}
          />
          <p className="text-[11px] text-muted-foreground">{tt("ach_addenda_hint")}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="ach-route">
            {tt("ach_route")}
          </label>
          <Input id="ach-route" value={route} onChange={(e) => onRoute(e.target.value)} placeholder={tt("ach_route_ph")} maxLength={20} />
          <p className="text-[11px] text-muted-foreground">{tt("ach_route_hint")}</p>
        </div>

        <p className="text-[11px] text-muted-foreground">{tt("ach_codes_note")}</p>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tt("action_cancel")}
          </Button>
          <Button asChild disabled={payload.rows.length === 0}>
            <a href={payload.rows.length === 0 ? undefined : url} download aria-disabled={payload.rows.length === 0}>
              <Download className="size-3.5" />
              {tt("ach_download")}
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
