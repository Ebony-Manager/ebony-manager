"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Layers, MailWarning, Paintbrush, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/page-header";
import { FormSection } from "@/components/shared/form-section";
import type { TallerPainter, VeneerType } from "@/types/taller";
import { addVeneerTypeAction, setPainterInTurnAction, setVeneerTypeActiveAction } from "./actions";
import { PainterAvatar, useTt } from "./shared";

/**
 * Taller → Pintores y chapillas: quiénes entran al turno de muestras (se activa/desactiva aparte de Contratistas; ej.
 * Elkin sigue activo pero no hace muestras) y la lista de tipos de chapilla que se eligen al pedir una muestra.
 */
export function PaintersView({ painters, veneers }: { painters: TallerPainter[]; veneers: VeneerType[] }) {
  const { tt } = useTt();
  const [busy, setBusy] = React.useState(false);
  const [newVeneer, setNewVeneer] = React.useState("");

  async function toggleTurn(p: TallerPainter) {
    setBusy(true);
    const res = await setPainterInTurnAction(p.contractorId, !p.inTurn);
    setBusy(false);
    if (!res.ok) toast.error(res.error);
  }

  async function addVeneer(e: React.FormEvent) {
    e.preventDefault();
    const name = newVeneer.trim();
    if (!name) return;
    setBusy(true);
    const res = await addVeneerTypeAction(name);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    setNewVeneer("");
    toast.success(tt("saved"));
  }

  async function toggleVeneer(v: VeneerType) {
    setBusy(true);
    const res = await setVeneerTypeActiveAction(v.id, !v.active);
    setBusy(false);
    if (!res.ok) toast.error(res.error);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <FormSection icon={Paintbrush} title={tt("painters_title")} note={tt("painters_hint")}>
        {painters.length === 0 ? (
          <EmptyState>{tt("no_painters")}</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {painters.map((p) => (
              <li key={p.contractorId} className="flex items-center gap-3 px-3 py-2.5">
                <PainterAvatar painter={p} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    {p.turnRank === 1 && <span className="font-medium text-primary">{tt("painter_turn")}</span>}
                    {!p.hasEmail && (
                      <span className="flex items-center gap-1">
                        <MailWarning className="size-3.5" />
                        {tt("painter_no_email")}
                      </span>
                    )}
                  </p>
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
                  <input type="checkbox" className="size-4 accent-primary" checked={p.inTurn} disabled={busy} onChange={() => void toggleTurn(p)} />
                  {tt("in_turn")}
                </label>
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      <FormSection icon={Layers} title={tt("veneers_title")}>
        <div className="flex flex-col gap-3">
          <form onSubmit={addVeneer} className="flex gap-2">
            <Input value={newVeneer} onChange={(e) => setNewVeneer(e.target.value)} placeholder={tt("veneer_add_ph")} aria-label={tt("veneer_add_ph")} className="h-9" />
            <Button type="submit" size="sm" className="h-9 shrink-0" disabled={busy || !newVeneer.trim()}>
              <Plus className="size-3.5" />
              {tt("add")}
            </Button>
          </form>
          {veneers.length === 0 ? (
            <EmptyState>{tt("no_veneers")}</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {veneers.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-3 py-2">
                  <span className={`min-w-0 flex-1 truncate text-sm ${v.active ? "text-foreground" : "text-muted-foreground line-through"}`}>{v.name}</span>
                  <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
                    <input type="checkbox" className="size-4 accent-primary" checked={v.active} disabled={busy} onChange={() => void toggleVeneer(v)} />
                    {tt("active")}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </FormSection>
    </div>
  );
}
