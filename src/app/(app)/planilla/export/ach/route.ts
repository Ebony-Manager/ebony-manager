import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/dal";
import {
  achFileName,
  ACH_DEFAULT_ADDENDA_TEXT,
  buildAchPayload,
  type AchAccountType,
} from "@/lib/planilla/bank-export";
import { buildAchWorkbook } from "@/lib/planilla/bank-export-xls";
import { getRegistroForPeriod } from "@/services/payroll";

// Solo admin, y nunca cacheado: el archivo sale de los datos de ESTA quincena.
export const dynamic = "force-dynamic";

/**
 * GET /planilla/export/ach?year=2026&month=10&half=1&text=Pago de Planilla
 *
 * Devuelve el archivo `ACH-FILE  _D-M-AAAA.xls` con la hoja `TR_ACH` y las
 * mismas 8 columnas de la plantilla del banco (Excel 97-2003, que es lo
 * que usa la plantilla). Solo incluye a quien se paga por transferencia,
 * tiene neto > 0 y tiene completos cédula, ruta, cuenta y tipo de cuenta;
 * la vista previa de Registro lista a los que quedan fuera y por qué.
 */
export async function GET(request: NextRequest) {
  await requireAdmin();

  const sp = request.nextUrl.searchParams;
  const year = Number(sp.get("year"));
  const month = Number(sp.get("month"));
  const half = Number(sp.get("half"));
  if (!Number.isInteger(year) || !(month >= 1 && month <= 12) || (half !== 1 && half !== 2)) {
    return new Response("Parámetros inválidos (year, month, half).", { status: 400 });
  }
  const text = sp.get("text") || ACH_DEFAULT_ADDENDA_TEXT;
  const defaultRoute = sp.get("route") ?? "";

  const rows = await getRegistroForPeriod(year, month, half);
  const payload = buildAchPayload(
    rows.map(({ employee, total }) => ({
      employeeId: employee.id,
      name: employee.name,
      idDocument: employee.idDocument,
      bankRoutingCode: employee.bankRoutingCode,
      bankAccountNumber: employee.bankAccountNumber,
      bankAccountType: employee.bankAccountType as AchAccountType | null,
      paymentMethod: total.entry?.paymentMethod ?? "transferencia",
      netCents: total.totalCents,
      benefits: {
        decimoCents: total.entry?.decimoPaidCents ?? 0,
        vacationCents: total.entry?.vacationPaidCents ?? 0,
        primaCents: total.entry?.primaAntiguedadPaidCents ?? 0,
      },
      benefitsPaidExternally: Boolean(employee.benefitsExternalCompany),
    })),
    text,
    defaultRoute,
    {
      decimo: sp.get("decimo") || undefined,
      vacacion: sp.get("vacacion") || undefined,
      prima: sp.get("prima") || undefined,
    }
  );

  const buffer = buildAchWorkbook(payload.rows);

  const filename = achFileName(new Date());
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.ms-excel",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
