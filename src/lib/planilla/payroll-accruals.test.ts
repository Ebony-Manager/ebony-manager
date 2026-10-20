import { describe, expect, it } from "vitest";

import { currentPeriod, type Period } from "./payroll-period";
import {
  buildEmployeeContext,
  computeAnnualDetail,
  computeDecimoAccrual,
  computePrimaAntiguedadAccrual,
  computeVacationAccrual,
  computePeriodTotalFromEntry,
  periodFromDateString,
} from "./payroll-accruals";
import type { PayrollEmployee, PayrollEntry } from "@/types/planilla";

/**
 * Portado de Atlas (Life OS) src/services/payroll.test.ts.
 *
 * Atlas maneja el estado escribiendo a un SQLite de prueba (createEmployee
 * / upsertEntry) y despues lee de vuelta. Ebony usa Supabase, asi que
 * estos tests manejan el estado en memoria: arman arrays de PayrollEntry
 * y se los pasan a las funciones puras — el mismo camino que usara el
 * servicio, solo que sin el fetch.
 *
 * Cubre las tres formulas de acumulado tal como el usuario las describio
 * de la hoja real: Decimo = pago del segmento de 8 quincenas / 12,
 * evaluado a cualquier periodo (no una ventana calendario fija).
 * Vacacion = 9.09% de lo pagado desde el ultimo pago real, reiniciando
 * la quincena siguiente. Prima de Antiguedad = 1.92% del salario mensual
 * base por mes desde el ingreso (Codigo de Trabajo Art. 196 / Ley 44 de
 * 1995).
 */

// ── helpers de fixture ──────────────────────────────────────────────────

function entry(p: { year: number; month: number; half: 1 | 2 } & Partial<PayrollEntry>): PayrollEntry {
  return {
    id: p.id ?? `e-${p.year}-${p.month}-${p.half}`,
    employeeId: "emp-1",
    periodYear: p.year,
    periodMonth: p.month,
    periodHalf: p.half,
    basePayCents: p.basePayCents ?? 0,
    extraHours: p.extraHours ?? 0,
    extraHoursCents: p.extraHoursCents ?? 0,
    extraDays: p.extraDays ?? 0,
    extraDaysCents: p.extraDaysCents ?? 0,
    viaticosCents: p.viaticosCents ?? 0,
    bonusCents: p.bonusCents ?? 0,
    diasLibresCents: p.diasLibresCents ?? 0,
    horasDescontadas: p.horasDescontadas ?? 0,
    horasDescontadasCents: p.horasDescontadasCents ?? 0,
    diasDescontados: p.diasDescontados ?? 0,
    diasDescontadosCents: p.diasDescontadosCents ?? 0,
    otherDeductionCents: p.otherDeductionCents ?? 0,
    decimoPaidCents: p.decimoPaidCents ?? 0,
    vacationPaidCents: p.vacationPaidCents ?? 0,
    primaAntiguedadPaidCents: p.primaAntiguedadPaidCents ?? 0,
    paymentMethod: "efectivo",
    paid: p.paid ?? false,
    paidAt: null,
    notes: null,
  };
}

function makeEmployee(
  baseSalaryCents = 75_000,
  benefitsBaseSalaryCents: number | null = null,
  startDate: string | null = "2025-01-01"
): PayrollEmployee {
  return {
    id: "emp-1",
    name: "Test Employee",
    position: null,
    startDate,
    endDate: null,
    status: "ACTIVE",
    categoria: "taller",
    baseSalaryCents,
    benefitsBaseSalaryCents,
    benefitsEnabled: true,
    benefitsExternalCompany: null,
    notes: null,
    liquidationNotes: null,
    sortOrder: 0,
    idDocument: null,
    phone: null,
    email: null,
    address: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    contractInfo: null,
    bankName: null,
    bankAccountType: null,
    bankAccountNumber: null,
    bankRoutingCode: null,
    idDocumentType: null,
    nationality: null,
    birthDate: null,
    photoPath: null,
  };
}

/** m=1..n, ambas quincenas, con el mismo basePayCents. */
function bothHalves(year: number, throughMonth: number, basePayCents: number): PayrollEntry[] {
  const out: PayrollEntry[] = [];
  for (let m = 1; m <= throughMonth; m++) {
    out.push(entry({ year, month: m, half: 1, basePayCents }));
    out.push(entry({ year, month: m, half: 2, basePayCents }));
  }
  return out;
}

// ── computeDecimoAccrual ────────────────────────────────────────────────

describe("computeDecimoAccrual", () => {
  it("suma exactamente el segmento Abr16-Ago15 (8 quincenas) y divide entre 12, aterrizando en la fecha de cuota", () => {
    const entries = bothHalves(2026, 8, 37_500);
    // Al 15 de agosto (mes 8, mitad 1, la fecha de cuota): el segmento es
    // Abr-2..Ago-1 = 8 * 37500 = 300000; /12 = 25000. El pago anterior en
    // el año (Ene..Abr-1) pertenece al segmento previo Dic16-Abr15 y NO
    // debe filtrarse a esta suma.
    const decimo = computeDecimoAccrual(entries, { year: 2026, month: 8, half: 1 });
    expect(decimo).toBe(Math.round((8 * 37_500) / 12));
  });

  it("crece como suma parcial del segmento a la fecha para meses antes de la próxima cuota", () => {
    // Refleja los números reales de Dayana 2026: sin pago antes de
    // febrero, $375/quincena de febrero en adelante. El acumulado de
    // décimo debe leer Feb=$62.50, Mar=$125.00 — la suma parcial
    // corriente del segmento Dic16-Abr15, no una ventana fija de 8.
    const entries: PayrollEntry[] = [];
    for (const m of [2, 3]) {
      entries.push(entry({ year: 2026, month: m, half: 1, basePayCents: 37_500 }));
      entries.push(entry({ year: 2026, month: m, half: 2, basePayCents: 37_500 }));
    }
    expect(computeDecimoAccrual(entries, { year: 2026, month: 2, half: 2 })).toBe(6_250); // $62.50
    expect(computeDecimoAccrual(entries, { year: 2026, month: 3, half: 2 })).toBe(12_500); // $125.00
  });

  it("reinicia limpio en el 16-dic del MISMO año, no solo del año previo", () => {
    const entries = bothHalves(2026, 12, 37_500);
    // Justo al 15-dic (la fecha de cuota): segmento Ago16-Dic15 completo, 8 quincenas.
    expect(computeDecimoAccrual(entries, { year: 2026, month: 12, half: 1 })).toBe(Math.round((8 * 37_500) / 12));
    // Al 31-dic (mitad 2, DESPUÉS de la cuota): ya reinició al nuevo
    // segmento Dic16-Abr15 (solo esta quincena), NO siguió acumulando
    // desde Ago16 (que sumaría 9 quincenas en vez de reiniciar a 1).
    expect(computeDecimoAccrual(entries, { year: 2026, month: 12, half: 2 })).toBe(Math.round(37_500 / 12));
  });

  it("usa medio mes plano de la base alterna para quincenas trabajadas, cuando se da una base de prestaciones", () => {
    const entries = bothHalves(2026, 8, 37_500);
    const decimoReal = computeDecimoAccrual(entries, { year: 2026, month: 8, half: 1 });
    const decimoBenefits = computeDecimoAccrual(entries, { year: 2026, month: 8, half: 1 }, 50_000);
    expect(decimoReal).toBe(Math.round((8 * 37_500) / 12));
    expect(decimoBenefits).toBe(Math.round((8 * 25_000) / 12));
  });

  it("NO deja que un pago de décimo/vacación infle el acumulado del SIGUIENTE segmento (sin décimo-sobre-décimo)", () => {
    const entries = bothHalves(2026, 4, 37_500);
    const installmentAmount = Math.round((8 * 37_500) / 12);
    // El pago de la cuota se registra en la MISMA quincena (Abr 2a mitad)
    // que también ancla el segmento 2.
    const idx = entries.findIndex((e) => e.periodMonth === 4 && e.periodHalf === 2);
    entries[idx] = entry({ year: 2026, month: 4, half: 2, basePayCents: 37_500, decimoPaidCents: installmentAmount });
    // Segmento 2 (Abr16-Ago15) hasta acá: solo la 2a mitad de abril —
    // salario real solo, $375, NO $375 + el décimo pagado en esa fila.
    const accrual = computeDecimoAccrual(entries, { year: 2026, month: 4, half: 2 });
    expect(accrual).toBe(Math.round(37_500 / 12));
  });

  it("proyecta medio mes plano para una quincena futura sin entry real, cuando se da una base de proyección", () => {
    // Un año bien después de "ahora", así junio cuenta como genuinamente
    // futuro. El segmento Abr16-Ago15 (asOf = junio 2a mitad) tiene
    // entries reales para Abr 2a mitad + todo mayo, y junio queda sin
    // entrar.
    const year = currentPeriod().year + 5;
    const entries = [
      entry({ year, month: 4, half: 2, basePayCents: 37_500 }),
      entry({ year, month: 5, half: 1, basePayCents: 37_500 }),
      entry({ year, month: 5, half: 2, basePayCents: 37_500 }),
    ];
    const withoutProjection = computeDecimoAccrual(entries, { year, month: 6, half: 2 });
    const withProjection = computeDecimoAccrual(entries, { year, month: 6, half: 2 }, undefined, 75_000);
    expect(withoutProjection).toBe(Math.round((3 * 37_500) / 12));
    expect(withProjection).toBe(Math.round((3 * 37_500 + 2 * 37_500) / 12));
  });
});

// ── computeVacationAccrual ──────────────────────────────────────────────

describe("computeVacationAccrual", () => {
  it("en el período de pago exacto, da la suma inclusiva desde el pago ANTERIOR — el monto que esa cuota representa", () => {
    const entries = bothHalves(2026, 4, 37_500);
    // Vacación pagada en la 2a quincena de marzo (se fusiona con el
    // basePay que ya traía esa fila).
    const idx = entries.findIndex((e) => e.periodMonth === 3 && e.periodHalf === 2);
    entries[idx] = entry({ year: 2026, month: 3, half: 2, basePayCents: 37_500, vacationPaidCents: 12_345 });

    // Al 2a mitad de marzo (el período de pago mismo): sin pago previo,
    // así que es la suma de todo desde el inicio hasta e incluyendo este
    // período — 6 quincenas (Ene1..Mar2).
    expect(computeVacationAccrual(entries, { year: 2026, month: 3, half: 2 })).toBe(Math.round(6 * 37_500 * 0.0909));

    // Al 2a mitad de abril: reinicia limpio justo después del pago — dos
    // quincenas (Abr 1a, Abr 2a) de salario real desde entonces.
    expect(computeVacationAccrual(entries, { year: 2026, month: 4, half: 2 })).toBe(Math.round(2 * 37_500 * 0.0909));
  });

  it("sigue creciendo más allá de la última quincena real cuando se da una base de proyección, para un asOf futuro", () => {
    const year = currentPeriod().year + 5;
    const entries = bothHalves(year, 4, 37_500); // 8 quincenas, sin pago de vacación
    // Sin proyectar, preguntar a junio (futuro respecto a la última entry
    // de abril) simplemente deja de crecer en la suma real de abril.
    const withoutProjection = computeVacationAccrual(entries, { year, month: 6, half: 2 });
    expect(withoutProjection).toBe(Math.round(8 * 37_500 * 0.0909));

    // Con proyección, mayo/junio (4 quincenas más) suman cada una medio
    // mes plano de la base de proyección.
    const withProjection = computeVacationAccrual(entries, { year, month: 6, half: 2 }, undefined, 75_000);
    expect(withProjection).toBe(Math.round((8 * 37_500 + 4 * 37_500) * 0.0909));
  });
});

// ── computePrimaAntiguedadAccrual ───────────────────────────────────────

describe("computePrimaAntiguedadAccrual", () => {
  it("acumula 1.92% del salario mensual base por mes completo desde el ingreso", () => {
    const employee = makeEmployee(100_000, null, "2025-01-15");
    // Al 2026-01-15, exactamente un año (12 meses) después.
    const accrual = computePrimaAntiguedadAccrual(employee, { year: 2026, month: 1, half: 1 });
    expect(accrual).toBe(Math.round(100_000 * 0.0192 * 12));
  });

  it("devuelve 0 para un empleado sin fecha de ingreso", () => {
    const employee = makeEmployee(100_000, null, null);
    expect(computePrimaAntiguedadAccrual(employee, { year: 2026, month: 1, half: 1 })).toBe(0);
  });

  it("reinicia su reloj a una fecha de liquidación marcada en vez de contar siempre desde el ingreso", () => {
    const employee = makeEmployee(100_000, null, "2022-01-15");
    // Sin liquidación marcada, el reloj corre desde el ingreso: al
    // 2025-11-15, son ~46 meses.
    const beforeLiquidation = computePrimaAntiguedadAccrual(employee, { year: 2025, month: 11, half: 1 });
    expect(beforeLiquidation).toBe(Math.round(100_000 * 0.0192 * 46));

    const liquidated: PayrollEmployee = { ...employee, endDate: "2025-11-15" };

    // Tres meses después (2026-02-15), el reloj debe haber reiniciado
    // desde la fecha de liquidación — NO seguir contando desde 2022.
    const afterLiquidation = computePrimaAntiguedadAccrual(liquidated, { year: 2026, month: 2, half: 1 });
    expect(afterLiquidation).toBe(Math.round(100_000 * 0.0192 * 3));
  });
});

// ── computeAnnualDetail: hueco de liquidación ───────────────────────────

describe("computeAnnualDetail — hueco de liquidación", () => {
  it("pone en 0 Décimo/Vacación/Prima para quincenas estrictamente entre una liquidación marcada y la siguiente entry real, y luego reanuda normal", () => {
    // La forma real que esto resuelve: alguien liquidado en Nov 2025
    // (marcado como liquidación, NO terminación — sigue ACTIVE), un hueco
    // real hasta enero 2026 sin ningún payroll_entry, y reanuda en
    // febrero 2026. Décimo/Vacación/Prima deben mostrar 0 en los meses
    // del hueco, y Prima debe contar sus meses calendario desde la fecha
    // de liquidación una vez que reanuda, no desde el ingreso 2022.
    const employee: PayrollEmployee = { ...makeEmployee(75_000, null, "2022-01-15"), endDate: "2025-11-15" };
    const entries = [
      entry({ year: 2025, month: 10, half: 1, basePayCents: 37_500 }),
      entry({ year: 2025, month: 11, half: 1, basePayCents: 37_500 }),
      // Nada para dic 2025 ni ene 2026 — el hueco real.
      entry({ year: 2026, month: 2, half: 1, basePayCents: 37_500 }),
    ];
    const context = buildEmployeeContext(entries, []);
    const detail2026 = computeAnnualDetail(employee, context, 2026);

    const jan1 = detail2026.find((r) => r.month === 1 && r.half === 1)!;
    const jan2 = detail2026.find((r) => r.month === 1 && r.half === 2)!;
    const feb1 = detail2026.find((r) => r.month === 2 && r.half === 1)!;

    expect(jan1.decimoAccrualCents).toBe(0);
    expect(jan1.vacationAccrualCents).toBe(0);
    expect(jan1.primaAntiguedadAccrualCents).toBe(0);
    expect(jan2.primaAntiguedadAccrualCents).toBe(0);

    // Reanudó en feb 2026 mitad 1 — 3 meses calendario desde la
    // liquidación del 15-nov-2025, no ~49 meses desde el ingreso 2022.
    expect(feb1.primaAntiguedadAccrualCents).toBe(Math.round(75_000 * 0.0192 * 3));
  });
});

// ── computePeriodTotalFromEntry: la fórmula del total de quincena ────────

describe("computePeriodTotalFromEntry", () => {
  it("suma base + extras + prestaciones pagadas, resta descuentos y el abono de ledger", () => {
    const e = entry({
      year: 2026,
      month: 5,
      half: 1,
      basePayCents: 37_500,
      extraHoursCents: 2_000,
      bonusCents: 1_000,
      diasLibresCents: 500,
      horasDescontadasCents: 300,
      otherDeductionCents: 200,
      decimoPaidCents: 4_000,
      vacationPaidCents: 1_500,
    });
    const total = computePeriodTotalFromEntry(e, { debt: 0, payment: 2_500 });
    // 37500 + 2000 + 1000 + 500 + 4000 + 1500 - 300 - 200 - 2500
    expect(total.totalCents).toBe(43_500);
    expect(total.ledgerPaymentCents).toBe(2_500);
  });

  it("sin entry, el total es 0 pero conserva las cifras del ledger", () => {
    const total = computePeriodTotalFromEntry(null, { debt: 9_000, payment: 0 });
    expect(total).toEqual({ entry: null, ledgerDebtCents: 9_000, ledgerPaymentCents: 0, totalCents: 0 });
  });
});

// ── un ancla anti-regresión sobre el lookup del contexto ────────────────

describe("buildEmployeeContext", () => {
  it("lastVacationPayout es estrictamente anterior a asOf (un período de pago se mira a sí mismo hacia atrás)", () => {
    const entries = [
      entry({ year: 2026, month: 3, half: 2, basePayCents: 37_500, vacationPaidCents: 10_000 }),
      entry({ year: 2026, month: 7, half: 1, basePayCents: 37_500, vacationPaidCents: 20_000 }),
    ];
    const ctx = buildEmployeeContext(entries, []);
    const atFirstPayout: Period = { year: 2026, month: 3, half: 2 };
    const afterFirstPayout: Period = { year: 2026, month: 5, half: 1 };
    const atSecondPayout: Period = { year: 2026, month: 7, half: 1 };
    expect(ctx.lastVacationPayout(atFirstPayout)).toBeNull();
    expect(ctx.lastVacationPayout(afterFirstPayout)).toEqual({ year: 2026, month: 3, half: 2 });
    expect(ctx.lastVacationPayout(atSecondPayout)).toEqual({ year: 2026, month: 3, half: 2 });
  });
});

describe("periodFromDateString", () => {
  it("lee la fecha tal cual, sin correrse por la zona horaria", () => {
    expect(periodFromDateString("2026-01-01")).toEqual({ year: 2026, month: 1, half: 1 });
    expect(periodFromDateString("2026-01-15")).toEqual({ year: 2026, month: 1, half: 1 });
    expect(periodFromDateString("2026-01-16")).toEqual({ year: 2026, month: 1, half: 2 });
    expect(periodFromDateString("2026-12-31")).toEqual({ year: 2026, month: 12, half: 2 });
  });
  it("fecha inválida -> null", () => {
    expect(periodFromDateString("no es fecha")).toBeNull();
  });
});

// ── Prima sobre lo PAGADO, reinicio al pagar, "no lleva prestaciones" ───

describe("prima de antigüedad sobre el salario pagado", () => {
  // Ingreso 2026-01-01, base 800/mes. Quincenas completas pagan 400; las de
  // marzo pagan 300 por horas descontadas -> el promedio mensual pagado baja.
  const employee = makeEmployee(80_000, null, "2026-01-01");
  const entries: PayrollEntry[] = [];
  for (const month of [1, 2, 3, 4]) {
    for (const half of [1, 2] as const) {
      entries.push(
        entry({ year: 2026, month, half, basePayCents: 40_000, horasDescontadasCents: month === 3 ? 10_000 : 0 })
      );
    }
  }
  const ctx = buildEmployeeContext(entries, []);
  const opts = (asOf: Period) => ({ lastPayout: ctx.lastPrimaPayout(asOf), compensation: ctx.compensation });

  it("usa el promedio realmente pagado, no el salario base", () => {
    const asOf: Period = { year: 2026, month: 5, half: 1 };
    const onBase = computePrimaAntiguedadAccrual(employee, asOf);
    const onPaid = computePrimaAntiguedadAccrual(employee, asOf, opts(asOf));
    // 8 quincenas: 6 x 400 + 2 x 300 = 3000 -> promedio mensual 750.
    expect(onBase).toBe(Math.round(80_000 * 0.0192 * 4));
    expect(onPaid).toBe(Math.round(75_000 * 0.0192 * 4));
    expect(onPaid).toBeLessThan(onBase);
  });

  it("un pago de prima reinicia el acumulado", () => {
    const paid = [...entries, entry({ year: 2026, month: 5, half: 1, basePayCents: 40_000, primaAntiguedadPaidCents: 5_000 })];
    const c = buildEmployeeContext(paid, []);
    const before = computePrimaAntiguedadAccrual(employee, { year: 2026, month: 5, half: 1 }, {
      lastPayout: c.lastPrimaPayout({ year: 2026, month: 5, half: 1 }),
      compensation: c.compensation,
    });
    const afterPay: Period = { year: 2026, month: 6, half: 1 };
    const after = computePrimaAntiguedadAccrual(employee, afterPay, {
      lastPayout: c.lastPrimaPayout(afterPay),
      compensation: c.compensation,
    });
    const later: Period = { year: 2026, month: 9, half: 1 };
    const muchLater = computePrimaAntiguedadAccrual(employee, later, {
      lastPayout: c.lastPrimaPayout(later),
      compensation: c.compensation,
    });
    expect(before).toBeGreaterThan(0);
    expect(after).toBeLessThan(before); // volvió a empezar
    expect(muchLater).toBeGreaterThan(after); // y vuelve a crecer mes a mes
  });
});

describe("computeAnnualDetail — empleado que no lleva prestaciones", () => {
  it("deja décimo, vacación y prima en 0", () => {
    const employee = { ...makeEmployee(80_000, null, "2025-01-01"), benefitsEnabled: false };
    const ctx = buildEmployeeContext([entry({ year: 2026, month: 1, half: 1, basePayCents: 40_000 })], []);
    const rows = computeAnnualDetail(employee, ctx, 2026);
    expect(rows.every((r) => r.decimoAccrualCents === 0 && r.vacationAccrualCents === 0 && r.primaAntiguedadAccrualCents === 0)).toBe(true);
    const on = computeAnnualDetail({ ...employee, benefitsEnabled: true }, ctx, 2026);
    expect(on.some((r) => r.primaAntiguedadAccrualCents > 0)).toBe(true);
  });
});
