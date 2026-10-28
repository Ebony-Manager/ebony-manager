"use client";

import * as React from "react";
import { BellRing, Smartphone } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { hasModule, type AppModule } from "@/lib/auth/modules";
import type { NotificationType, UserPushPreference } from "@/services/notifications";
import type { AppUser } from "@/types/usuarios";
import { saveUserPushPreferencesAction } from "./actions";

const MODULE_NAMES: Record<string, string> = { documentos: "Personal", asistencia: "Asistencia", planilla: "Planilla", almacen: "Almacén", almacen_ajustes: "Almacén", almacen_compras: "Compras", inspecciones: "Inspecciones" };

export function UserNotificationsDialog({ user, types, preferences, deviceCount, open, onOpenChange }: { user: AppUser; types: NotificationType[]; preferences: UserPushPreference[]; deviceCount: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const initial = React.useMemo(() => Object.fromEntries(types.map((type) => [type.key, preferences.find((p) => p.typeKey === type.key)?.pushEnabled ?? type.defaultPush])), [types, preferences]);
  const [values, setValues] = React.useState<Record<string, boolean>>(initial);
  const [saving, setSaving] = React.useState(false);
  const available = types.filter((type) => hasModule(user, type.module as AppModule));
  const groups = [...new Set(available.map((type) => type.module))];

  async function save() {
    if (!user.profileId) return;
    setSaving(true);
    const result = await saveUserPushPreferencesAction(user.profileId, Object.fromEntries(available.map((type) => [type.key, Boolean(values[type.key])])));
    setSaving(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Preferencias push guardadas");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Notificaciones push de {user.fullName || user.email}</DialogTitle>
          <DialogDescription>El buzón dentro de Ebony siempre está activo. Aquí decides cuáles también llegan a sus dispositivos.</DialogDescription>
        </DialogHeader>
        <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${deviceCount ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"}`}>
          <Smartphone className="size-4" />
          {deviceCount ? `${deviceCount} dispositivo${deviceCount === 1 ? "" : "s"} activado${deviceCount === 1 ? "" : "s"}` : "Todavía no activó ningún dispositivo"}
        </div>
        <div className="flex flex-col gap-4">
          {groups.map((module) => (
            <section key={module} className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold">{MODULE_NAMES[module] ?? module}</h3>
              <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                {available.filter((type) => type.module === module).map((type) => (
                  <label key={type.key} className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-muted/30">
                    <input type="checkbox" className="mt-1" checked={Boolean(values[type.key])} onChange={(event) => setValues((current) => ({ ...current, [type.key]: event.target.checked }))} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{type.title}</span>
                      <span className="block text-xs text-muted-foreground">{type.description}</span>
                    </span>
                    <BellRing className={`mt-0.5 size-4 ${values[type.key] ? "text-primary" : "text-muted-foreground/40"}`} />
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
