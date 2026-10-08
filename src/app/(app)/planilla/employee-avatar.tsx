"use client";

import { employeeAccentColor } from "@/lib/planilla/payroll-colors";
import { useEmployeePhoto } from "./employee-photos-context";

/** Círculo del empleado: su FOTO si ya se subió una, y si no la inicial en
 *  su color de identidad (por `sortOrder`, igual en todas las vistas).
 *  Portado de Atlas. */
export function EmployeeAvatar({
  name,
  employeeId,
  sortOrder,
  size = "sm",
}: {
  name: string;
  employeeId: string;
  sortOrder: number;
  size?: "sm" | "md" | "xl";
}) {
  const photoUrl = useEmployeePhoto(employeeId);
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const dims = size === "xl" ? "size-24 text-3xl" : size === "md" ? "size-10 text-sm" : "size-7 text-[11px]";
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage; next/image no aplica.
      <img
        data-employee-id={employeeId}
        src={photoUrl}
        alt={name}
        title={name}
        className={`${dims} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      data-employee-id={employeeId}
      title={name}
      className={`flex ${dims} shrink-0 items-center justify-center rounded-full font-semibold text-white`}
      style={{ backgroundColor: employeeAccentColor(sortOrder) }}
    >
      {initial}
    </div>
  );
}
