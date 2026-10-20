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
}

export interface AppUserInput {
  firstName: string;
  lastName: string;
  role: AppRole;
  modules: readonly string[];
  note?: string | null;
}
