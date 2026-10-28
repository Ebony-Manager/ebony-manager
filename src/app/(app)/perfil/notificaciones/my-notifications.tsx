"use client";

import * as React from "react";
import { BellRing, Smartphone } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { PAGE_CLASS, PageHeader } from "@/components/shared/page-header";
import { PushControls } from "../../settings/notificaciones/push-controls";
import type { NotificationType, UserPushPreference } from "@/services/notifications";
import { saveMyPushPreferencesAction } from "./actions";

const MODULE_NAMES: Record<string, string> = { documentos: "Personal", asistencia: "Asistencia", planilla: "Planilla", almacen: "Almacén", almacen_compras: "Compras", inspecciones: "Inspecciones" };

export function MyNotifications({ types, preferences, deviceCount }: { types: NotificationType[]; preferences: UserPushPreference[]; deviceCount: number }) {
  const initial = React.useMemo(() => Object.fromEntries(types.map((type) => [type.key, preferences.find((preference) => preference.typeKey === type.key)?.pushEnabled ?? type.defaultPush])), [types, preferences]);
  const [values, setValues] = React.useState<Record<string, boolean>>(initial);
  const [savedValues, setSavedValues] = React.useState<Record<string, boolean>>(initial);
  const [saving, setSaving] = React.useState(false);
  const groups = [...new Set(types.map((type) => type.module))];
  const dirty = types.some((type) => Boolean(values[type.key]) !== Boolean(savedValues[type.key]));

  async function save() {
    setSaving(true);
    const result = await saveMyPushPreferencesAction(Object.fromEntries(types.map((type) => [type.key, Boolean(values[type.key])])));
    setSaving(false);
    if (!result.ok) return toast.error(result.error);
    setSavedValues({ ...values });
    toast.success("Preferencias guardadas");
  }

  return (
    <div className={PAGE_CLASS}>
      <PageHeader title="Mis notificaciones" subtitle="Elige cuáles avisos también quieres recibir como push. El buzón de Ebony siempre permanece activo." />
      <PushControls />
      <div className="flex max-w-2xl items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
        <Smartphone className="size-4 text-primary" />
        {deviceCount ? `${deviceCount} dispositivo${deviceCount === 1 ? "" : "s"} registrado${deviceCount === 1 ? "" : "s"}` : "Todavía no tienes dispositivos registrados"}
      </div>
      <div className="flex max-w-2xl flex-col gap-5">
        {groups.map((module) => (
          <section key={module} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">{MODULE_NAMES[module] ?? module}</h2>
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {types.filter((type) => type.module === module).map((type) => (
                <label key={type.key} className="flex cursor-pointer items-start gap-3 px-3.5 py-3 hover:bg-muted/30">
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
        <Button className="self-end" onClick={() => void save()} disabled={saving || !dirty}>{saving ? "Guardando…" : "Guardar preferencias"}</Button>
      </div>
    </div>
  );
}
