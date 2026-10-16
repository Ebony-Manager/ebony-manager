/**
 * Lectura de los dos archivos de marcaciones, ya convertidos a filas de texto
 * (el archivo en sí lo abre quien llama): el reporte del reloj (CSV) y el
 * Jotform de la gente que sale a proyectos (xlsx).
 */
import type { RawPunch } from "./types";

const toMinutes = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** "20261001" -> "2026-10-01". */
const isoFromCompact = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

/**
 * Reporte "Timecard Report" del reloj: por empleado un bloque "Employee,,,Nombre (id)" y
 * una fila por día "THU,20261001,IN,OUT,…". Un día con varias marcaciones trae filas de
 * continuación sin fecha. "Missing OUT" = no hay salida (la columna OUT viene vacía).
 */
export function parseClockReport(rows: string[][]): RawPunch[] {
  const out: RawPunch[] = [];
  let name: string | null = null;
  let date: string | null = null;
  for (const r of rows) {
    if (r[0] === "Employee" && r[3]) {
      name = r[3].replace(/\s*\(\d+\)\s*$/, "").trim();
      date = null;
      continue;
    }
    if (!name) continue;
    const isDayRow = /^\d{8}$/.test(r[1] ?? "");
    const isContinuation = !isDayRow && (r[0] ?? "") === "" && (r[1] ?? "") === "" && Boolean(r[2]) && date !== null;
    if (!isDayRow && !isContinuation) continue;
    if (isDayRow) date = isoFromCompact(r[1]);
    const tin = toMinutes(r[2] ?? "");
    const tout = toMinutes(r[3] ?? "");
    if (tin !== null) out.push({ name, date: date!, minutes: tin, kind: "in", source: "reloj" });
    if (tout !== null) out.push({ name, date: date!, minutes: tout, kind: "out", source: "reloj" });
  }
  return out;
}

/**
 * Jotform "Punch In/Out": columnas ID, "Entrada o Salida?", Fecha (MM/DD/AAAA), Hora, …,
 * "Temp Nombre". El nombre a veces viene vacío o como "undefined"; entonces se busca por
 * el código (ID) en otras filas que sí lo traen (sin importar mayúsculas: EER21 = Eer21).
 */
export function parseJotformPunches(rows: string[][]): RawPunch[] {
  const header = rows[0] ?? [];
  const idx = (label: string) => header.findIndex((h) => h.trim().toLowerCase() === label);
  const iId = idx("id");
  const iKind = header.findIndex((h) => h.toLowerCase().startsWith("entrada"));
  const iDate = idx("fecha");
  const iTime = idx("hora");
  const iName = header.findIndex((h) => h.toLowerCase().includes("nombre"));
  const data = rows.slice(1).filter((r) => r[iId]);

  const nameByCode = new Map<string, string>();
  const clean = (n: string | undefined) => (n && n.trim() && n.trim().toLowerCase() !== "undefined" ? n.trim() : null);
  for (const r of data) {
    const n = clean(r[iName]);
    if (n) nameByCode.set(r[iId].trim().toLowerCase(), n);
  }

  const out: RawPunch[] = [];
  for (const r of data) {
    const code = r[iId].trim();
    const name = clean(r[iName]) ?? nameByCode.get(code.toLowerCase());
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((r[iDate] ?? "").trim());
    const minutes = toMinutes(r[iTime] ?? "");
    if (!name || !m || minutes === null) continue;
    const kindText = (r[iKind] ?? "").trim().toUpperCase();
    out.push({
      name,
      code,
      date: `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`,
      minutes,
      kind: kindText === "ENTRADA" ? "in" : kindText === "SALIDA" ? "out" : "unknown",
      source: "jotform",
    });
  }
  return out;
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export interface MatchableEmployee {
  id: string;
  name: string;
}

/** Alias de nombres que no coinciden letra por letra (nombre del archivo -> nombre en la app). */
export const NAME_ALIASES: Record<string, string> = {
  "hector berrio": "Hector Berrio Benedetti",
  "nabil soriano": "Nabil Massiel Soriano",
  "angelis ceballos": "Angelys Ceballos",
  "javier garrido": "Einar Javier Garrido",
  "luis rodriguez": "Luis Alejandro Rodriguez",
  "javier alonzo": "Javier Alonzo Dominguez",
  // Confirmados por Ebony: el mismo empleado aparece con otro nombre según el archivo.
  "alonso dominguez": "J. Marceline Alonzo D.",
  "jhon jader": "Jhon Pena",
  "alexis canto": "Sebastian Canto",
  "jhosep soto": "Joseph Guevara",
};

/**
 * Empareja los nombres de las marcaciones con los empleados de la app: primero
 * el alias conocido, luego el nombre igual, luego el nombre contenido en el otro
 * (solo si es único). Lo que no se pueda emparejar con certeza queda sin resolver.
 */
export function matchEmployees(
  names: readonly string[],
  employees: readonly MatchableEmployee[]
): { matched: Map<string, MatchableEmployee>; unmatched: string[] } {
  const byFolded = new Map(employees.map((e) => [fold(e.name), e]));
  const matched = new Map<string, MatchableEmployee>();
  const unmatched: string[] = [];
  for (const name of new Set(names)) {
    const f = fold(name);
    const alias = NAME_ALIASES[f];
    let hit = (alias ? byFolded.get(fold(alias)) : undefined) ?? byFolded.get(f);
    if (!hit) {
      const candidates = employees.filter((e) => {
        const ef = fold(e.name);
        return ef.includes(f) || f.includes(ef);
      });
      if (candidates.length === 1) hit = candidates[0];
    }
    if (hit) matched.set(name, hit);
    else unmatched.push(name);
  }
  return { matched, unmatched };
}
