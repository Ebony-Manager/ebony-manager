"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Check, Loader2, Plus, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  cleanAreaName,
  foldArea,
  sameArea,
  similarAreas,
} from "@/lib/inspections/areas";
import { cn } from "@/lib/utils";
import { createAreaAction } from "./actions";
import { useTi } from "./shared";

const chip = "rounded-full border px-2.5 py-1 text-xs transition-colors";

/**
 * Área: se elige de la lista fija de la obra (un toque). Si no está, se busca
 * y se crea ahí mismo; antes de crear, avisa si hay una parecida
 * ("Recamara principal" ya existe como "Recámara principal").
 */
export function AreaPicker({
  projectId,
  value,
  onChange,
  areas,
  onCreated,
}: {
  projectId: string;
  value: string;
  onChange: (v: string) => void;
  areas: string[];
  onCreated: (name: string) => void;
}) {
  const { ti } = useTi();
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const q = foldArea(query);
  const shown = areas.filter((a) => !q || foldArea(a).includes(q));
  const typed = cleanAreaName(query);
  const exact = typed ? sameArea(typed, areas) : null;
  const similar =
    typed && !exact
      ? similarAreas(typed, areas).filter((a) => !shown.includes(a))
      : [];
  // Un área vieja que no está en la lista (se ve, pero no se ofrece).
  const legacy = value && !areas.includes(value) ? value : null;

  async function create() {
    if (!typed) return;
    setCreating(true);
    const res = await createAreaAction(projectId, typed);
    setCreating(false);
    if (!res.ok) return void toast.error(res.error);
    onCreated(res.data);
    onChange(res.data);
    setQuery("");
  }

  const pick = (a: string) => {
    onChange(value === a ? "" : a);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (exact) pick(exact);
            else if (shown.length === 1) pick(shown[0]);
          }}
          placeholder={areas.length ? ti("area_search_ph") : ti("area_new_ph")}
          className="pl-8"
          autoComplete="off"
        />
      </div>
      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
        {legacy && (
          <span
            className={cn(
              chip,
              "border-primary bg-primary/10 font-medium text-primary",
            )}
          >
            <Check className="mr-1 inline size-3" />
            {legacy}
          </span>
        )}
        {shown.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => pick(a)}
            className={cn(
              chip,
              value === a
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground hover:text-foreground active:bg-muted",
            )}
          >
            {value === a && <Check className="mr-1 inline size-3" />}
            {a}
          </button>
        ))}
        {shown.length === 0 && !typed && (
          <span className="text-xs text-muted-foreground">
            {ti("area_none_yet")}
          </span>
        )}
      </div>
      {typed && !exact && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border p-2">
          {similar.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-warning">{ti("area_similar")}</span>
              {similar.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => pick(a)}
                  className={cn(
                    chip,
                    "border-warning/40 bg-warning/10 text-foreground",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => void create()}
            disabled={creating}
            className="flex items-center gap-1.5 self-start rounded-md px-1 py-0.5 text-sm font-medium text-primary hover:underline"
          >
            {creating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {ti("area_create", { name: typed })}
          </button>
        </div>
      )}
    </div>
  );
}

/** Pieza (opcional): texto libre con las que ya se usaron en la obra a un toque. */
export function PieceInput({
  id,
  value,
  onChange,
  pieces,
  size = "default",
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  pieces: string[];
  size?: "sm" | "default";
}) {
  const { ti } = useTi();
  const typed = foldArea(value);
  const suggestions = pieces
    .filter(
      (p) => foldArea(p) !== typed && (!typed || foldArea(p).includes(typed)),
    )
    .slice(0, 8);
  return (
    <div className="flex flex-col gap-1.5">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ti("piece_ph")}
        autoComplete="off"
        className={size === "sm" ? "h-8 text-sm" : undefined}
      />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={cn(
                chip,
                "border-border text-muted-foreground hover:text-foreground active:bg-muted",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
