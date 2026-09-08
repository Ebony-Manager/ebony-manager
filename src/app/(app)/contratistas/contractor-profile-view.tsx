"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, IdCard, Pencil, Phone, Plus, Trash2 } from "lucide-react";

import type { Contractor, ContractorLedgerEntry } from "@/types/contractors";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/planilla/payroll-period";
import { formatDate } from "@/lib/planilla/format";
import { contractorBalanceCents, withRunningBalance } from "@/lib/contractors/contractor-ledger";
import { balanceTone, toneRowTint, toneTextStyle } from "@/lib/contractors/contractor-colors";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { deleteLedgerEntryAction, getContractorLedgerAction } from "./actions";
import { CONTRACTOR_CATEGORY_LABEL_KEY } from "./ledger-labels";
import { ContractorAvatar } from "./contractor-avatar";
import { LedgerEntryDialog } from "./ledger-entry-dialog";

function ProfileField({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

/**
 * Ficha del contratista A PANTALLA COMPLETA (ruta `/contratistas/[id]`):
 * encabezado con datos de contacto + saldo coloreado, y el ESTADO DE
 * CUENTA completo en una tabla ANCHA con scroll horizontal propio y la
 * columna Fecha congelada — mismo patrón que el Registro de Planilla
 * (Taller). El saldo corrido se calcula acá (nunca se guarda) y cada
 * fila se tiñe según suba (a favor) o baje (reduce) el saldo.
 *
 * `initialEntries` llega del server component; tras crear/editar/borrar
 * un movimiento se recarga con `getContractorLedgerAction` y además se
 * refresca la ruta (`router.refresh()`) para el directorio.
 */
export function ContractorProfileView({
  contractor,
  initialEntries,
}: {
  contractor: Contractor;
  initialEntries: ContractorLedgerEntry[];
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);
  const router = useRouter();

  const [entries, setEntries] = React.useState<ContractorLedgerEntry[]>(initialEntries);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ContractorLedgerEntry | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const contractorId = contractor.id;

  const load = React.useCallback(() => {
    getContractorLedgerAction(contractorId).then(setEntries);
  }, [contractorId]);

  // Re-sincroniza si el server component vuelve con datos nuevos (p. ej.
  // tras `router.refresh()` desde otra pestaña de la misma ficha).
  /* eslint-disable react-hooks/set-state-in-effect -- sincroniza el estado local con las props del server. */
  React.useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const rows = React.useMemo(() => withRunningBalance(entries), [entries]);
  const balanceCents = contractorBalanceCents(entries);
  const balTone = balanceTone(balanceCents);

  async function handleDelete(id: string) {
    if (!window.confirm(tt("mov_delete_confirm"))) return;
    setDeletingId(id);
    try {
      await deleteLedgerEntryAction(id);
      load();
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  const label = (key: string) =>
    t(lang, strings.contratistas[key as keyof typeof strings.contratistas]);

  const typeLabel =
    contractor.contractorType === "pintor" ? tt("type_pintor") : tt("type_ebanista");
  const balDescription =
    balTone === "a_favor"
      ? tt("bal_ebony_owes")
      : balTone === "reduce"
        ? tt("bal_owes_ebony")
        : tt("bal_settled");

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
          <Link href="/contratistas">
            <ArrowLeft className="size-3.5" />
            {tt("back_to_directory")}
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ContractorAvatar name={contractor.name} size="md" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">{contractor.name}</h1>
              <p className="text-sm text-muted-foreground">{typeLabel}</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs text-muted-foreground">{tt("balance_label")}</p>
            <p className="text-2xl font-semibold tabular-nums" style={toneTextStyle(balTone)}>
              {formatCents(balanceCents)}
            </p>
            <p className="text-xs text-muted-foreground">{balDescription}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <ProfileField
          label={tt("f_id_document")}
          value={
            contractor.idDocument ? (
              <span className="inline-flex items-center gap-1">
                <IdCard className="size-3.5" />
                {contractor.idDocument}
              </span>
            ) : null
          }
        />
        <ProfileField
          label={tt("f_phone")}
          value={
            contractor.phone ? (
              <a
                href={`tel:${contractor.phone}`}
                className="inline-flex items-center gap-1 hover:text-primary"
              >
                <Phone className="size-3.5" />
                {contractor.phone}
              </a>
            ) : null
          }
        />
        <ProfileField label={tt("f_contact")} value={contractor.contactInfo} />
        <ProfileField
          label={tt("f_start_date")}
          value={contractor.startDate ? formatDate(lang, contractor.startDate) : null}
        />
      </div>

      {contractor.notes && (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {contractor.notes}
        </div>
      )}

      {/* Estado de cuenta */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium text-foreground">{tt("ledger_title")}</h2>
            <p className="text-xs text-muted-foreground">
              {tt("balance_label")}:{" "}
              <span className="font-medium tabular-nums" style={toneTextStyle(balTone)}>
                {formatCents(balanceCents)}
              </span>
              {" · "}
              {balDescription}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            {tt("ledger_add")}
          </Button>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            {tt("ledger_empty")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  {/* Columna "Fecha" congelada al hacer scroll horizontal,
                      igual que "Empleado" en el Registro de Planilla. */}
                  <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left font-medium">
                    {tt("col_date")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">{tt("col_category")}</th>
                  <th className="px-3 py-2 text-left font-medium">{tt("col_client")}</th>
                  <th className="px-3 py-2 text-left font-medium">{tt("col_description")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tt("col_mt2")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tt("col_cost_mt2")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tt("col_a_favor")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tt("col_reduce")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tt("col_balance")}</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const rowTone = row.ebonyAbsorbsMaterial ? "neutral" : row.direction;
                  const absorbed = row.ebonyAbsorbsMaterial;
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                      style={toneRowTint(rowTone)}
                    >
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-background px-3 py-2 text-foreground">
                        {formatDate(lang, row.entryDate)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-foreground">
                        {label(CONTRACTOR_CATEGORY_LABEL_KEY[row.category])}
                        {absorbed && (
                          <span className="block text-[10px] text-muted-foreground">
                            {tt("absorbed_note")}
                          </span>
                        )}
                      </td>
                      <td
                        className="max-w-40 truncate px-3 py-2 text-muted-foreground"
                        title={row.clientText ?? undefined}
                      >
                        {row.clientText || "—"}
                      </td>
                      <td
                        className="max-w-56 truncate px-3 py-2 text-muted-foreground"
                        title={row.description ?? undefined}
                      >
                        {row.description || "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {row.mt2 != null ? row.mt2.toFixed(2) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {row.costPerMt2Cents != null ? formatCents(row.costPerMt2Cents) : "—"}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${absorbed ? "line-through opacity-60" : ""}`}
                        style={row.direction === "a_favor" ? toneTextStyle("a_favor") : undefined}
                      >
                        {row.direction === "a_favor" ? formatCents(row.amountCents) : "—"}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${absorbed ? "line-through opacity-60" : ""}`}
                        style={row.direction === "reduce" ? toneTextStyle("reduce") : undefined}
                      >
                        {row.direction === "reduce" ? formatCents(row.amountCents) : "—"}
                      </td>
                      <td
                        className="px-3 py-2 text-right font-medium tabular-nums"
                        style={toneTextStyle(balanceTone(row.balanceAfterCents))}
                      >
                        {formatCents(row.balanceAfterCents)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-foreground"
                          title={tt("action_edit")}
                          onClick={() => {
                            setEditing(row);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-destructive"
                          title={tt("mov_delete_title")}
                          disabled={deletingId === row.id}
                          onClick={() => handleDelete(row.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LedgerEntryDialog
        contractorId={contractor.id}
        entry={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={load}
      />
    </div>
  );
}
