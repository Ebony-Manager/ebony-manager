import { describe, expect, it } from "vitest";

import {
  contractorBackPath,
  contractorProfilePath,
  employeeBackPath,
  employeeProfilePath,
  parseContractorFrom,
  parseEmployeeFrom,
} from "./paths";

describe("rutas de las fichas del staff", () => {
  it("arma la ruta dentro de Staff, con `from` solo si viene", () => {
    expect(employeeProfilePath("e1")).toBe("/personal/staff/empleados/e1");
    expect(employeeProfilePath("e1", "registro")).toBe("/personal/staff/empleados/e1?from=registro");
    expect(contractorProfilePath("c1", "contratistas")).toBe("/personal/staff/contratistas/c1?from=contratistas");
  });

  it("ignora un `from` desconocido", () => {
    expect(parseEmployeeFrom("empleados")).toBeUndefined();
    expect(parseEmployeeFrom("dashboard")).toBe("dashboard");
    expect(parseContractorFrom(undefined)).toBeUndefined();
  });

  it("vuelve a Staff por defecto, o a la pantalla de origen", () => {
    expect(employeeBackPath()).toBe("/personal/staff");
    expect(employeeBackPath("auditoria")).toBe("/personal/pagos?tab=historial");
    expect(employeeBackPath("registro")).toBe("/personal/pagos?tab=quincena");
    expect(employeeBackPath("dashboard")).toBe("/personal?ver=empleados");
    expect(employeeBackPath("resumen")).toBe("/personal");
    expect(contractorBackPath()).toBe("/personal/staff");
    expect(contractorBackPath("contratistas")).toBe("/personal?ver=contratistas");
    expect(contractorBackPath("pagos")).toBe("/personal/pagos?tab=contratistas");
  });
});
