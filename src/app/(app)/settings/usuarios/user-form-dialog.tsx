"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { KeyRound, ShieldCheck, User, UserPlus, Users } from "lucide-react";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/shared/field";
import { FormSection } from "@/components/shared/form-section";
import { useDiscardGuard, useFormBaseline } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { ICON } from "@/lib/ui/concepts";
import { splitName } from "@/lib/usuarios/split-name";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { APP_MODULES, MODULE_PARENT, isOptInModule, moduleAncestors, normalizeModules, type AppModule, type AppRole } from "@/lib/auth/modules";
import type { AccessCandidate, AppUser } from "@/types/usuarios";
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
  candidates = [],
  prefill,
  open,
  onOpenChange,
}: {
  /** Sin usuario = invitar. */
  user?: AppUser;
  isSelf?: boolean;
  /** Gente de Personal sin acceso todavía (para elegirla en vez de escribir sus datos). */
  candidates?: AccessCandidate[];
  /** Invitar a alguien de Personal ya elegido (desde su ficha). */
  prefill?: AccessCandidate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.usuarios) => t(lang, strings.usuarios[k]);
  const isInvite = !user;
  /** A quién se puede elegir: los candidatos (y quien viene de su ficha). */
  const pool = React.useMemo(() => (prefill && !candidates.some((c) => c.id === prefill.id) ? [prefill, ...candidates] : candidates), [candidates, prefill]);
  const [email, setEmail] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [role, setRole] = React.useState<AppRole>("vendedor");
  const [modules, setModules] = React.useState<AppModule[]>([]);
  const [note, setNote] = React.useState("");
  const [employeeId, setEmployeeId] = React.useState<string | null>(null);
  const [source, setSource] = React.useState<"staff" | "other">("staff");
  const [submitting, setSubmitting] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"first" | "last" | "email">();
  const { isDirty, markSeeded } = useFormBaseline(() => JSON.stringify({ email, firstName, lastName, role, modules, note, employeeId, source }));
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  const { requestClose, dialog: discardDialog } = useDiscardGuard(isDirty, close);
  const picked = pool.find((c) => c.id === employeeId) ?? null;

  function pickCandidate(id: string) {
    const c = pool.find((x) => x.id === id);
    if (!c) return;
    const n = splitName(c.name);
    setEmployeeId(c.id);
    setFirstName(n.first);
    setLastName(n.last);
    clear("first");
    clear("last");
    if (isInvite) {
      setEmail(c.email ?? "");
      clear("email");
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect -- reset al abrir. */
  React.useEffect(() => {
    if (!open) return;
    const fromStaff = !user && prefill ? splitName(prefill.name) : null;
    setEmail(!user && prefill?.email ? prefill.email : "");
    setFirstName(fromStaff?.first ?? user?.firstName ?? "");
    setLastName(fromStaff?.last ?? user?.lastName ?? "");
    setEmployeeId(user ? (user.employee?.id ?? null) : (prefill?.id ?? null));
    setSource(!user && (prefill || pool.some((c) => c.active)) ? "staff" : "other");
    setRole(user?.role ?? "vendedor");
    setModules(user?.modules ?? []);
    setNote(user?.note ?? "");
    reset();
    setSubmitting(false);
    markSeeded();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir o cambiar de usuario.
  }, [open, user]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggleModule(m: AppModule, checked: boolean) {
    setModules((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(m);
        for (const p of moduleAncestors(m)) next.add(p);
      } else {
        next.delete(m);
      }
      // normalizeModules apaga el sub-permiso que se quedó sin su padre.
      return normalizeModules([...next]);
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const mail = email.trim();
    if (
      !validate([
        ["first", !firstName.trim(), tt("first_name_required")],
        ["last", !lastName.trim(), tt("last_name_required")],
        ["email", isInvite && !mail, tt("email_required")],
        ["email", isInvite && !!mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail), tt("email_invalid")],
      ])
    )
      return;
    setSubmitting(true);
    const input = { firstName, lastName, role, modules, note, employeeId: isInvite && source === "other" ? null : employeeId };

    if (isInvite) {
      const res = await inviteUserAction(email, input);
      if (!res.ok) {
        toast.error(res.error);
        setSubmitting(false);
        return;
      }
      if (res.emailSent) toast.success(tt("invited"));
      else toast.error(`${tt("invited_no_email")}: ${res.emailError ?? ""}\n${tt("invited_no_email_hint")}`, { duration: 9000 });
    } else {
      const res = await updateUserAction(user.email, input);
      if (!res.ok) {
        toast.error(res.error);
        setSubmitting(false);
        return;
      }
      toast.success(tt("saved"));
    }
    // La acción ya hace revalidatePath de Usuarios: sin router.refresh() (armaría la pantalla dos veces).
    onOpenChange(false);
  }

  const isAdminRole = role === "admin";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && void requestClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isInvite ? tt("dlg_invite_title") : `${tt("dlg_edit_title")} ${user.fullName || user.email}`}</DialogTitle>
          <DialogDescription>{isInvite ? tt("dlg_invite_desc") : user.email}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
          <FormSection icon={ICON.owner} title={tt("sec_person")}>
          {isInvite && !prefill && pool.some((c) => c.active) && (
            <div className="flex flex-col gap-3">
              <SegmentedFilter
                fill
                value={source}
                onChange={(v) => {
                  setSource(v);
                  if (v === "other") setEmployeeId(null);
                }}
                options={[
                  { value: "staff", label: tt("src_staff"), icon: Users },
                  { value: "other", label: tt("src_other"), icon: UserPlus },
                ]}
              />
              {source === "staff" && (
                <Field label={tt("field_staff")} icon={ICON.owner} hint={picked && !picked.email ? tt("staff_no_email") : undefined}>
                  <Select value={employeeId ?? ""} onValueChange={pickCandidate}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={tt("staff_pick")} />
                    </SelectTrigger>
                    <SelectContent>
                      {pool
                        .filter((c) => c.active)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                            {c.position ? ` · ${c.position}` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </div>
          )}
          {isInvite && prefill && (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
              <span className="text-muted-foreground">{tt("field_staff")}: </span>
              <span className="font-medium">{prefill.name}</span>
              {prefill.position ? <span className="text-muted-foreground"> · {prefill.position}</span> : null}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            <Field label={tt("field_first_name")} required error={error("first")}>
              <Input
                autoComplete="off"
                autoFocus={isInvite}
                value={firstName}
                onChange={(ev) => {
                  setFirstName(ev.target.value);
                  clear("first");
                }}
              />
            </Field>
            <Field label={tt("field_last_name")} required error={error("last")}>
              <Input
                autoComplete="off"
                value={lastName}
                onChange={(ev) => {
                  setLastName(ev.target.value);
                  clear("last");
                }}
              />
            </Field>
          </div>

          {isInvite && (
            <Field
              label={tt("field_email")}
              icon={ICON.email}
              required
              error={error("email")}
              hint={picked?.email && email.trim().toLowerCase() === picked.email.toLowerCase() ? tt("email_from_staff") : undefined}
            >
              <Input
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(ev) => {
                  setEmail(ev.target.value);
                  clear("email");
                }}
                placeholder="nombre@correo.com"
              />
            </Field>
          )}

          {!isInvite && (
            <Field label={tt("field_staff")} icon={ICON.owner} hint={tt("staff_link_hint")}>
              <Select value={employeeId ?? "__none"} onValueChange={(v) => setEmployeeId(v === "__none" ? null : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{tt("staff_none")}</SelectItem>
                  {user?.employee && (
                    <SelectItem value={user.employee.id}>
                      {user.employee.name}
                      {user.employee.position ? ` · ${user.employee.position}` : ""}
                    </SelectItem>
                  )}
                  {candidates
                    .filter((c) => c.active && c.id !== user?.employee?.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.position ? ` · ${c.position}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          </FormSection>

          <FormSection icon={KeyRound} title={tt("sec_access")}>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">{tt("field_role")}</span>
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
                      active ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                    )}
                  >
                    <Icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
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
            <span className="text-sm font-medium text-foreground">{tt("field_modules")}</span>
            <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
              {APP_MODULES.map((m) => {
                const parent = MODULE_PARENT[m];
                const depth = moduleAncestors(m).length;
                // El admin tiene todo, salvo los permisos a elección (Accesos rápidos): esos se marcan igual.
                const locked = isAdminRole && !isOptInModule(m);
                const checked = locked || modules.includes(m);
                const Icon = MODULE_LABELS[m].icon;
                return (
                  <label
                    key={m}
                    className={cn(
                      "flex items-start gap-2.5 px-3 py-2 text-sm",
                      depth === 1 && "pl-8",
                      depth >= 2 && "pl-14",
                      locked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/50"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      disabled={locked}
                      checked={checked}
                      onChange={(ev) => toggleModule(m, ev.target.checked)}
                    />
                    <Icon className={cn("mt-0.5 size-4 shrink-0", checked ? "text-primary" : "text-muted-foreground")} />
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

          </FormSection>

          <Field label={tt("field_note")}>
            <Input value={note} onChange={(ev) => setNote(ev.target.value)} placeholder={tt("note_placeholder")} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={submitting}>
              {tt("cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (isInvite ? tt("sending") : tt("saving")) : isInvite ? tt("send_invite") : tt("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}
