import * as XLSX from "xlsx";

import type { AchRow } from "./bank-export";

/** Columnas de la plantilla TR_ACH, en su orden. */
export const ACH_HEADERS = [
  "ID BENEFICIARIO",
  "NOMBRE BENEFICIARIO",
  "RUTA BANCO",
  "CUENTA BANCO",
  "TIPO CUENTA",
  "MONTO",
  "TIPO TRANS.",
  "ADENDA",
] as const;

/**
 * Libro Excel 97-2003 (.xls) con la hoja `TR_ACH` y las 8 columnas de la
 * plantilla del banco. Identificación, ruta, cuenta, tipo y adenda van como
 * TEXTO (formato `@`, igual que la plantilla: así no se pierden ceros a la
 * izquierda ni se convierte una cuenta en notación científica) y MONTO como
 * número con 2 decimales.
 */
export function buildAchWorkbook(rows: readonly AchRow[]): Buffer {
  const aoa: (string | number)[][] = [
    [...ACH_HEADERS],
    ...rows.map((r) => [r.id, r.name, r.route, r.account, r.accountType, r.amount, r.transType, r.addenda]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (let r = 1; r < aoa.length; r++) {
    for (const c of [0, 1, 2, 3, 4, 6, 7]) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) {
        cell.t = "s";
        cell.z = "@";
      }
    }
    const amount = ws[XLSX.utils.encode_cell({ r, c: 5 })];
    if (amount) amount.z = "0.00";
  }
  ws["!cols"] = [{ wch: 16 }, { wch: 36 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 40 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "TR_ACH");
  return XLSX.write(wb, { bookType: "biff8", type: "buffer" }) as Buffer;
}
