import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { buildAchPayload } from "./bank-export";
import { ACH_HEADERS, buildAchWorkbook } from "./bank-export-xls";

describe("buildAchWorkbook", () => {
  const payload = buildAchPayload(
    [
      {
        employeeId: "e1", name: "María Núñez", idDocument: "8-123-4567", bankRoutingCode: "00071",
        bankAccountNumber: "0004301234567", bankAccountType: "ahorro", paymentMethod: "transferencia", netCents: 12345,
      },
    ],
    "Pago 1Q Oct"
  );

  it("genera un .xls (BIFF8) que se vuelve a leer con la hoja TR_ACH y las 8 columnas", () => {
    const buf = buildAchWorkbook(payload.rows);
    // Firma de un archivo Excel 97-2003 (contenedor OLE2).
    expect([...buf.subarray(0, 8)]).toEqual([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toEqual(["TR_ACH"]);
    const grid = XLSX.utils.sheet_to_json<string[]>(wb.Sheets.TR_ACH, { header: 1, raw: true });
    expect(grid[0]).toEqual([...ACH_HEADERS]);
    expect(grid[1]).toEqual(["8-123-4567", "MARIA NUNEZ", "00071", "0004301234567", "04", 123.45, "C", "REF*TXT**Pago 1Q Oct\\"]);
  });

  it("cuenta y ruta quedan como TEXTO: se conservan los ceros a la izquierda", () => {
    const wb = XLSX.read(buildAchWorkbook(payload.rows), { type: "buffer" });
    const ws = wb.Sheets.TR_ACH;
    expect(ws.C2.t).toBe("s");
    expect(ws.D2.v).toBe("0004301234567");
    expect(ws.F2.t).toBe("n");
  });

  it("sin filas: solo el encabezado", () => {
    const wb = XLSX.read(buildAchWorkbook([]), { type: "buffer" });
    expect(XLSX.utils.sheet_to_json(wb.Sheets.TR_ACH, { header: 1 })).toEqual([[...ACH_HEADERS]]);
  });
});
