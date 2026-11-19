import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { hasModule } from "@/lib/auth/modules";
import { CONTRACTOR_LOAN_LABEL, todayInPanama } from "@/lib/contractors/contractor-loans";
import * as attendance from "@/services/attendance";
import * as moneyRequests from "@/services/money-requests";
import * as payroll from "@/services/payroll";
import { getPayrollEmployees } from "@/services/payroll-employees";
import type { McpUser } from "./auth";
import { READ_ONLY, fail, makeReadRegistrar, matches, ok, usd } from "./shared";

/**
 * Consultas de Personal — solo lectura: la lista del personal (Personal),
 * la planilla, sus obligaciones y préstamos (Planilla), las ponchadas
 * (Asistencia) y las solicitudes de dinero pendientes. El sueldo solo sale
 * con Planilla. No se exponen cédulas, direcciones ni cuentas de banco.
 */

const half = (h: 1 | 2) => (h === 1 ? "1ra" : "2da");
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function registerPersonalTools(server: McpServer, user: McpUser) {
  const guard = makeReadRegistrar(user);
  const canSeePay = () => hasModule(user.profile, "planilla");

  server.registerTool(
    "empleados",
    {
      title: "Empleados",
      description:
        "El personal de Ebony (empleados, no contratistas): nombre, puesto, área (taller o administrativo), fecha de ingreso, teléfono, correo y si está activo. El sueldo mensual solo aparece con el permiso de Planilla. Por defecto solo los activos.",
      inputSchema: {
        buscar: z.string().optional().describe("Texto en el nombre o puesto"),
        incluir_inactivos: z.boolean().optional(),
      },
      annotations: READ_ONLY,
    },
    guard("empleados", ["documentos", "planilla"], async (args: { buscar?: string; incluir_inactivos?: boolean }) => {
      const pay = canSeePay();
      const rows = (await getPayrollEmployees())
        .filter((e) => (args.incluir_inactivos || e.status === "ACTIVE") && matches(args.buscar, e.name, e.position))
        .map((e) => ({
          id: e.id,
          nombre: e.name,
          puesto: e.position,
          area: e.categoria,
          activo: e.status === "ACTIVE",
          ingreso: e.startDate,
          salida: e.endDate,
          telefono: e.phone,
          correo: e.email,
          ...(pay ? { sueldo_mensual: usd(e.baseSalaryCents) } : {}),
        }));
      return ok({ cantidad: rows.length, empleados: rows });
    })
  );

  server.registerTool(
    "planilla_quincena",
    {
      title: "Planilla de una quincena",
      description:
        "La planilla de una quincena: por cada empleado activo, el total a pagar, los descuentos de cuotas (préstamos, adelantos, herramientas…) y si ya está pagada; más el total de la quincena. Por defecto la quincena actual.",
      inputSchema: {
        anio: z.number().int().min(2020).max(2100).optional(),
        mes: z.number().int().min(1).max(12).optional(),
        quincena: z.union([z.literal(1), z.literal(2)]).optional().describe("1 = del 1 al 15; 2 = del 16 a fin de mes"),
      },
      annotations: READ_ONLY,
    },
    guard("planilla_quincena", ["planilla"], async (args: { anio?: number; mes?: number; quincena?: 1 | 2 }) => {
      const [y, m, d] = todayInPanama().split("-").map(Number);
      const year = args.anio ?? y;
      const month = args.mes ?? m;
      const h = args.quincena ?? (d <= 15 ? 1 : 2);
      const rows = await payroll.getRegistroForPeriod(year, month, h);
      const out = rows.map((r) => ({
        empleado: r.employee.name,
        total_a_pagar: usd(r.total.totalCents),
        descuentos_cuotas: r.deductions.map((x) => `${x.category} $${(x.amountCents / 100).toFixed(2)}${x.notes ? ` (${x.notes})` : ""}`),
        pagada: r.total.entry?.paid ?? false,
        registrada: r.total.entry != null,
      }));
      return ok({
        quincena: `${half(h)} de ${month}/${year}`,
        empleados: out.length,
        total: usd(rows.reduce((s, r) => s + r.total.totalCents, 0)),
        pagadas: out.filter((r) => r.pagada).length,
        detalle: out,
        nota: "Si una quincena no está registrada, el total es el sueldo base calculado; las horas extra, días y bonos se suman al registrarla en la app.",
      });
    })
  );

  server.registerTool(
    "obligaciones_planilla",
    {
      title: "Obligaciones de planilla",
      description: "Lo que Ebony tiene acumulado por pagar al personal: décimo pendiente (y la fecha de la próxima cuota legal), vacaciones acumuladas y el saldo de préstamos de empleados.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    guard("obligaciones_planilla", ["planilla"], async () => {
      const o = await payroll.getUpcomingObligations();
      return ok({
        decimo_pendiente: usd(o.decimoPendingCents),
        proxima_cuota_decimo: o.decimoDueDate,
        vacaciones_acumuladas: usd(o.vacacionPendingCents),
        prestamos_por_cobrar: usd(o.prestamosPendingCents),
        empleados_con_prestamo: o.employeesWithLoanBalance,
      });
    })
  );

  server.registerTool(
    "prestamos_empleados",
    {
      title: "Préstamos y descuentos de empleados",
      description:
        "Préstamos, adelantos, herramientas, daños y otros descuentos en cuotas de los EMPLEADOS (los de contratistas están en prestamos_contratista): monto, interés, cuotas pagadas, lo pendiente y la próxima cuota. Por defecto solo los que tienen saldo pendiente.",
      inputSchema: {
        empleado: z.string().optional().describe("Nombre (o parte) del empleado"),
        incluir_pagados: z.boolean().optional(),
      },
      annotations: READ_ONLY,
    },
    guard("prestamos_empleados", ["planilla"], async (args: { empleado?: string; incluir_pagados?: boolean }) => {
      const [loans, employees] = await Promise.all([payroll.getLoansOverview(), getPayrollEmployees()]);
      const name = new Map(employees.map((e) => [e.id, e.name]));
      const picked = loans
        .filter((l) => l.status === "active" && (args.incluir_pagados || l.pendingCents > 0))
        .filter((l) => matches(args.empleado, name.get(l.employeeId)));
      const rows = picked.map((l) => ({
          empleado: name.get(l.employeeId) ?? l.employeeId,
          tipo: CONTRACTOR_LOAN_LABEL[l.category] ?? l.category,
          fecha: l.requestDate,
          monto: usd(l.principalCents),
          interes: usd(l.interestCents),
          cuotas: `${l.paidCount} de ${l.installmentCount} pagadas`,
          pagado: usd(l.paidCents),
          pendiente: usd(l.pendingCents),
          proxima_cuota: l.next ? `${usd(l.next.amountCents)} en la ${half(l.next.period.half)} quincena de ${l.next.period.month}/${l.next.period.year}` : null,
        }));
      return ok({ cantidad: rows.length, total_pendiente: usd(picked.reduce((s, l) => s + l.pendingCents, 0)), prestamos: rows });
    })
  );

  server.registerTool(
    "ponchadas",
    {
      title: "Ponchadas (asistencia)",
      description:
        "Las ponchadas de entrada y salida del reloj y del formulario de JotForm en una fecha o rango (por defecto hoy): quién, a qué hora y si fue entrada o salida. Sirve para '¿quién vino hoy?' o '¿a qué hora llegó X?'.",
      inputSchema: {
        desde: z.string().optional().describe("YYYY-MM-DD; por defecto hoy"),
        hasta: z.string().optional().describe("YYYY-MM-DD; por defecto igual a desde"),
        buscar: z.string().optional().describe("Nombre (o parte)"),
      },
      annotations: READ_ONLY,
    },
    guard("ponchadas", ["asistencia"], async (args: { desde?: string; hasta?: string; buscar?: string }) => {
      const from = args.desde ?? todayInPanama();
      const to = args.hasta ?? from;
      if (to < from) return fail("'hasta' no puede ser antes de 'desde'.");
      if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > 31) return fail("Pide como máximo 31 días a la vez.");
      const [punches, status] = await Promise.all([attendance.getPunches(from, to), attendance.getAttendanceStatus()]);
      const rows = punches
        .filter((p) => matches(args.buscar, p.name))
        .sort((a, b) => (a.date === b.date ? a.minutes - b.minutes : a.date < b.date ? -1 : 1))
        .map((p) => ({ fecha: p.date, hora: hhmm(p.minutes), nombre: p.name, tipo: p.kind === "in" ? "entrada" : p.kind === "out" ? "salida" : "?", fuente: p.source, lugar: p.location }));
      return ok({
        desde: from,
        hasta: to,
        cantidad: rows.length,
        ultima_carga_reloj: status.lastReloj ? `${status.lastReloj.date} ${hhmm(status.lastReloj.minutes)}` : null,
        ponchadas: rows,
        nota: "Las del reloj llegan cuando se carga el archivo del reloj; si la última carga es vieja, faltan ponchadas recientes.",
      });
    })
  );

  server.registerTool(
    "solicitudes_dinero",
    {
      title: "Solicitudes de dinero pendientes",
      description: "Las solicitudes de adelanto o préstamo que el personal mandó por el formulario y que todavía no se han procesado en la app: quién, tipo, monto pedido, cuánto quiere que se le descuente por quincena y cuándo llegó.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    guard("solicitudes_dinero", ["planilla", "contratistas"], async () => {
      const rows = (await moneyRequests.getPendingMoneyRequests()).map((r) => ({
        quien: [r.firstName, r.lastName].filter(Boolean).join(" ") || r.email,
        tipo: r.type,
        monto: usd(r.amountCents),
        descuento_por_quincena: usd(r.deductCents),
        llego: r.receivedAt.slice(0, 10),
      }));
      return ok({ cantidad: rows.length, solicitudes: rows, nota: "Se aprueban o descartan en la app (Personal → Pagos)." });
    })
  );
}
