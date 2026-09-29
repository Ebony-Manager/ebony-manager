"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Phone, IdCard } from "lucide-react";

import type { PayrollEmployee } from "@/types/planilla";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { EmployeeAvatar } from "./employee-avatar";

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

  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.position ?? "").toLowerCase().includes(q) ||
        (e.idDocument ?? "").toLowerCase().includes(q) ||
        (e.phone ?? "").toLowerCase().includes(q)
    );
  }, [employees, query]);

  const active = filtered.filter((e) => e.status === "ACTIVE");
  const inactive = filtered.filter((e) => e.status === "INACTIVE");

  function Card({ employee }: { employee: PayrollEmployee }) {
    return (
      <Link
        href={`/planilla/${employee.id}`}
        className="flex flex-col gap-3 rounded-none border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
      >
        <div className="flex items-center gap-3">
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
      </Link>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="rounded-none border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        {tt("empty_employees")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={tt("search_ph")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-none border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">{tt("no_results")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{tt("no_results_desc")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {active.map((e) => (
              <Card key={e.id} employee={e} />
            ))}
          </div>

          {inactive.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium text-muted-foreground">
                {tt("no_longer_work")} ({inactive.length})
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {inactive.map((e) => (
                  <Card key={e.id} employee={e} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
