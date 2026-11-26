import type { AppModule, AppRole } from "@/lib/auth/modules";

/** Un usuario de la app, tal como lo muestra Settings → Usuarios. */
export interface AppUser {
  email: string;
  role: AppRole;
  modules: AppModule[];
  note: string | null;
  createdAt: string;
  invitedAt: string | null;
  /** Puestos por el admin al invitar (o sacados de su nombre de Google). */
  firstName: string | null;
  lastName: string | null;
  /** null si todavía no tiene cuenta (no ha abierto la invitación ni entrado con Google). */
  profileId: string | null;
  /** Nombre que muestra la app: "Nombre Apellido", o el de Google si no hay. */
  fullName: string | null;
  avatarUrl: string | null;
  lastSignInAt: string | null;
  /** Su ficha en Personal o de contratista, si la tiene (ver `kind`). */
  employee: LinkedEmployee | null;
}

/** De dónde sale la persona: Personal (planilla) o Contratistas. */
export type LinkKind = "employee" | "contractor";

/** La ficha (de Personal o de contratista) a la que está enlazado un usuario. */
export interface LinkedEmployee {
  id: string;
  kind: LinkKind;
  name: string;
  position: string | null;
  /** false = ya no trabaja (inactivo en Personal). */
  active: boolean;
}

/** Alguien de Personal (o un contratista) al que todavía no se le ha dado acceso a la app. */
export interface AccessCandidate {
  id: string;
  /** Sin poner = Personal. */
  kind?: LinkKind;
  name: string;
  position: string | null;
  email: string | null;
  active: boolean;
}

export interface AppUserInput {
  firstName: string;
  lastName: string;
  role: AppRole;
  modules: readonly string[];
  note?: string | null;
  /** Su ficha en Personal: undefined = no tocar; null = quitar el enlace. */
  employeeId?: string | null;
  /** Su ficha de contratista (igual que `employeeId`). Es una u otra. */
  contractorId?: string | null;
}
