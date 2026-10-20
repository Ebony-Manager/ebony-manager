import type { AppModule, AppRole } from "@/lib/auth/modules";

/** Un usuario de la app, tal como lo muestra Administración → Usuarios. */
export interface AppUser {
  email: string;
  role: AppRole;
  modules: AppModule[];
  note: string | null;
  createdAt: string;
  invitedAt: string | null;
  /** null si todavía no tiene cuenta (no ha abierto la invitación ni entrado con Google). */
  profileId: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  lastSignInAt: string | null;
}

export interface AppUserInput {
  role: AppRole;
  modules: readonly string[];
  note?: string | null;
}
