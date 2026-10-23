"use client";

import * as React from "react";

import { buildPlanScene } from "@/lib/cotizador/plan-scene";
import { coverage } from "@/lib/cotizador/plan-rules";
import { buildScene } from "@/lib/cotizador/scene";
import { cn } from "@/lib/utils";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import type { Finish, QuoteSection, Wall, WallShape } from "@/types/cotizador";
import type { PlanPiece } from "@/types/plan";
import { NumField } from "../num-field";
import type { Viewer } from "./viewer-engine";

const PAINTS = [
  { id: "greige", hex: "#d9d3c7" },
  { id: "carbon", hex: "#4a4a48" },
  { id: "oliva", hex: "#7d8468" },
  { id: "terracota", hex: "#b9714f" },
  { id: "blanco", hex: "#f4f1ea" },
];

/** Ítem generado desde un plano: el dibujo sale exacto de sus piezas. */
export interface PlanView {
  pieces: PlanPiece[];
  finish: Exclude<Finish, "blanco">;
  /** Piezas del renglón seleccionado (se resaltan). */
  selected: Set<string>;
  /** Piezas que cubre algún renglón del ítem (para la cobertura). */
  covered: Set<string>;
}

/**
 * Dibujo 3D del ítem en edición. La escena sale de los renglones
 * (`buildScene`); este componente solo monta el motor de three.js (que se
 * descarga aparte, solo al abrir una cotización) y traduce lo que el
 * usuario arrastra a cambios en los renglones.
 */
export function Viewer3D({
  section,
  onMoveLine,
  onHostLine,
  onShape,
  onReset,
  plan,
}: {
  section: QuoteSection;
  plan?: PlanView;
  onMoveLine: (lineId: string, wall: Wall, x: number, y: number) => void;
  onHostLine: (lineId: string, hostLineId: string) => void;
  onShape: (shape: WallShape, cornerAt: number | null) => void;
  onReset: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.cotizador) => t(lang, strings.cotizador[k]);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const viewerRef = React.useRef<Viewer | null>(null);
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [paint, setPaint] = React.useState(PAINTS[0].hex);
  const [interior, setInterior] = React.useState(false);
  const [showMissing, setShowMissing] = React.useState(false);

  // Los callbacks cambian en cada render; el motor se crea una sola vez y
  // siempre llama a los más recientes a través de esta referencia.
  const handlers = React.useRef({ onMoveLine, onHostLine });
  React.useEffect(() => {
    handlers.current = { onMoveLine, onHostLine };
  });

  React.useEffect(() => {
    let cancelled = false;
    let viewer: Viewer | null = null;
    (async () => {
      try {
        const [T, { createViewer }] = await Promise.all([import("three"), import("./viewer-engine")]);
        if (cancelled || !canvasRef.current) return;
        viewer = createViewer(T, canvasRef.current, {
          onMove: (id, wall, x, y) => handlers.current.onMoveLine(id, wall, x, y),
          onHost: (id, host) => handlers.current.onHostLine(id, host),
        });
        viewerRef.current = viewer;
        setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      viewer?.dispose();
      viewerRef.current = null;
    };
  }, []);

  const cover = React.useMemo(() => (plan ? coverage(plan.pieces, plan.covered) : null), [plan]);
  const scene = React.useMemo(
    () =>
      plan
        ? buildPlanScene(plan.pieces, {
            finish: plan.finish,
            selected: plan.selected,
            missing: showMissing && cover ? new Set(cover.missing.map((p) => p.id)) : undefined,
            interior,
          })
        : buildScene(section),
    [plan, section, showMissing, cover, interior]
  );
  const excludedNote = plan ? notIncluded(plan.pieces, tt) : "";
  React.useEffect(() => {
    if (ready) viewerRef.current?.setScene(scene, paint);
  }, [ready, scene, paint]);

  const isCorner = section.wallShape === "L";
  const empty = scene.groups.length === 0;

  return (
    <div className="border border-ink-900/8 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-900/8 px-3.5 py-2.5">
        <h2 className="text-[11px] font-semibold tracking-[0.08em] text-walnut uppercase">{tt("viewer_title")}</h2>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{tt("viewer_paint")}</span>
          {PAINTS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-label={p.id}
              aria-pressed={paint === p.hex}
              onClick={() => setPaint(p.hex)}
              className={cn(
                "size-[18px] rounded-full border-2 border-card ring-1",
                paint === p.hex ? "ring-2 ring-ink-900" : "ring-ink-900/16"
              )}
              style={{ background: p.hex }}
            />
          ))}
        </div>
      </div>

      {plan ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-900/8 px-3.5 py-2 text-xs text-ink-700">
          <div className="inline-flex border border-input">
            {([false, true] as const).map((v) => (
              <button
                key={String(v)}
                type="button"
                aria-pressed={interior === v}
                onClick={() => setInterior(v)}
                className={cn("px-2.5 py-1", interior === v ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted/50")}
              >
                {v ? tt("viewer_interior") : tt("viewer_exterior")}
              </button>
            ))}
          </div>
          {cover && (
            <button
              type="button"
              aria-pressed={showMissing}
              onClick={() => setShowMissing((x) => !x)}
              title={tt("viewer_coverage_hint")}
              className={cn(
                "ml-auto px-2 py-0.5 font-semibold tabular-nums",
                cover.missing.length === 0
                  ? "bg-[color-mix(in_srgb,var(--status-ok)_16%,white)] text-[var(--status-ok)]"
                  : "bg-[color-mix(in_srgb,var(--status-error)_13%,white)] text-[var(--status-error)]",
                showMissing && "ring-1 ring-current"
              )}
            >
              {cover.missing.length === 0
                ? `${tt("viewer_coverage")} 100%`
                : `${tt("viewer_coverage")} ${cover.pct}% · ${cover.missing.length} ${tt("viewer_missing")}`}
            </button>
          )}
        </div>
      ) : (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-900/8 px-3.5 py-2 text-xs text-ink-700">
        <div className="inline-flex border border-input">
          {(["recta", "L"] as const).map((shape) => (
            <button
              key={shape}
              type="button"
              aria-pressed={section.wallShape === shape}
              onClick={() => onShape(shape, shape === "L" ? (section.cornerAt ?? Math.round(scene.extentA * 100) / 100) : section.cornerAt)}
              className={cn("px-2.5 py-1", section.wallShape === shape ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted/50")}
            >
              {shape === "recta" ? tt("viewer_straight") : tt("viewer_corner")}
            </button>
          ))}
        </div>
        {isCorner && (
          <label className="flex items-center gap-1.5">
            {tt("viewer_corner_at")}
            <NumField value={section.cornerAt ?? 0} onChange={(n) => onShape("L", n)} suffix="m" inputWidth={40} aria-label={tt("viewer_corner_at")} />
          </label>
        )}
        <button type="button" onClick={onReset} className="ml-auto text-[11px] text-muted-foreground underline decoration-ink-900/16 hover:text-foreground">
          {tt("viewer_reset")}
        </button>
      </div>
      )}

      <div className="relative bg-[#efe9df]">
        {failed ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">{tt("viewer_failed")}</p>
        ) : (
          <>
            <canvas ref={canvasRef} aria-label={tt("viewer_title")} className="block h-[340px] w-full cursor-grab touch-pan-y" />
            <p className="pointer-events-none absolute bottom-2 left-2.5 bg-white/70 px-1.5 py-0.5 text-[11px] text-ink-700">
              {empty ? tt("viewer_hint_empty") : plan ? tt("viewer_hint_plan") : scene.approximate ? tt("viewer_hint_approx") : tt("viewer_hint")}
            </p>
            {excludedNote && (
              <p className="pointer-events-none absolute top-2 left-2.5 max-w-[80%] bg-white/80 px-1.5 py-0.5 text-[11px] font-medium text-ink-700">{excludedNote}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** "No incluye piedra, TV ni aire acondicionado" — lo que se dibuja sin cotizarse. */
function notIncluded(pieces: PlanPiece[], tt: (k: keyof typeof strings.cotizador) => string): string {
  const parts: string[] = [];
  if (pieces.some((p) => p.material === "stone")) parts.push(tt("ni_stone"));
  if (pieces.some((p) => p.ref === "tv")) parts.push(tt("ni_tv"));
  if (pieces.some((p) => p.ref === "ac")) parts.push(tt("ni_ac"));
  if (pieces.some((p) => p.ref === "sound")) parts.push(tt("ni_sound"));
  if (!parts.length) return "";
  const list = parts.length < 2 ? parts[0] : `${parts.slice(0, -1).join(", ")} ${tt("ni_and")} ${parts[parts.length - 1]}`;
  return `${tt("ni_prefix")} ${list}`;
}
