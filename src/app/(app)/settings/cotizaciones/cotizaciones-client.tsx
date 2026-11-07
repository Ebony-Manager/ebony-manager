"use client";

import * as React from "react";
import toast from "react-hot-toast";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  FileText,
  IndentDecrease,
  IndentIncrease,
  Landmark,
  Plus,
  Shapes,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { PAGE_CLASS, PageHeader } from "@/components/shared/page-header";
import { TermsBody } from "@/components/shared/terms-view";
import { useLang } from "@/context/language-context";
import { strings, t } from "@/lib/i18n";
import {
  DEFAULT_TERMS,
  flattenItems,
  unflattenItems,
  type PointRow,
  type AccountType,
  type CompanyInfo,
  type DocumentSettings,
  type PaymentInfo,
  type QuoteTerms,
} from "@/lib/settings/documents";
import {
  saveCompanyAction,
  saveKindsAction,
  savePaymentAction,
  saveTermsAction,
} from "./actions";

type Tk = keyof typeof strings.docsettings;
type TFn = (k: Tk) => string;

/**
 * Settings → Cotizaciones: lo que sale en cada cotización para el cliente.
 * Tres tarjetas, cada una con su "Guardar".
 */
export function CotizacionesSettingsClient({
  settings,
  kinds,
}: {
  settings: DocumentSettings;
  kinds: string[];
}) {
  const { lang } = useLang();
  const td: TFn = (k) => t(lang, strings.docsettings[k]);
  return (
    <div className={PAGE_CLASS}>
      <PageHeader title={td("title")} subtitle={td("subtitle")} />
      <CompanyCard initial={settings.company} td={td} />
      <PaymentCard initial={settings.payment} td={td} />
      <KindsCard initial={kinds} td={td} />
      <TermsCard initial={settings.terms} td={td} />
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  hint,
  children,
  footer,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <section className="flex max-w-3xl flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-walnut" />
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
      </div>
      {children}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
        {footer}
      </div>
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function useSaver<T>(
  initial: T,
  save: (v: T) => Promise<{ ok: true } | { ok: false; error: string }>,
  td: TFn,
) {
  const [value, setValue] = React.useState(initial);
  const [saved, setSaved] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const dirty = JSON.stringify(value) !== JSON.stringify(saved);
  async function submit(v: T = value) {
    setSaving(true);
    const res = await save(v);
    setSaving(false);
    if (res.ok) {
      setSaved(v);
      toast.success(td("saved"));
    } else toast.error(res.error);
  }
  return { value, setValue, saved, dirty, saving, submit };
}

function CompanyCard({ initial, td }: { initial: CompanyInfo; td: TFn }) {
  const { value, setValue, dirty, saving, submit } = useSaver(
    initial,
    saveCompanyAction,
    td,
  );
  const set =
    (k: keyof CompanyInfo) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setValue((v) => ({ ...v, [k]: e.target.value }));
  return (
    <Card
      icon={Building2}
      title={td("company_title")}
      hint={td("company_hint")}
      footer={
        <Button
          size="sm"
          onClick={() => void submit()}
          disabled={saving || !dirty}
        >
          {saving ? td("saving") : td("save")}
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={td("f_legal_name")}>
          <Input value={value.legalName} onChange={set("legalName")} />
        </Field>
        <Field label={td("f_ruc")}>
          <Input value={value.ruc} onChange={set("ruc")} />
        </Field>
        <Field label={td("f_phone")}>
          <Input value={value.phone} onChange={set("phone")} inputMode="tel" />
        </Field>
        <Field label={td("f_email")}>
          <Input value={value.email} onChange={set("email")} type="email" />
        </Field>
        <Field label={td("f_address")} className="sm:col-span-2">
          <Input value={value.address} onChange={set("address")} />
        </Field>
      </div>
    </Card>
  );
}

function PaymentCard({ initial, td }: { initial: PaymentInfo; td: TFn }) {
  const { value, setValue, saved, dirty, saving, submit } = useSaver(
    initial,
    savePaymentAction,
    td,
  );
  const set =
    (k: keyof PaymentInfo) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValue((v) => ({ ...v, [k]: e.target.value }));
  // Cambiar el banco o la cuenta pide un segundo toque: es a donde pagan los clientes.
  const accountChanged =
    value.bank.trim() !== saved.bank ||
    value.accountNumber.trim() !== saved.accountNumber ||
    value.holder.trim() !== saved.holder ||
    value.accountType !== saved.accountType;
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(id);
  }, [armed]);
  const onSave = () => {
    if (accountChanged && !armed) return setArmed(true);
    setArmed(false);
    void submit();
  };
  return (
    <Card
      icon={Landmark}
      title={td("payment_title")}
      hint={td("payment_hint")}
      footer={
        <Button
          size="sm"
          variant={armed ? "destructive" : "default"}
          onClick={onSave}
          disabled={saving || !dirty}
        >
          {armed && <Landmark className="size-3.5" />}
          {saving ? td("saving") : armed ? td("confirm_account") : td("save")}
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={td("f_bank")}>
          <Input value={value.bank} onChange={set("bank")} />
        </Field>
        <Field label={td("f_account_type")}>
          <Select
            value={value.accountType}
            onValueChange={(accountType) =>
              setValue((v) => ({
                ...v,
                accountType: accountType as AccountType,
              }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="corriente">{td("acc_corriente")}</SelectItem>
              <SelectItem value="ahorros">{td("acc_ahorros")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={td("f_account_number")}>
          <Input
            value={value.accountNumber}
            onChange={set("accountNumber")}
            className="tabular-nums"
          />
        </Field>
        <Field label={td("f_holder")}>
          <Input value={value.holder} onChange={set("holder")} />
        </Field>
        <Field label={td("f_pay_terms_es")} className="sm:col-span-2">
          <Textarea value={value.termsEs} onChange={set("termsEs")} rows={2} />
        </Field>
        <Field label={td("f_pay_terms_en")} className="sm:col-span-2">
          <Textarea value={value.termsEn} onChange={set("termsEn")} rows={2} />
        </Field>
      </div>
    </Card>
  );
}

/** Para editar: cada sección con sus puntos en una lista (cada uno con su llave). */
interface DraftPoint extends PointRow {
  key: number;
}
interface DraftSection {
  key: number;
  title: string;
  points: DraftPoint[];
}
interface Draft {
  title: string;
  intro: string;
  sections: DraftSection[];
}

let seq = 0;
const newKey = () => ++seq;

function toDraft(terms: QuoteTerms): Draft {
  return {
    title: terms.title,
    intro: terms.intro,
    sections: terms.sections.map((s) => ({
      key: newKey(),
      title: s.title,
      points: flattenItems(s.items).map((p) => ({ ...p, key: newKey() })),
    })),
  };
}

function fromDraft(d: Draft): QuoteTerms {
  return {
    title: d.title,
    intro: d.intro,
    sections: d.sections.map((s) => ({
      title: s.title,
      items: unflattenItems(s.points),
    })),
  };
}

function swap<T>(list: T[], i: number, d: -1 | 1): T[] {
  if (i + d < 0 || i + d >= list.length) return list;
  const out = [...list];
  [out[i], out[i + d]] = [out[i + d], out[i]];
  return out;
}

function TermsCard({ initial, td }: { initial: QuoteTerms; td: TFn }) {
  const [start] = React.useState(() => toDraft(initial));
  // "Sin cambios" compara lo que se guardaría, no las llaves.
  const { value, setValue, saved, saving, submit } = useSaver(
    start,
    (d) => saveTermsAction(fromDraft(d)),
    td,
  );
  const dirty =
    JSON.stringify(fromDraft(value)) !== JSON.stringify(fromDraft(saved));
  const [mode, setMode] = React.useState<"edit" | "preview">("edit");

  const setSections = (fn: (s: DraftSection[]) => DraftSection[]) =>
    setValue((v) => ({ ...v, sections: fn(v.sections) }));
  const setSection = (key: number, fn: (s: DraftSection) => DraftSection) =>
    setSections((ss) => ss.map((s) => (s.key === key ? fn(s) : s)));
  const setPoints = (key: number, fn: (p: DraftPoint[]) => DraftPoint[]) =>
    setSection(key, (s) => ({ ...s, points: fn(s.points) }));
  const save = () => {
    if (
      value.sections.some(
        (s) => !s.title.trim() || unflattenItems(s.points).length === 0,
      )
    )
      return toast.error(td("empty_section"));
    void submit();
  };

  return (
    <Card
      icon={FileText}
      title={td("terms_title")}
      hint={td("terms_hint")}
      footer={
        <>
          <ConfirmButton
            label={td("restore_defaults")}
            confirmLabel={td("confirm_restore")}
            icon={RotateCcw}
            onConfirm={() => setValue(toDraft(DEFAULT_TERMS))}
            className="mr-auto"
          />
          <Button size="sm" onClick={save} disabled={saving || !dirty}>
            {saving ? td("saving") : td("save")}
          </Button>
        </>
      }
    >
      <SegmentedFilter
        value={mode}
        onChange={setMode}
        options={[
          { value: "edit", label: td("edit") },
          { value: "preview", label: td("preview") },
        ]}
      />

      {mode === "preview" ? (
        <div className="rounded-md border border-border p-4 text-xs leading-relaxed text-foreground/80">
          <p className="text-sm font-semibold text-foreground">{value.title}</p>
          <TermsBody terms={fromDraft(value)} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label={td("f_terms_title")}>
            <Input
              value={value.title}
              onChange={(e) =>
                setValue((v) => ({ ...v, title: e.target.value }))
              }
            />
          </Field>
          <Field label={td("f_terms_intro")}>
            <Textarea
              value={value.intro}
              onChange={(e) =>
                setValue((v) => ({ ...v, intro: e.target.value }))
              }
              className="field-sizing-content"
            />
          </Field>
          <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {td("items_hint")}
          </p>
          {value.sections.map((s, i) => (
            <div
              key={s.key}
              className="flex flex-col gap-2 rounded-md border border-border p-3"
            >
              <div className="flex items-end gap-1">
                <Field label={td("f_section_title")} className="min-w-0 flex-1">
                  <Input
                    value={s.title}
                    onChange={(e) =>
                      setSection(s.key, (x) => ({
                        ...x,
                        title: e.target.value,
                      }))
                    }
                    className="font-semibold"
                  />
                </Field>
                <IconBtn
                  icon={ArrowUp}
                  label={td("move_up")}
                  disabled={i === 0}
                  onClick={() => setSections((ss) => swap(ss, i, -1))}
                />
                <IconBtn
                  icon={ArrowDown}
                  label={td("move_down")}
                  disabled={i === value.sections.length - 1}
                  onClick={() => setSections((ss) => swap(ss, i, 1))}
                />
                <ConfirmButton
                  iconOnly
                  label={td("remove_section")}
                  confirmLabel={td("confirm_remove")}
                  onConfirm={() =>
                    setSections((ss) => ss.filter((x) => x.key !== s.key))
                  }
                  className="mb-2.5 px-1.5"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {td("f_section_items")}
              </span>
              <ol className="flex flex-col gap-1.5">
                {s.points.map((p, j) => (
                  <li
                    key={p.key}
                    className={`flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-1 ${p.sub ? "pl-6 sm:pl-8" : ""}`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-1">
                      <span className="mt-2 w-3 shrink-0 text-center text-sm text-muted-foreground">
                        {p.sub ? "–" : "•"}
                      </span>
                      <Textarea
                        value={p.text}
                        onChange={(e) =>
                          setPoints(s.key, (ps) =>
                            ps.map((x) =>
                              x.key === p.key
                                ? { ...x, text: e.target.value }
                                : x,
                            ),
                          )
                        }
                        className="field-sizing-content min-h-9 py-1.5 text-[13px] leading-relaxed"
                        rows={1}
                      />
                    </div>
                    <div className="flex shrink-0 items-center justify-end">
                      <IconBtn
                        icon={p.sub ? IndentDecrease : IndentIncrease}
                        label={p.sub ? td("make_point") : td("make_sub")}
                        disabled={!p.sub && j === 0}
                        onClick={() =>
                          setPoints(s.key, (ps) =>
                            ps.map((x) =>
                              x.key === p.key ? { ...x, sub: !x.sub } : x,
                            ),
                          )
                        }
                      />
                      <IconBtn
                        icon={ArrowUp}
                        label={td("move_up")}
                        disabled={j === 0}
                        onClick={() =>
                          setPoints(s.key, (ps) => swap(ps, j, -1))
                        }
                      />
                      <IconBtn
                        icon={ArrowDown}
                        label={td("move_down")}
                        disabled={j === s.points.length - 1}
                        onClick={() => setPoints(s.key, (ps) => swap(ps, j, 1))}
                      />
                      <ConfirmButton
                        iconOnly
                        label={td("remove_point")}
                        confirmLabel={td("confirm_remove")}
                        onConfirm={() =>
                          setPoints(s.key, (ps) =>
                            ps.filter((x) => x.key !== p.key),
                          )
                        }
                        className="px-1.5"
                      />
                    </div>
                  </li>
                ))}
              </ol>
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() =>
                  setPoints(s.key, (ps) => [
                    ...ps,
                    { key: newKey(), text: "", sub: false },
                  ])
                }
              >
                <Plus className="size-3.5" />
                {td("add_point")}
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              setSections((ss) => [
                ...ss,
                {
                  key: newKey(),
                  title: "",
                  points: [{ key: newKey(), text: "", sub: false }],
                },
              ])
            }
          >
            <Plus className="size-3.5" />
            {td("add_section")}
          </Button>
        </div>
      )}
    </Card>
  );
}

function IconBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  className,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`size-8 ${className ?? ""}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="size-4" />
    </Button>
  );
}

/** Los tipos de ítem del cotizador: agregar, renombrar, ordenar y quitar. */
function KindsCard({ initial, td }: { initial: string[]; td: TFn }) {
  const [rows, setRows] = React.useState(() =>
    initial.map((name) => ({ key: newKey(), name })),
  );
  const [saved, setSaved] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const clean = rows.map((r) => r.name.trim()).filter(Boolean);
  const dirty = clean.join("\n") !== saved.join("\n");
  const dupes =
    new Set(clean.map((n) => n.toLowerCase())).size !== clean.length;

  async function save() {
    if (clean.length === 0) return toast.error(td("kinds_empty"));
    if (dupes) return toast.error(td("kinds_dupe"));
    setSaving(true);
    const res = await saveKindsAction(clean);
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    setSaved(clean);
    setRows(clean.map((name) => ({ key: newKey(), name })));
    toast.success(td("saved"));
  }

  return (
    <Card
      icon={Shapes}
      title={td("kinds_title")}
      hint={td("kinds_hint")}
      footer={
        <Button
          size="sm"
          onClick={() => void save()}
          disabled={saving || !dirty}
        >
          {saving ? td("saving") : td("save")}
        </Button>
      }
    >
      <ol className="flex max-w-md flex-col gap-1.5">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-center gap-1">
            <Input
              value={r.name}
              onChange={(e) =>
                setRows((rs) =>
                  rs.map((x) =>
                    x.key === r.key ? { ...x, name: e.target.value } : x,
                  ),
                )
              }
              aria-label={td("kinds_title")}
            />
            <IconBtn
              icon={ArrowUp}
              label={td("move_up")}
              disabled={i === 0}
              onClick={() => setRows((rs) => swap(rs, i, -1))}
            />
            <IconBtn
              icon={ArrowDown}
              label={td("move_down")}
              disabled={i === rows.length - 1}
              onClick={() => setRows((rs) => swap(rs, i, 1))}
            />
            <ConfirmButton
              iconOnly
              label={td("kinds_remove")}
              confirmLabel={td("confirm_remove")}
              onConfirm={() =>
                setRows((rs) => rs.filter((x) => x.key !== r.key))
              }
              className="px-1.5"
            />
          </li>
        ))}
      </ol>
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => setRows((rs) => [...rs, { key: newKey(), name: "" }])}
      >
        <Plus className="size-3.5" />
        {td("kinds_add")}
      </Button>
    </Card>
  );
}
