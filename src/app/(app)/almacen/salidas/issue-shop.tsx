"use client";

import { ListToolbar } from "@/components/shared/search-input";
import * as React from "react";
import toast from "react-hot-toast";
import { Check, Minus, Plus, ShoppingCart, X } from "lucide-react";

import { INTERNAL_USES, type InternalUse, type InventoryCategory, type InventoryItem, type InventoryPerson } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { formatQty, parseQty, stockStatus } from "@/lib/almacen/inventory";
import { dimensionCount, optionsAt, reconcile, resolveVariant, selectionOf } from "@/lib/almacen/variant-picker";
import { Field } from "../../contratistas/field";
import { registerIssueAction } from "../actions";
import { Combo, EmptyBox, ItemThumb, SearchBox, qtyWithUnit, useTa, useVariantIndex } from "../shared";

type Project = { id: string; name: string; active: boolean };
interface CartLine {
  variantId: string;
  qty: number;
}

/**
 * Nueva salida "tipo tienda", como el JotForm: cada producto con su foto, sus
 * menús de variante, la cantidad y "Agregar". Lo agregado se junta en la
 * salida (a la derecha en la computadora; abajo en el celular), donde se elige
 * quién recibe y para qué, y se registra.
 */
export function IssueShop({
  items,
  categories,
  people,
  projects,
}: {
  items: InventoryItem[];
  categories: InventoryCategory[];
  people: InventoryPerson[];
  projects: Project[];
}) {
  const { ta } = useTa();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const groups = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = items
      .filter((i) => i.active && i.variants.some((v) => v.active))
      .filter((i) => category === "all" || i.categoryId === category)
      .filter((i) => !q || `${i.name} ${i.variants.map((v) => v.label).join(" ")}`.toLowerCase().includes(q));
    return categories
      .map((c) => ({ category: c, items: shown.filter((i) => i.categoryId === c.id).sort((a, b) => a.name.localeCompare(b.name, "es")) }))
      .concat([{ category: { id: "", name: ta("no_results"), sortOrder: 99 }, items: shown.filter((i) => !i.categoryId) }])
      .filter((g) => g.items.length > 0);
  }, [items, categories, category, query, ta]);

  function add(variantId: string, qty: number) {
    setCart((c) => {
      const found = c.find((l) => l.variantId === variantId);
      return found ? c.map((l) => (l.variantId === variantId ? { ...l, qty: l.qty + qty } : l)) : [...c, { variantId, qty }];
    });
  }

  const count = cart.length;
  const panel = <CartPanel cart={cart} setCart={setCart} items={items} people={people} projects={projects} onDone={() => setSheetOpen(false)} />;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <section className="flex min-w-0 flex-col gap-4 pb-20 lg:pb-0">
        <ListToolbar>
          <SearchBox value={query} onChange={setQuery} placeholder={ta("search_ph")} />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-auto min-w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ta("all_categories")}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ListToolbar>

        {groups.length === 0 ? (
          <EmptyBox>{items.length === 0 ? ta("stock_empty") : ta("no_results")}</EmptyBox>
        ) : (
          groups.map((g) => (
            <div key={g.category.id || "none"} className="flex flex-col">
              <h2 className="mb-3 border-b border-ink-900/8 pb-1.5 text-sm font-semibold text-foreground">{g.category.name}</h2>
              <ul className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                {g.items.map((item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    inCart={cart.filter((l) => item.variants.some((v) => v.id === l.variantId))}
                    onAdd={add}
                    onRemove={(variantId) => setCart((c) => c.filter((l) => l.variantId !== variantId))}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {/* Computadora: la salida al lado, fija. */}
      <aside className="sticky top-4 hidden max-h-[calc(100vh-2rem)] overflow-y-auto border border-ink-900/8 bg-card p-4 lg:block">{panel}</aside>

      {/* Celular: barra abajo que abre la salida. */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-[var(--app-bottom)] z-20 flex items-center justify-between gap-3 border-t border-ink-900/8 bg-card px-4 py-3 shadow-lg lg:hidden">
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <ShoppingCart className="size-4 shrink-0" />
            <span className="truncate">{ta("n_in_cart", { n: count })}</span>
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <ConfirmButton
              label={ta("clear_cart")}
              confirmLabel={ta("clear_cart_confirm")}
              onConfirm={() => {
                setCart([]);
                toast(ta("cart_cleared"));
              }}
            />
            <Button onClick={() => setSheetOpen(true)}>{ta("view_issue")}</Button>
          </div>
        </div>
      )}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
          <SheetHeader className="p-0">
            <SheetTitle>{ta("cart_title")}</SheetTitle>
          </SheetHeader>
          {panel}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── La tarjeta de un producto ──────────────────────────────────────────────

function ProductCard({
  item,
  inCart,
  onAdd,
  onRemove,
}: {
  item: InventoryItem;
  inCart: CartLine[];
  onAdd: (variantId: string, qty: number) => void;
  onRemove: (variantId: string) => void;
}) {
  const { ta, lang } = useTa();
  const variants = React.useMemo(() => item.variants.filter((v) => v.active), [item.variants]);
  const dims = dimensionCount(variants);
  const [selection, setSelection] = React.useState<string[]>(() => selectionOf(variants, variants[0]));
  const [qty, setQty] = React.useState("1");
  const picked = resolveVariant(variants, selection);
  const variant = picked ? variants.find((v) => v.id === picked.id) : undefined;
  const n = parseQty(qty);

  function choose(k: number, value: string) {
    setSelection((s) => reconcile(variants, [...s.slice(0, k), value, ...s.slice(k + 1)]));
  }

  function bump(delta: number) {
    const next = Math.max(item.allowsDecimals ? 0.01 : 1, (n ?? 0) + delta);
    setQty(String(Math.round(next * 100) / 100));
  }

  function addNow() {
    if (!variant || n == null || n <= 0) return;
    if (!item.allowsDecimals && !Number.isInteger(n)) return toast.error(ta("no_fraction"));
    onAdd(variant.id, n);
    setQty("1");
  }

  const status = variant ? stockStatus(variant) : "ok";
  const tone = status === "sin" ? "text-destructive" : status === "bajo" ? "text-warning" : "text-muted-foreground";
  const added = inCart.length > 0;

  // Tarjeta: foto, nombre y existencia arriba; menús de variante en el medio;
  // cantidad y "Agregar" siempre al pie, alineados en toda la fila.
  return (
    <li className={`flex flex-col border bg-card ${added ? "border-primary/40 ring-1 ring-primary/20" : "border-ink-900/8"}`}>
      <div className="flex h-28 items-center justify-center border-b border-ink-900/8 bg-white p-2 sm:h-36">
        <ItemThumb path={item.photoPath} size="fill" className="size-full border-0" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2.5 sm:p-3">
        <div>
          <p className="text-sm leading-tight font-semibold text-foreground">{item.name}</p>
          {variant && (
            <p className={`mt-0.5 text-xs ${tone}`}>
              {status === "sin" ? ta("status_out") : `${ta("stock_now")}: ${qtyWithUnit(variant.stockQty, item.unit, lang)}`}
            </p>
          )}
        </div>
        {dims > 0 && (
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: dims }, (_, k) => {
              const opts = optionsAt(variants, k, selection);
              return (
                <Select key={k} value={selection[k]} onValueChange={(v) => choose(k, v)}>
                  <SelectTrigger className="h-8 w-full text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {opts.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            })}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          <div className="flex items-center">
            <button
              type="button"
              aria-label="-"
              onClick={() => bump(-1)}
              className="flex size-9 shrink-0 items-center justify-center border border-input bg-card text-muted-foreground hover:text-foreground"
            >
              <Minus className="size-3.5" />
            </button>
            <input
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.currentTarget.value)}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={ta("qty")}
              className="h-9 w-full min-w-0 border-y border-input bg-card text-center text-sm tabular-nums outline-none focus-visible:border-ring"
            />
            <button
              type="button"
              aria-label="+"
              onClick={() => bump(1)}
              className="flex size-9 shrink-0 items-center justify-center border border-input bg-card text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <Button type="button" size="sm" className="h-9 w-full" onClick={addNow} disabled={!variant || n == null || n <= 0}>
            <Plus className="size-3.5" />
            {ta("add_to_issue")}
          </Button>
          {added && (
            <ul className="flex flex-col gap-1">
              {inCart.map((l) => {
                const v = item.variants.find((x) => x.id === l.variantId);
                return (
                  <li key={l.variantId} className="flex items-center gap-1.5 bg-primary/5 px-1.5 py-1 text-xs">
                    <Check className="size-3 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate">{v?.label ? `${v.label} × ${formatQty(l.qty, lang)}` : `× ${formatQty(l.qty, lang)}`}</span>
                    <button
                      type="button"
                      aria-label={ta("remove")}
                      onClick={() => onRemove(l.variantId)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

// ── La salida (carrito) ──────────────────────────────────────────────────

function CartPanel({
  cart,
  setCart,
  items,
  people,
  projects,
  onDone,
}: {
  cart: CartLine[];
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  items: InventoryItem[];
  people: InventoryPerson[];
  projects: Project[];
  onDone: () => void;
}) {
  const { ta, lang } = useTa();
  const index = useVariantIndex(items);
  const [recipient, setRecipient] = React.useState<string | null>(null);
  const [destKind, setDestKind] = React.useState<"project" | "internal">("project");
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [internalUse, setInternalUse] = React.useState<InternalUse>("taller");
  const [date, setDate] = React.useState(() => todayInPanama(new Date()));
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const personOptions = React.useMemo(
    () =>
      people.filter((p) => p.active).map((p) => ({ value: `${p.kind}:${p.id}`, label: p.name, group: ta(p.kind === "empleado" ? "employee" : "contractor") })),
    [people, ta],
  );
  const projectOptions = React.useMemo(() => projects.filter((p) => p.active).map((p) => ({ value: p.id, label: p.name })), [projects]);

  async function submit() {
    setError(null);
    if (cart.length === 0) return setError(ta("lines_required"));
    if (!recipient) return setError(ta("recipient_required"));
    if (destKind === "project" && !projectId) return setError(ta("destination_required"));
    const [kind, id] = recipient.split(":") as ["empleado" | "contratista", string];
    setSaving(true);
    const res = await registerIssueAction({
      issuedOn: date || null,
      recipient: { kind, id },
      projectId: destKind === "project" ? projectId : null,
      internalUse: destKind === "internal" ? internalUse : null,
      notes,
      lines: cart,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success(ta("issue_saved"));
    setCart([]);
    setNotes("");
    onDone();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h2 className="hidden items-center gap-2 font-semibold lg:flex">
          <ShoppingCart className="size-4" />
          {ta("cart_title")}
        </h2>
        {cart.length > 0 && (
          <ConfirmButton
            className="ml-auto"
            label={ta("clear_cart")}
            confirmLabel={ta("clear_cart_confirm")}
            onConfirm={() => {
              setCart([]);
              toast(ta("cart_cleared"));
              onDone();
            }}
          />
        )}
      </div>

      {cart.length === 0 ? (
        <p className="border border-dashed border-ink-900/16 px-3 py-6 text-center text-sm text-muted-foreground">{ta("cart_empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {cart.map((l) => {
            const ref = index.get(l.variantId);
            const short = ref && l.qty > ref.variant.stockQty;
            return (
              <li key={l.variantId} className="flex items-start gap-2">
                <ItemThumb path={ref?.item.photoPath ?? null} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-tight font-medium">{ref?.item.name}</p>
                  {ref?.variant.label && <p className="text-xs text-muted-foreground">{ref.variant.label}</p>}
                  {short && <p className="text-xs text-warning">{ta("short_stock", { stock: qtyWithUnit(ref.variant.stockQty, ref.item.unit, lang) })}</p>}
                </div>
                <input
                  key={l.qty}
                  inputMode="decimal"
                  defaultValue={String(l.qty)}
                  onBlur={(e) => {
                    const n = parseQty(e.currentTarget.value);
                    if (n == null || n <= 0) return void (e.currentTarget.value = String(l.qty));
                    setCart((c) => c.map((x) => (x.variantId === l.variantId ? { ...x, qty: n } : x)));
                  }}
                  aria-label={ta("qty")}
                  className="h-8 w-16 border border-input bg-card px-2 text-right text-sm tabular-nums outline-none focus-visible:border-ring"
                />
                <button
                  type="button"
                  aria-label={ta("remove")}
                  onClick={() => setCart((c) => c.filter((x) => x.variantId !== l.variantId))}
                  className="mt-1.5 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Field label={ta("f_recipient")}>
        <Combo options={personOptions} value={recipient} onChange={setRecipient} placeholder={ta("pick_person")} />
      </Field>
      <Field label={ta("f_destination")}>
        <div className="flex flex-col gap-2">
          <SegmentedFilter
            value={destKind}
            onChange={setDestKind}
            options={[
              { value: "project", label: ta("dest_project") },
              { value: "internal", label: ta("dest_internal") },
            ]}
          />
          {destKind === "project" ? (
            <Combo options={projectOptions} value={projectId} onChange={setProjectId} placeholder={ta("pick_project")} />
          ) : (
            <SegmentedFilter value={internalUse} onChange={setInternalUse} options={INTERNAL_USES.map((u) => ({ value: u, label: ta(`use_${u}`) }))} />
          )}
        </div>
      </Field>
      <Field label={ta("date")}>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label={ta("notes")}>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={ta("optional")} />
      </Field>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={submit} disabled={saving || cart.length === 0} className="w-full">
        {saving ? ta("saving") : `${ta("register_issue")}${cart.length ? ` (${cart.length})` : ""}`}
      </Button>
    </div>
  );
}
