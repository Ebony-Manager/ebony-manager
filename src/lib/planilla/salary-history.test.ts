import { describe, expect, it } from "vitest";
import {
  benefitsBaseAt,
  earliestSalary,
  monthlySalaryAt,
  quincenaBaseCentsAt,
  salaryInEffect,
  type SalaryChange,
} from "./salary-history";

function ch(
  year: number,
  month: number,
  half: 1 | 2,
  monthlySalaryCents: number,
  benefitsBaseSalaryCents: number | null = null
): SalaryChange {
  return { effectiveYear: year, effectiveMonth: month, effectiveHalf: half, monthlySalaryCents, benefitsBaseSalaryCents };
}

// Historial desordenado a propósito — el orden de inserción no importa.
const HISTORY: SalaryChange[] = [
  ch(2026, 6, 1, 120_000), // aumento a $1,200 desde jun 1Q
  ch(2025, 2, 1, 75_000, 50_000), // sueldo inicial $750, prestaciones sobre $500
  ch(2026, 1, 2, 90_000), // aumento a $900 desde ene 2Q
];

describe("salaryInEffect", () => {
  it("toma la fila más reciente con fecha efectiva <= la quincena", () => {
    expect(salaryInEffect(HISTORY, 2025, 12, 2)?.monthlySalaryCents).toBe(75_000);
    expect(salaryInEffect(HISTORY, 2026, 1, 1)?.monthlySalaryCents).toBe(75_000); // el de ene 2Q aún no aplica
    expect(salaryInEffect(HISTORY, 2026, 1, 2)?.monthlySalaryCents).toBe(90_000);
    expect(salaryInEffect(HISTORY, 2026, 5, 2)?.monthlySalaryCents).toBe(90_000);
    expect(salaryInEffect(HISTORY, 2026, 6, 1)?.monthlySalaryCents).toBe(120_000); // aplica desde el inicio de la quincena
    expect(salaryInEffect(HISTORY, 2027, 1, 1)?.monthlySalaryCents).toBe(120_000);
  });

  it("devuelve null para una quincena anterior a todo el historial", () => {
    expect(salaryInEffect(HISTORY, 2025, 1, 1)).toBeNull();
  });
});

describe("earliestSalary", () => {
  it("es la fila más antigua", () => {
    expect(earliestSalary(HISTORY)?.monthlySalaryCents).toBe(75_000);
    expect(earliestSalary([])).toBeNull();
  });
});

describe("monthlySalaryAt", () => {
  it("cae al sueldo inicial cuando la quincena precede al historial", () => {
    expect(monthlySalaryAt(HISTORY, 2025, 1, 1)).toBe(75_000);
    expect(monthlySalaryAt(HISTORY, 2026, 6, 2)).toBe(120_000);
    expect(monthlySalaryAt([], 2026, 1, 1)).toBe(0);
  });
});

describe("benefitsBaseAt", () => {
  it("da la base alterna del tramo vigente, o null si no hay", () => {
    expect(benefitsBaseAt(HISTORY, 2025, 6, 1)).toBe(50_000);
    expect(benefitsBaseAt(HISTORY, 2026, 3, 1)).toBeNull(); // el tramo de $900 no tiene base alterna
  });
});

describe("quincenaBaseCentsAt", () => {
  it("es el sueldo mensual vigente / 2 redondeado", () => {
    expect(quincenaBaseCentsAt(HISTORY, 2025, 6, 1)).toBe(37_500);
    expect(quincenaBaseCentsAt(HISTORY, 2026, 6, 1)).toBe(60_000);
    // sueldo impar en centavos -> redondeo
    expect(quincenaBaseCentsAt([ch(2026, 1, 1, 75_001)], 2026, 3, 1)).toBe(Math.round(75_001 / 2));
  });
});
