"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ShieldCheck, User } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { APP_MODULES, MODULE_PARENT, normalizeModules, type AppModule, type AppRole } from "@/lib/auth/modules";
import type { AppUser } from "@/types/usuarios";
import { inviteUserAction, updateUserAction } from "./actions";
import { MODULE_LABELS } from "./module-labels";

/**
 * Invitar a alguien nuevo (nombre, apellido y correo) o cambiar el nombre y
 * los permisos de un usuario existente (el correo no se puede cambiar: se
 * quita y se vuelve a invitar). Rol Administrador = todo; Usuario = solo los módulos marcados.
 * Un sub-permiso (Asistencia, Costos) arrastra a su módulo padre al
 * marcarse, y se apaga si se desmarca el padre.
 */
export function UserFormDialog({
  user,
  isSelf = false,
  open,
  onOpenChange,
}: {
  /** Sin usuario = invitar. */
  user?: AppUser;
  isSelf?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.usuarios) => t(lang, strings.usuarios[k]);
  const router = useRouter();
  const isInvite = !user;

  const [email, setEmail] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [role, setRole] = React.useState<AppRole>("vendedor");
  const [modules, setModules] = React.useState<AppModule[]>([]);
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- reset al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setEmail("");
    setFirstName(user?.firstName ?? "");
    setLastName(user?.lastName ?? "");
    setRole(user?.role ?? "vendedor");
    setModules(user?.modules ?? []);
    setNote(user?.note ?? "");
    setError(null);
    setSubmitting(false);
  }, [open, user]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggleModule(m: AppModule, checked: boolean) {
    setModules((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(m);
        const parent = MODULE_PARENT[m];
        if (parent) next.add(parent);
      } else {
        next.delete(m);
      }
      // normalizeModules apaga el sub-permiso que se quedó sin su padre.
      return normalizeModules([...next]);
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const input = { firstName, lastName, role, modules, note };

    if (isInvite) {
      const res = await inviteUserAction(email, input);
      if (!res.ok) {
        setError(res.error);
        setSubmitting(false);
        return;
      }
      if (res.emailSent) toast.success(tt("invited"));
      else toast.error(`${tt("invited_no_email")}: ${res.emailError ?? ""}\n${tt("invited_no_email_hint")}`, { duration: 9000 });
    } else {
      const res = await updateUserAction(user.email, input);
      if (!res.ok) {
        setError(res.error);
        setSubmitting(false);
        return;
      }
      toast.success(tt("saved"));
    }
    onOpenChange(false);
    router.refresh();
  }

  const isAdminRole = role === "admin";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isInvite ? tt("dlg_invite_title") : `${tt("dlg_edit_title")} ${user.fullName || user.email}`}</DialogTitle>
          <DialogDescription>{isInvite ? tt("dlg_invite_desc") : user.email}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-first-name" className="text-xs text-muted-foreground">
                {tt("field_first_name")}
              </Label>
              <Input
                id="user-first-name"
                autoComplete="off"
                required
                autoFocus={isInvite}
                value={firstName}
                onChange={(ev) => setFirstName(ev.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-last-name" className="text-xs text-muted-foreground">
                {tt("field_last_name")}
              </Label>
              <Input
                id="user-last-name"
                autoComplete="off"
                required
                value={lastName}
                onChange={(ev) => setLastName(ev.target.value)}
              />
            </div>
          </div>

          {isInvite && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-email" className="text-xs text-muted-foreground">
                {tt("field_email")}
              </Label>
              <Input
                id="invite-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                required
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="nombre@correo.com"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">{tt("field_role")}</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(
                [
                  { value: "admin", icon: ShieldCheck, label: tt("role_admin"), hint: tt("role_admin_hint") },
                  { value: "vendedor", icon: User, label: tt("role_user"), hint: tt("role_user_hint") },
                ] as const
              ).map(({ value, icon: Icon, label, hint }) => {
                const active = role === value;
                // Un admin no puede bajarse el rol a sí mismo (siempre queda al menos uno).
                const locked = isSelf && value !== "admin";
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={locked}
                    onClick={() => setRole(value)}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      active ? "border-walnut bg-walnut-tint" : "border-border hover:bg-ink-900/5"
                    )}
                  >
                    <Icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-walnut" : "text-muted-foreground")} />
                    <span>
                      <span className="block font-medium text-foreground">{label}</span>
                      <span className="block text-xs text-muted-foreground">{hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">{tt("field_modules")}</span>
            <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
              {APP_MODULES.map((m) => {
                const parent = MODULE_PARENT[m];
                const checked = isAdminRole || modules.includes(m);
                return (
                  <label
                    key={m}
                    className={cn(
                      "flex items-start gap-2.5 px-3 py-2 text-sm",
                      parent && "pl-8",
                      isAdminRole ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-ink-900/5"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      disabled={isAdminRole}
                      checked={checked}
                      onChange={(ev) => toggleModule(m, ev.target.checked)}
                    />
                    <span>
                      <span className="block font-medium text-foreground">{t(lang, MODULE_LABELS[m].label)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {t(lang, MODULE_LABELS[m].hint)}
                        {parent && ` ${tt("sub_of")} ${t(lang, MODULE_LABELS[parent].label)}.`}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{tt("dashboard_note")}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-note" className="text-xs text-muted-foreground">
              {tt("field_note")}
            </Label>
            <Input id="user-note" value={note} onChange={(ev) => setNote(ev.target.value)} placeholder={tt("note_placeholder")} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {tt("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={submitting || !firstName.trim() || !lastName.trim() || (isInvite && !email.trim())}
            >
              {submitting ? (isInvite ? tt("sending") : tt("saving")) : isInvite ? tt("send_invite") : tt("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
