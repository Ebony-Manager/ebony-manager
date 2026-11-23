"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/page-header";
import { FormSection } from "@/components/shared/form-section";
import { StatusBadge } from "@/components/shared/status-badge";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import type { MissingKey } from "@/lib/produccion/missing";
import type { OrderStatus } from "@/types/produccion";
import type { ProjectItem } from "@/types/diseno";
import { createOrderAction } from "./actions";
import { orderPath } from "./paths";
import { ListChecks } from "lucide-react";

export type To = (k: keyof typeof strings.orden, vars?: Record<string, string | number>) => string;

export function useTo() {
  const { lang } = useLang();
  const to: To = React.useCallback(
    (k, vars) => {
      let s = t(lang, strings.orden[k]);
      for (const [key, v] of Object.entries(vars ?? {})) s = s.replace(`{${key}}`, String(v));
      return s;
    },
    [lang],
  );
  return { lang, to };
}

export function OrderStatusBadge({ status, to }: { status: OrderStatus; to: To }) {
  return <StatusBadge status={`order_${status}`}>{to(`status_${status}`)}</StatusBadge>;
}

/** "hoja de ruta, despiece y mano de obra". */
export function missingText(to: To, keys: readonly MissingKey[], lang: "es" | "en"): string {
  const words = keys.map((k) => to(`m_${k}`));
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} ${lang === "es" ? "y" : "and"} ${words.at(-1)}`;
}

export const itemsLabel = (to: To, n: number) => (n === 1 ? to("item_1") : to("items_n", { n }));

/** Nueva orden: escoger los ítems aprobados (sin orden) que entran y abrir la orden para seguir armándola. */
export function NewOrderDialog({ open, projectId, freeItems, onClose }: { open: boolean; projectId: string; freeItems: ProjectItem[]; onClose: () => void }) {
  const { to } = useTo();
  const router = useRouter();
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"items">();

  /* eslint-disable react-hooks/set-state-in-effect -- al abrir: todos marcados. */
  React.useEffect(() => {
    if (!open) return;
    setPicked(new Set(freeItems.map((i) => i.id)));
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate([["items", picked.size === 0, to("err_items")]])) return;
    setSaving(true);
    const res = await createOrderAction(projectId, [...picked]);
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(to("created"));
    onClose();
    router.push(orderPath(res.data));
  }

  const toggle = (id: string) => {
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    clear("items");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{to("new_order")}</DialogTitle>
          <DialogDescription>{to("new_order_desc")}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <FormSection icon={ListChecks} title={to("sec_items")} error={error("items")}>
            {freeItems.length === 0 ? (
              <EmptyState>{to("no_free_items")}</EmptyState>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {freeItems.map((i) => (
                  <li key={i.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm select-none">
                      <input type="checkbox" className="size-4 accent-primary" checked={picked.has(i.id)} onChange={() => toggle(i.id)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{i.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{[i.area, i.kind].filter(Boolean).join(" · ")}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </FormSection>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              {to("cancel")}
            </Button>
            <Button type="submit" disabled={saving || freeItems.length === 0}>
              {saving ? to("creating") : to("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
