import { employeeAccentColor } from "@/lib/planilla/payroll-colors";

/** Círculo con la inicial del empleado, en su color de identidad
 *  (por `sortOrder`). Portado de Atlas. Mismo color en todas las
 *  vistas del módulo. */
export function EmployeeAvatar({
  name,
  employeeId,
  sortOrder,
  size = "sm",
}: {
  name: string;
  employeeId: string;
  sortOrder: number;
  size?: "sm" | "md";
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const dims = size === "md" ? "size-10 text-sm" : "size-7 text-[11px]";
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
