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

/** Fecha del reloj: "20261001" o "2026-10-01" -> "2026-10-01". null si no es una fecha. */
const clockDate = (s: string): string | null => {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(s.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

/**
 * Texto CSV a filas. Respeta las celdas entre comillas, que pueden traer
 * comas, comillas dobles ("") o saltos de línea (el reloj pone el nombre y su
 * número en dos líneas de la misma celda). Ignora la marca BOM del inicio.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/**
 * Reporte "Timecard Report" del reloj: por empleado un bloque "Employee,,,Nombre (id)" y
 * una fila por día "THU,20261001,IN,OUT,…". Un día con varias marcaciones trae filas de
 * continuación sin fecha. "Missing OUT" = no hay salida (la columna OUT viene vacía).
 * Desde la quincena del 16 de octubre de 2026 el reloj exporta la fecha con guiones
 * ("2026-10-16") y el número del empleado en otra línea de la misma celda; se leen los dos.
 * Si entre la entrada y la salida pasan más de 12 horas, el reloj no las une: deja la
 * entrada en la fila del día ("Missing OUT") y la salida en una fila de continuación con
 * IN vacío ("Missing IN"). Esa salida es del mismo día y también se lee.
 */
export function parseClockReport(rows: string[][]): RawPunch[] {
  const out: RawPunch[] = [];
  let name: string | null = null;
  let date: string | null = null;
  for (const r of rows) {
    if (r[0] === "Employee" && r[3]) {
      name = r[3].replace(/\s*\(\d+\)\s*$/, "").replace(/\s+/g, " ").trim();
      date = null;
      continue;
    }
    if (!name) continue;
    const day = clockDate(r[1] ?? "");
    const isDayRow = day !== null;
    const isContinuation =
      !isDayRow &&
      (r[0] ?? "") === "" &&
      (r[1] ?? "") === "" &&
      (Boolean(r[2]) || toMinutes(r[3] ?? "") !== null) &&
      date !== null;
    if (!isDayRow && !isContinuation) continue;
    if (isDayRow) date = day;
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

/** Nombre para comparar: minúsculas, sin acentos ni signos (también la clave de `attendance_name_links`). */
export const foldName = (s: string) =>
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
  "alonso dominguez": "Alonzo Dominguez",
  "jhon jader": "Jhon Pena",
  "alexis canto": "Sebastian Canto",
  "jhosep soto": "Joseph Guevara",
};

/**
 * Empareja los nombres de las marcaciones con los empleados de la app: primero
 * el vínculo guardado en la app (`links`: nombre → empleado, o null = no es
 * empleado y se ignora), luego el alias conocido, luego el nombre igual, luego
 * el nombre contenido en el otro (solo si es único). Lo que no se pueda
 * emparejar con certeza queda sin resolver.
 */
export function matchEmployees(
  names: readonly string[],
  employees: readonly MatchableEmployee[],
  links: ReadonlyMap<string, string | null> = new Map()
): { matched: Map<string, MatchableEmployee>; unmatched: string[] } {
  const byFolded = new Map(employees.map((e) => [foldName(e.name), e]));
  const byId = new Map(employees.map((e) => [e.id, e]));
  const matched = new Map<string, MatchableEmployee>();
  const unmatched: string[] = [];
  for (const name of new Set(names)) {
    const f = foldName(name);
    if (links.has(f)) {
      const linked = links.get(f);
      const e = linked ? byId.get(linked) : undefined;
      if (e) matched.set(name, e);
      // Vinculado a alguien que ya no está en la lista (o "ignorar"): no se reclama.
      continue;
    }
    const alias = NAME_ALIASES[f];
    let hit = (alias ? byFolded.get(foldName(alias)) : undefined) ?? byFolded.get(f);
    if (!hit) {
      const candidates = employees.filter((e) => {
        const ef = foldName(e.name);
        return ef.includes(f) || f.includes(ef);
      });
      if (candidates.length === 1) hit = candidates[0];
    }
    if (hit) matched.set(name, hit);
    else unmatched.push(name);
  }
  return { matched, unmatched };
}
