"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileUp, Loader2, Trash2, TriangleAlert } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { THE_WOODS } from "@/lib/cotizador/plan-fixtures";
import { buildPlanSection } from "@/lib/cotizador/plan-section";
import { formatMoney, lineAmount, newSection, sectionTotals } from "@/lib/cotizador/pricing";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import type { CatalogItem, QuoteDefaults } from "@/types/cotizador";
import { DEFAULT_ANSWERS, type PieceKind, type PlanAnswers, type PlanPiece, type PlanReading } from "@/types/plan";
import { createPlanSectionAction, planFileUrlAction, readPlanAction } from "../../actions";
import { NumField } from "../../num-field";
import { Viewer3D } from "../viewer-3d";

type Step = "upload" | "review" | "questions";
const KIND_ORDER: PieceKind[] = ["module", "door", "drawer", "shelf", "column", "panel", "countertop", "reference"];
const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Leer un plano, en tres pasos:
 *  1. Subir el PDF o la imagen (o usar la lectura de ejemplo de The Woods).
 *  2. Revisar las piezas que salieron: medidas editables, dudas marcadas,
 *     y el dibujo 3D al lado para ver que coincida con el plano.
 *  3. Cuestionario (lo que el plano no dice) y vista previa de los
 *     renglones con precio. "Crear ítem" lo agrega a la cotización.
 */
export function PlanFlow({
  quoteId,
  clientName,
  defaultLocation,
  catalog,
  defaults,
  hasKey,
  isAdmin,
}: {
  quoteId: string;
  clientName: string;
  defaultLocation: string;
  catalog: CatalogItem[];
  defaults: QuoteDefaults;
  hasKey: boolean;
  isAdmin: boolean;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.cotizador) => t(lang, strings.cotizador[k]);
  const router = useRouter();

  const [step, setStep] = React.useState<Step>("upload");
  const [reading, setReading] = React.useState<PlanReading | null>(null);
  const [source, setSource] = React.useState<"ia" | "ejemplo">("ia");
  const [file, setFile] = React.useState<{ name: string; path: string | null; url: string | null; isPdf: boolean } | null>(null);
  const [busy, setBusy] = React.useState<"reading" | "creating" | null>(null);
  const [answers, setAnswers] = React.useState<PlanAnswers>(DEFAULT_ANSWERS);
  const [location, setLocation] = React.useState(defaultLocation);
  const [name, setName] = React.useState("");
  const [selectedPiece, setSelectedPiece] = React.useState<string | null>(null);

  const start = (r: PlanReading, src: "ia" | "ejemplo") => {
    setReading(r);
    setSource(src);
    setAnswers({ ...DEFAULT_ANSWERS, exteriorFinish: r.finishFromPlan ?? DEFAULT_ANSWERS.exteriorFinish });
    setName(r.title.split("—")[0].trim());
    setStep("review");
  };

  async function onFile(f: File) {
    if (f.size > MAX_BYTES) {
      toast.error(tt("plan_too_big"));
      return;
    }
    setBusy("reading");
    try {
      const safe = f.name.normalize("NFD").replace(/[^\w.-]+/g, "_");
      const path = `${quoteId}/${Date.now()}-${safe}`;
      const { error } = await createClient().storage.from("planos").upload(path, f, { contentType: f.type });
      if (error) throw new Error(error.message);
      const [result, url] = await Promise.all([readPlanAction(path, f.name), planFileUrlAction(path)]);
      setFile({ name: f.name, path, url, isPdf: f.type === "application/pdf" });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      start(result.reading, "ia");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  const patchPiece = (id: string, p: Partial<PlanPiece>) =>
    setReading((r) => (r ? { ...r, pieces: r.pieces.map((x) => (x.id === id ? { ...x, ...p } : x)) } : r));
  const removePiece = (id: string) => setReading((r) => (r ? { ...r, pieces: r.pieces.filter((x) => x.id !== id) } : r));

  // Vista previa del ítem que se va a crear (mismo cálculo que al guardar).
  const preview = React.useMemo(() => {
    if (!reading) return null;
    let n = 0;
    return buildPlanSection({
      sectionId: "preview",
      newId: () => `preview-${n++}`,
      reading,
      answers,
      catalog,
      defaults,
      location,
      name,
    });
  }, [reading, answers, catalog, defaults, location, name]);

  async function onCreate() {
    if (!reading) return;
    setBusy("creating");
    try {
      const sectionId = crypto.randomUUID();
      const { section } = buildPlanSection({ sectionId, newId: () => crypto.randomUUID(), reading, answers, catalog, defaults, location, name });
      await createPlanSectionAction({
        quoteId,
        plan: { fileName: file?.name ?? "", filePath: file?.path ?? null, source, title: reading.title, pieces: reading.pieces, answers, doubts: reading.doubts },
        section,
      });
      toast.success(tt("plan_created"));
      router.push(`/cotizacion/${quoteId}?item=${sectionId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
      setBusy(null);
    }
  }

  const planView = React.useMemo(
    () =>
      reading
        ? {
            pieces: reading.pieces,
            finish: answers.exteriorFinish,
            selected: new Set(selectedPiece ? [selectedPiece] : []),
            covered: new Set(preview?.section.lines.flatMap((l) => l.pieceIds) ?? []),
          }
        : undefined,
    [reading, answers.exteriorFinish, selectedPiece, preview]
  );
  const dummySection = React.useMemo(() => newSection("plan-preview", defaults), [defaults]);
  const noop = React.useCallback(() => {}, []);

  const stepLabel = (s: Step, i: number) => (
    <span key={s} className={cn("flex items-center gap-1.5", step === s ? "font-semibold text-foreground" : "text-muted-foreground")}>
      <span className={cn("flex size-5 items-center justify-center text-[11px]", step === s ? "bg-primary text-primary-foreground" : "bg-muted")}>{i + 1}</span>
      {tt(`plan_step_${s}`)}
    </span>
  );
  const panel = "border border-ink-900/8 bg-card";
  const panelTitle = "border-b border-ink-900/8 px-3.5 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-walnut uppercase";
  const fieldLabel = "flex min-w-0 flex-col gap-1 text-[11px] font-medium text-ink-700";
  const fieldInput = "h-8 w-full min-w-0 border border-input bg-card px-2.5 text-[13px] outline-none focus-visible:border-ring";

  const choice = <K extends keyof PlanAnswers>(key: K, label: string, options: { value: PlanAnswers[K]; label: string }[]) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium text-ink-700">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={answers[key] === o.value}
            onClick={() => setAnswers((a) => ({ ...a, [key]: o.value }))}
            className={cn("border px-2.5 py-1 text-xs", answers[key] === o.value ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:border-ink-700")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-12 sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/cotizacion/${quoteId}`} className="inline-flex items-center gap-1.5 text-sm text-ink-900/50 hover:text-ink-900">
            <ArrowLeft className="size-3.5" />
            {clientName || tt("title")}
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{tt("plan_title")}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">{(["upload", "review", "questions"] as const).map(stepLabel)}</div>
      </div>

      {step === "upload" && (
        <div className={cn(panel, "flex flex-col items-center gap-4 px-6 py-12 text-center")}>
          <div className="flex size-14 items-center justify-center bg-cream-100">
            <FileUp className="size-6 text-walnut" />
          </div>
          <div className="max-w-md">
            <p className="font-semibold">{tt("plan_upload_title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{tt("plan_upload_body")}</p>
          </div>
          {busy === "reading" ? (
            <p className="inline-flex items-center gap-2 text-sm text-ink-700">
              <Loader2 className="size-4 animate-spin" />
              {tt("plan_reading")}
            </p>
          ) : hasKey ? (
            <label className="inline-flex cursor-pointer items-center gap-2 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <FileUp className="size-4" />
              {tt("plan_choose")}
              <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => e.currentTarget.files?.[0] && onFile(e.currentTarget.files[0])} />
            </label>
          ) : (
            <p className="max-w-md bg-[color-mix(in_srgb,var(--status-warn)_14%,white)] px-3 py-2 text-xs text-ink-700">{tt("plan_no_key")}</p>
          )}
          <button type="button" onClick={() => start(THE_WOODS, "ejemplo")} className="text-xs text-muted-foreground underline decoration-ink-900/16 hover:text-foreground">
            {tt("plan_use_example")}
          </button>
        </div>
      )}

      {step !== "upload" && reading && (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4">
            <Viewer3D section={dummySection} plan={planView} onMoveLine={noop} onHostLine={noop} onShape={noop} onReset={noop} />
            {file?.url && (
              <div className={panel}>
                <h2 className={panelTitle}>{file.name}</h2>
                {file.isPdf ? (
                  <iframe src={file.url} title={file.name} className="h-[520px] w-full" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- enlace firmado temporal de Supabase
                  <img src={file.url} alt={file.name} className="w-full" />
                )}
              </div>
            )}
            {source === "ejemplo" && <p className="text-xs text-muted-foreground">{tt("plan_example_note")}</p>}
          </div>

          {step === "review" ? (
            <div className="flex min-w-0 flex-col gap-3">
              <div className={panel}>
                <h2 className={panelTitle}>{reading.title}</h2>
                {reading.doubts.length > 0 && (
                  <ul className="m-3.5 flex flex-col gap-1 bg-[color-mix(in_srgb,var(--status-warn)_12%,white)] px-3 py-2 text-xs text-ink-700">
                    {reading.doubts.map((d) => (
                      <li key={d} className="flex gap-1.5">
                        <TriangleAlert className="mt-0.5 size-3 shrink-0 text-[var(--status-warn)]" />
                        {d}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-col">
                  {KIND_ORDER.map((kind) => {
                    const list = reading.pieces.filter((p) => p.kind === kind);
                    if (!list.length) return null;
                    return (
                      <div key={kind}>
                        <p className="bg-cream-100/60 px-3.5 py-1.5 text-xs font-semibold text-walnut">{tt(`kind_${kind}`)}</p>
                        {list.map((p) => (
                          <div
                            key={p.id}
                            onClickCapture={() => setSelectedPiece(p.id)}
                            onFocusCapture={() => setSelectedPiece(p.id)}
                            className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink-900/8 px-3.5 py-1.5 text-xs", selectedPiece === p.id && "bg-[color-mix(in_srgb,#c9a84c_14%,white)]")}
                          >
                            <span className="min-w-0 flex-[1_1_160px]">
                              <span className="font-medium text-foreground">{p.label}</span>
                              {p.material === "stone" && <span className="ml-1.5 bg-stone-200 px-1 text-[10px]">{tt("plan_not_quoted")}</span>}
                              {p.confidence !== "alta" && (
                                <span className="ml-1.5 bg-[color-mix(in_srgb,var(--status-warn)_16%,white)] px-1 text-[10px] text-[var(--status-warn)]">
                                  {tt(`conf_${p.confidence}`)}
                                </span>
                              )}
                              {p.notes && <span className="block text-[11px] text-muted-foreground">{p.notes}</span>}
                            </span>
                            <span className="flex items-center gap-1">
                              <NumField value={p.w} onChange={(n) => patchPiece(p.id, { w: n })} suffix="m" inputWidth={38} aria-label={tt("line_width")} title={tt("line_width")} />
                              <span className="text-muted-foreground">×</span>
                              <NumField value={p.h} onChange={(n) => patchPiece(p.id, { h: n })} suffix="m" inputWidth={38} aria-label={tt("line_height")} title={tt("line_height")} />
                              <span className="text-muted-foreground">×</span>
                              <NumField value={p.d} onChange={(n) => patchPiece(p.id, { d: n })} suffix="m" inputWidth={38} aria-label={tt("plan_depth")} title={tt("plan_depth")} />
                            </span>
                            {p.leaves && <span className="text-[11px] text-muted-foreground">{p.leaves.length} {tt("plan_leaves")}</span>}
                            <button type="button" aria-label={tt("delete")} title={tt("delete")} onClick={() => removePiece(p.id)} className="p-1 text-muted-foreground hover:text-destructive">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-between gap-2">
                <Button size="sm" variant="ghost" onClick={() => setStep("upload")}>
                  {tt("plan_back")}
                </Button>
                <Button size="sm" onClick={() => setStep("questions")}>
                  {tt("plan_next_questions")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 flex-col gap-3">
              <div className={cn(panel, "flex flex-col gap-4 p-3.5")}>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className={fieldLabel}>
                    {tt("sec_location")}
                    <input className={fieldInput} value={location} placeholder={tt("sec_location_ph")} onChange={(e) => setLocation(e.currentTarget.value)} />
                  </label>
                  <label className={fieldLabel}>
                    {tt("sec_name")}
                    <input className={fieldInput} value={name} placeholder={tt("sec_name_ph")} onChange={(e) => setName(e.currentTarget.value)} />
                  </label>
                </div>
                {choice("exteriorFinish", `${tt("q_finish")}${reading.finishFromPlan ? ` · ${tt("q_from_plan")}` : ""}`, [
                  { value: "pintado", label: tt("finish_pintado") },
                  { value: "chapilla", label: tt("finish_chapilla") },
                  { value: "aglomerado", label: tt("finish_aglomerado") },
                ])}
                {choice("opening", tt("q_opening"), [
                  { value: "gola", label: tt("q_open_gola") },
                  { value: "push", label: tt("q_open_push") },
                  { value: "tirador", label: tt("q_open_tirador") },
                ])}
                {answers.opening === "tirador" &&
                  choice("pullsIncluded", tt("q_pulls"), [
                    { value: true, label: tt("q_yes") },
                    { value: false, label: tt("q_no") },
                  ])}
                {choice("hinge", tt("q_hinge"), [
                  { value: "recta", label: tt("q_hinge_recta") },
                  { value: "cangrejo", label: tt("q_hinge_cangrejo") },
                ])}
                {choice("slide", tt("q_slide"), [
                  { value: "economico", label: tt("q_slide_eco") },
                  { value: "blum", label: tt("q_slide_blum") },
                  { value: "lateral", label: tt("q_slide_lateral") },
                ])}
                <div className="grid grid-cols-2 gap-2.5">
                  <label className={fieldLabel}>
                    {tt("q_led")}
                    <NumField value={answers.ledMl} onChange={(n) => setAnswers((a) => ({ ...a, ledMl: n }))} suffix="ML" inputWidth={48} className="h-8 justify-between" />
                  </label>
                  <label className={fieldLabel}>
                    {tt("q_metal")}
                    <NumField value={answers.metalMl} onChange={(n) => setAnswers((a) => ({ ...a, metalMl: n }))} suffix="ML" inputWidth={48} className="h-8 justify-between" />
                  </label>
                </div>
                <p className="text-[11px] text-muted-foreground">{tt("q_always")}</p>
              </div>

              {preview && (
                <div className={panel}>
                  <h2 className={panelTitle}>{tt("plan_preview")}</h2>
                  <div className="flex flex-col p-3.5 text-sm">
                    {preview.section.lines.map((l) => (
                      <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 border-b border-ink-900/8 py-1 last:border-0">
                        <span className="truncate">{l.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {l.qty} {l.unit === "m2" ? "m²" : l.unit === "ml" ? "ML" : "u"}
                        </span>
                        <span className="text-right tabular-nums">{formatMoney(lineAmount(l))}</span>
                      </div>
                    ))}
                    <div className="mt-2 flex justify-between gap-3 border-t border-ink-900/8 pt-2 font-semibold">
                      <span>{tt("plan_item_total")}</span>
                      <span className="tabular-nums">{formatMoney(sectionTotals(preview.section).total)}</span>
                    </div>
                    {preview.missingCodes.length > 0 && (
                      <p className="mt-2 text-xs text-[var(--status-error)]">
                        {tt("plan_missing_codes")} {preview.missingCodes.join(", ")}
                        {isAdmin ? "" : ` ${tt("plan_ask_admin")}`}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-between gap-2">
                <Button size="sm" variant="ghost" onClick={() => setStep("review")}>
                  {tt("plan_back")}
                </Button>
                <Button size="sm" onClick={onCreate} disabled={busy === "creating"}>
                  {busy === "creating" && <Loader2 className="size-3.5 animate-spin" />}
                  {tt("plan_create")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
