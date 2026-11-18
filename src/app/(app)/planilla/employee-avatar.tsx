"use client";

import { PersonAvatar } from "@/components/shared/person-avatar";
import { useEmployeePhoto } from "./employee-photos-context";

/** Círculo del empleado: el mismo de toda la app (`PersonAvatar`), con la foto que trae el contexto de
 *  Planilla. `sortOrder` se conserva en la firma para no tocar las pantallas que lo pasan. */
export function EmployeeAvatar({
  name,
  employeeId,
  size = "sm",
}: {
  name: string;
  employeeId: string;
  sortOrder?: number;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const photoUrl = useEmployeePhoto(employeeId);
  return <PersonAvatar name={name} photoUrl={photoUrl} size={size} />;
}
