"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Phone, Plus, Trash2 } from "lucide-react";

import type { Contractor, ContractorLedgerEntry } from "@/types/contractors";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
 * Ficha del contratista: datos de contacto + su ESTADO DE CUENTA
 * completo, con saldo corrido calculado (nunca guardado) y color por
 * fila para distinguir lo que sube el saldo (a favor) de lo que lo baja
 * (reduce). Desde acá se registran / editan / borran movimientos.
 */
export function ContractorProfileSheet({
  contractor,
  open,
  onOpenChange,
}: {
  contractor: Contractor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);
  const router = useRouter();

  const [entries, setEntries] = React.useState<ContractorLedgerEntry[] | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ContractorLedgerEntry | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const contractorId = contractor?.id ?? null;

  const load = React.useCallback(() => {
    if (!contractorId) return;
    getContractorLedgerAction(contractorId).then(setEntries);
  }, [contractorId]);

  /* eslint-disable react-hooks/set-state-in-effect -- recarga el ledger al abrir / cambiar de contratista. */
  React.useEffect(() => {
    if (!open || !contractorId) {
      setEntries(null);
      return;
    }
    setEntries(null);
    load();
  }, [open, contractorId, load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const rows = React.useMemo(() => (entries ? withRunningBalance(entries) : []), [entries]);
  const balanceCents = entries ? contractorBalanceCents(entries) : 0;
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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <div className="flex items-center gap-3">
              {contractor && <ContractorAvatar name={contractor.name} size="md" />}
              <div>
                <SheetTitle>{contractor?.name ?? ""}</SheetTitle>
                <SheetDescription>
                  {contractor
                    ? contractor.contractorType === "pintor"
                      ? tt("type_pintor")
                      : tt("type_ebanista")
                    : tt("profile_fallback")}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex flex-col gap-6 px-4 pb-6">
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
              <ProfileField label={tt("f_id_document")} value={contractor?.idDocument} />
              <ProfileField
                label={tt("f_phone")}
                value={
                  contractor?.phone ? (
                    <a href={`tel:${contractor.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                      <Phone className="size-3.5" />
                      {contractor.phone}
                    </a>
                  ) : null
                }
              />
              <ProfileField label={tt("f_contact")} value={contractor?.contactInfo} />
              <ProfileField
                label={tt("f_start_date")}
                value={contractor?.startDate ? formatDate(lang, contractor.startDate) : null}
              />
            </div>

            {contractor?.notes && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {contractor.notes}
              </div>
            )}

            {/* Estado de cuenta */}
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium text-foreground">{tt("ledger_title")}</h3>
                  <p className="text-xs text-muted-foreground">
                    {tt("balance_label")}:{" "}
                    <span className="font-medium tabular-nums" style={toneTextStyle(balTone)}>
                      {formatCents(balanceCents)}
                    </span>
                    {" · "}
                    {balTone === "a_favor"
                      ? tt("bal_ebony_owes")
                      : balTone === "reduce"
                        ? tt("bal_owes_ebony")
                        : tt("bal_settled")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!contractor}
                  onClick={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="size-3.5" />
                  {tt("ledger_add")}
                </Button>
              </div>

              {entries === null ? (
                <p className="py-6 text-center text-xs text-muted-foreground">{tt("loading")}</p>
              ) : rows.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                  {tt("ledger_empty")}
                </p>
              ) : (
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tt("col_date")}</TableHead>
                      <TableHead>{tt("col_category")}</TableHead>
                      <TableHead>{tt("col_client")}</TableHead>
                      <TableHead>{tt("col_description")}</TableHead>
                      <TableHead className="text-right">{tt("col_mt2")}</TableHead>
                      <TableHead className="text-right">{tt("col_cost_mt2")}</TableHead>
                      <TableHead className="text-right">{tt("col_a_favor")}</TableHead>
                      <TableHead className="text-right">{tt("col_reduce")}</TableHead>
                      <TableHead className="text-right">{tt("col_balance")}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const rowTone = row.ebonyAbsorbsMaterial ? "neutral" : row.direction;
                      const absorbed = row.ebonyAbsorbsMaterial;
                      return (
                        <TableRow key={row.id} style={toneRowTint(rowTone)}>
                          <TableCell className="whitespace-nowrap text-foreground">
                            {formatDate(lang, row.entryDate)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-foreground">
                            {label(CONTRACTOR_CATEGORY_LABEL_KEY[row.category])}
                            {absorbed && (
                              <span className="block text-[10px] text-muted-foreground">{tt("absorbed_note")}</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-32 truncate text-muted-foreground" title={row.clientText ?? undefined}>
                            {row.clientText || "—"}
                          </TableCell>
                          <TableCell className="max-w-40 truncate text-muted-foreground" title={row.description ?? undefined}>
                            {row.description || "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {row.mt2 != null ? row.mt2.toFixed(2) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {row.costPerMt2Cents != null ? formatCents(row.costPerMt2Cents) : "—"}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums ${absorbed ? "line-through opacity-60" : ""}`}
                            style={row.direction === "a_favor" ? toneTextStyle("a_favor") : undefined}
                          >
                            {row.direction === "a_favor" ? formatCents(row.amountCents) : "—"}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums ${absorbed ? "line-through opacity-60" : ""}`}
                            style={row.direction === "reduce" ? toneTextStyle("reduce") : undefined}
                          >
                            {row.direction === "reduce" ? formatCents(row.amountCents) : "—"}
                          </TableCell>
                          <TableCell
                            className="text-right font-medium tabular-nums"
                            style={toneTextStyle(balanceTone(row.balanceAfterCents))}
                          >
                            {formatCents(row.balanceAfterCents)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
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
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {contractor && (
        <LedgerEntryDialog
          contractorId={contractor.id}
          entry={editing}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSaved={load}
        />
      )}
    </>
  );
}
