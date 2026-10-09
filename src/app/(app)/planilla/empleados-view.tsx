"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Search, Phone, IdCard, Check, UserX, UserCheck, X, LayoutGrid, Table2 } from "lucide-react";

import type { PayrollEmployee } from "@/types/planilla";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { EmployeeAvatar } from "./employee-avatar";
import { setEmployeesStatusAction } from "./actions";
import { FormDialog } from "./form-dialog";
import { EmployeeRosterTable } from "./employee-roster-table";
import { matchesEmployeeQuery } from "@/lib/planilla/employee-search";

/** Tarjeta de un empleado. Vive FUERA de `EmpleadosView`: definida adentro,
 *  React la trataba como un componente nuevo en cada render y desmontaba
 *  todas las tarjetas (y sus links) cada vez que cambiaba algo. */
function EmployeeCard({
  employee,
  selectMode,
  selected,
  onToggle,
}: {
  employee: PayrollEmployee;
  selectMode: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const className = `relative flex flex-col gap-3 rounded-none border bg-card p-4 text-left transition-colors ${
    selected ? "border-primary bg-accent/40" : "border-border hover:border-primary/40 hover:bg-accent/30"
  }`;
  const body = (
    <>
      <div className="flex items-center gap-3">
        {selectMode && (
          <span
            className={`flex size-5 shrink-0 items-center justify-center border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`}
            aria-hidden
          >
            {selected && <Check className="size-3.5" />}
          </span>
        )}
        <EmployeeAvatar name={employee.name} employeeId={employee.id} sortOrder={employee.sortOrder} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{employee.name}</p>
          <p className="truncate text-xs text-muted-foreground">{employee.position || tt("no_position")}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {employee.status === "INACTIVE" && <Badge variant="secondary">{tt("inactive")}</Badge>}
          <Badge variant="outline">
            {employee.categoria === "administrativo" ? tt("categoria_administrativo") : tt("categoria_taller")}
          </Badge>
        </div>
      </div>
      <div className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Phone className="size-3.5 shrink-0" />
          {employee.phone || tt("no_phone")}
        </span>
        <span className="flex items-center gap-1.5">
          <IdCard className="size-3.5 shrink-0" />
          {employee.idDocument || tt("no_id")}
        </span>
      </div>
    </>
  );
  // En modo selección la tarjeta marca / desmarca; fuera de él, abre el perfil.
  return selectMode ? (
    <button type="button" aria-pressed={selected} onClick={() => onToggle(employee.id)} className={className}>
      {body}
    </button>
  ) : (
    <Link href={`/planilla/${employee.id}?from=empleados`} className={className}>
      {body}
    </Link>
  );
}

/**
 * Directorio de empleados — tarjeta de contacto por persona
 * (nombre/posición/teléfono/cédula), click para ir al perfil completo
 * (`/planilla/[id]`, pantalla completa — incluye el Historial de
 * quincenas). Rejilla de tarjetas en vez de la tabla densa de Registro:
 * este tab es sobre QUIÉN es alguien, no su pago. Filtra en el cliente
 * sobre `employees` ya cargado — sin fetch extra. Portado de Atlas.
 */
export function EmpleadosView({ employees }: { employees: PayrollEmployee[] }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<"cards" | "table">("cards");
  const [selectMode, setSelectMode] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirm, setConfirm] = React.useState<"INACTIVE" | "ACTIVE" | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        matchesEmployeeQuery(e.name, query) ||
        (e.position ?? "").toLowerCase().includes(q) ||
        (e.idDocument ?? "").toLowerCase().includes(q) ||
        (e.phone ?? "").toLowerCase().includes(q)
    );
  }, [employees, query]);

  const active = filtered.filter((e) => e.status === "ACTIVE");
  const inactive = filtered.filter((e) => e.status === "INACTIVE");

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };
  const selectedEmployees = employees.filter((e) => selected.has(e.id));
  // Qué acciones tienen sentido según lo marcado.
  const canMarkInactive = selectedEmployees.some((e) => e.status === "ACTIVE");
  const canReactivate = selectedEmployees.some((e) => e.status === "INACTIVE");

  async function applyStatus() {
    if (!confirm) return;
    setSaving(true);
    setError(null);
    try {
      const ids = selectedEmployees.filter((e) => e.status !== confirm).map((e) => e.id);
      const n = await setEmployeesStatusAction(ids, confirm);
      toast.success(`${n} ${tt(confirm === "INACTIVE" ? "sel_done_inactive" : "sel_done_active")}`);
      setConfirm(null);
      exitSelect();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }
  const affected = confirm ? selectedEmployees.filter((e) => e.status !== confirm) : [];

  if (employees.length === 0) {
    return (
      <div className="rounded-none border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        {tt("empty_employees")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={tt("search_ph")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-none border border-border p-0.5 text-xs">
            {(
              [
                { key: "cards", icon: LayoutGrid, label: tt("roster_view_cards") },
                { key: "table", icon: Table2, label: tt("roster_view_table") },
              ] as const
            ).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setView(key);
                  if (key === "table") exitSelect();
                }}
                className={`flex items-center gap-1.5 rounded-none px-2.5 py-1 font-medium transition-colors ${view === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
          {view === "cards" && (
            <Button
              type="button"
              variant={selectMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
            >
              {selectMode ? <X className="size-3.5" /> : <Check className="size-3.5" />}
              {selectMode ? tt("sel_cancel") : tt("sel_start")}
            </Button>
          )}
        </div>
      </div>

      {/* Barra de acciones: aparece al entrar en modo selección. */}
      {selectMode && (
        <div className="flex flex-wrap items-center gap-2 rounded-none border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium text-foreground">
            {selected.size} {tt("sel_count")}
          </span>
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => setSelected(new Set(filtered.map((e) => e.id)))}
          >
            {tt("sel_visible")}
          </button>
          {selected.size > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => setSelected(new Set())}
            >
              {tt("sel_clear")}
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" disabled={!canMarkInactive} onClick={() => setConfirm("INACTIVE")}>
              <UserX className="size-3.5" />
              {tt("sel_mark_inactive")}
            </Button>
            <Button size="sm" variant="outline" disabled={!canReactivate} onClick={() => setConfirm("ACTIVE")}>
              <UserCheck className="size-3.5" />
              {tt("sel_mark_active")}
            </Button>
          </div>
        </div>
      )}

      {view === "table" ? (
        <EmployeeRosterTable employees={filtered} />
      ) : filtered.length === 0 ? (
        <div className="rounded-none border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">{tt("no_results")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{tt("no_results_desc")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {active.map((e) => (
              <EmployeeCard key={e.id} employee={e} selectMode={selectMode} selected={selected.has(e.id)} onToggle={toggle} />
            ))}
          </div>

          {inactive.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium text-muted-foreground">
                {tt("no_longer_work")} ({inactive.length})
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {inactive.map((e) => (
                  <EmployeeCard key={e.id} employee={e} selectMode={selectMode} selected={selected.has(e.id)} onToggle={toggle} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <FormDialog
        open={confirm !== null}
        onOpenChange={(o) => {
          if (!o) {
            setConfirm(null);
            setError(null);
          }
        }}
        title={tt(confirm === "ACTIVE" ? "sel_confirm_active_title" : "sel_confirm_inactive_title")}
        description={tt(confirm === "ACTIVE" ? "sel_confirm_active_desc" : "sel_confirm_inactive_desc")}
        onSubmit={applyStatus}
        submitting={saving}
        submitLabel={tt(confirm === "ACTIVE" ? "sel_mark_active" : "sel_mark_inactive")}
        error={error}
      >
        <ul className="max-h-56 overflow-y-auto border border-border text-sm">
          {affected.map((e) => (
            <li key={e.id} className="flex items-center gap-2 border-b border-border px-3 py-1.5 last:border-0">
              <EmployeeAvatar name={e.name} employeeId={e.id} sortOrder={e.sortOrder} />
              {e.name}
            </li>
          ))}
        </ul>
      </FormDialog>
    </div>
  );
}
