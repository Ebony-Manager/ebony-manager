"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingBlock } from "@/components/shared/loading-block";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import type { DeliveryKind } from "@/lib/deliveries/acta-form";
import { getFormProjectsAction, getProjectFormUrlAction } from "@/app/(app)/form-actions";

/**
 * Antes de abrir una autorización (pintura / embalaje) desde los accesos
 * rápidos: se escoge el proyecto y el formulario abre con su nombre puesto.
 */
export function ProjectFormPicker({ kind, title, onClose }: { kind: DeliveryKind | null; title: string; onClose: () => void }) {
  const { lang } = useLang();
  const tn = (k: keyof typeof strings.nav) => t(lang, strings.nav[k]);
  const [projects, setProjects] = React.useState<{ id: string; name: string }[] | null>(null);
  const [opening, setOpening] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!kind || projects) return;
    let alive = true;
    void getFormProjectsAction().then((res) => {
      if (!alive) return;
      if (res.ok) setProjects(res.data);
      else {
        toast.error(res.error);
        onClose();
      }
    });
    return () => {
      alive = false;
    };
  }, [kind, projects, onClose]);

  const pick = async (id: string) => {
    if (!kind) return;
    // La ventana se abre ya (si se abre después de esperar, el navegador la bloquea).
    const win = window.open("about:blank", "_blank");
    setOpening(id);
    const res = await getProjectFormUrlAction(kind, id);
    setOpening(null);
    if (!res.ok) {
      win?.close();
      toast.error(res.error);
      return;
    }
    if (win) win.location.href = res.data;
    else window.location.assign(res.data);
    onClose();
  };

  return (
    // ui-allow: sin-campos (solo se elige un proyecto de la lista).
    <Dialog open={kind !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-3 p-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{tn("form_pick_project_hint")}</DialogDescription>
        </DialogHeader>
        <p className="text-sm font-medium text-foreground">{tn("form_pick_project")}</p>
        {projects === null ? (
          <LoadingBlock variant="lines" rows={4} />
        ) : (
          <Command className="rounded-md border border-border">
            <CommandInput placeholder={tn("form_pick_search")} />
            <CommandList className="max-h-72">
              <CommandEmpty>{tn("form_pick_none")}</CommandEmpty>
              {projects.map((p) => (
                <CommandItem key={p.id} value={p.name} onSelect={() => void pick(p.id)} disabled={opening !== null}>
                  <span className="flex-1">{p.name}</span>
                  {opening === p.id && <Loader2 className="size-3.5 animate-spin" />}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        )}
      </DialogContent>
    </Dialog>
  );
}
