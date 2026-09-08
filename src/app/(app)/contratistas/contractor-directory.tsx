"use client";

import * as React from "react";
import { IdCard, Phone, Search } from "lucide-react";

import type { ContractorWithBalance } from "@/types/contractors";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/planilla/payroll-period";
import { balanceTone, toneTextStyle } from "@/lib/contractors/contractor-colors";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { ContractorAvatar } from "./contractor-avatar";
import { ContractorProfileSheet } from "./contractor-profile-sheet";

/**
 * Directorio de contratistas — una tarjeta por persona con nombre, tipo
 * y el SALDO ACTUAL calculado (verde si Ebony le debe, rojo si el
 * contratista debe, neutro si es 0). Click en la tarjeta abre la ficha
 * con el estado de cuenta completo. Filtra en el cliente sobre lo ya
 * cargado — sin fetch extra. Mismo patrón que el Directorio de Taller.
 */
export function ContractorDirectory({ contractors }: { contractors: ContractorWithBalance[] }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  const [query, setQuery] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contractors;
    return contractors.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.idDocument ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q)
    );
  }, [contractors, query]);

  const openContractor = contractors.find((c) => c.id === openId) ?? null;

  function Card({ contractor }: { contractor: ContractorWithBalance }) {
    const tone = balanceTone(contractor.balanceCents);
    return (
      <button
        type="button"
        onClick={() => setOpenId(contractor.id)}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
      >
        <div className="flex items-center gap-3">
          <ContractorAvatar name={contractor.name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{contractor.name}</p>
            <Badge variant="secondary" className="mt-0.5">
              {contractor.contractorType === "pintor" ? tt("type_pintor") : tt("type_ebanista")}
            </Badge>
          </div>
        </div>

        <div className="flex items-baseline justify-between border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">{tt("balance_label")}</span>
          <span className="text-sm font-semibold tabular-nums" style={toneTextStyle(tone)}>
            {formatCents(contractor.balanceCents)}
          </span>
        </div>
        <p className="-mt-1 text-right text-[11px] text-muted-foreground">
          {tone === "a_favor" ? tt("bal_ebony_owes") : tone === "reduce" ? tt("bal_owes_ebony") : tt("bal_settled")}
        </p>

        <div className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Phone className="size-3.5 shrink-0" />
            {contractor.phone || tt("no_phone")}
          </span>
          <span className="flex items-center gap-1.5">
            <IdCard className="size-3.5 shrink-0" />
            {contractor.idDocument || tt("no_id")}
          </span>
        </div>
      </button>
    );
  }

  if (contractors.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        {tt("empty")}
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
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">{tt("no_results")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{tt("no_results_desc")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c) => (
            <Card key={c.id} contractor={c} />
          ))}
        </div>
      )}

      <ContractorProfileSheet
        contractor={openContractor}
        open={openId !== null}
        onOpenChange={(next) => !next && setOpenId(null)}
      />
    </div>
  );
}
