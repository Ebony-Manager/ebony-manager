// El correo del resumen diario del Almacén: lo que llegó al mínimo, las
// solicitudes por pedir, los pedidos que no han llegado y las salidas de ayer.
// Puro (sin red): la ruta /api/almacen/resumen-diario trae los datos y lo manda.

import { formatQty, unitLabel } from "./inventory";

export interface DailySummary {
  today: string;
  /** Día ISO de hoy (1 = lunes … 7 = domingo). */
  dow: number;
  /** Settings → Notificaciones. */
  enabled: boolean;
  days: number[];
  recipients: string[];
  low_stock: { category: string; name: string; label: string; unit: string; stock: number; min: number; reorder: number | null; requested: boolean }[];
  pending_requests: { name: string; label: string | null; qty: number; unit: string | null; by: string | null; auto: boolean; created_at: string }[];
  open_orders: { supplier: string; ordered_on: string; status: string; days: number; lines: number }[];
  yesterday: { issues: number; lines: number; short: string[] };
}

export interface SummaryEmail {
  subject: string;
  html: string;
  text: string;
  /** false = no hay nada que avisar; el cron no lo manda. */
  hasContent: boolean;
}

const MAX_LOW = 60;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const qty = (n: number, unit: string | null) => `${formatQty(n)} ${unitLabel(unit, n)}`;

function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

function table(headers: string[], rows: string[][], alignRight: number[] = []): string {
  const cell = (c: string, i: number, th = false) =>
    `<${th ? "th" : "td"} style="padding:6px 8px;border-bottom:1px solid #e7e2dc;text-align:${alignRight.includes(i) ? "right" : "left"};${th ? "font-weight:600;color:#6b625a;font-size:12px" : "font-size:14px"}">${c}</${th ? "th" : "td"}>`;
  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:6px 0 18px">
<tr>${headers.map((h, i) => cell(h, i, true)).join("")}</tr>
${rows.map((r) => `<tr>${r.map((c, i) => cell(c, i)).join("")}</tr>`).join("\n")}
</table>`;
}

export function buildSummaryEmail(s: DailySummary, appUrl: string): SummaryEmail {
  const out = s.low_stock.filter((x) => x.stock <= 0);
  const hasContent = s.low_stock.length > 0 || s.pending_requests.length > 0 || s.open_orders.length > 0 || s.yesterday.issues > 0;
  const counts =
    [
      s.low_stock.length ? `${s.low_stock.length} bajo el mínimo` : null,
      s.pending_requests.length ? `${s.pending_requests.length} por pedir` : null,
      s.open_orders.length ? `${s.open_orders.length} pedidos por llegar` : null,
    ]
      .filter(Boolean)
      .join(", ") || "todo en orden";
  const subject = `Almacén · ${longDate(s.today)}: ${counts}`;

  const sections: string[] = [];
  const text: string[] = [`Resumen del almacén — ${longDate(s.today)}`, ""];

  if (s.low_stock.length) {
    const shown = s.low_stock.slice(0, MAX_LOW);
    sections.push(
      `<h2 style="font-size:16px;margin:0 0 4px">Bajo el mínimo (${s.low_stock.length})</h2>
<p style="margin:0 0 4px;color:#6b625a;font-size:13px">${out.length} sin existencia. Los marcados con ✓ ya tienen solicitud de compra.</p>` +
        table(
          ["Producto", "Hay", "Mínimo", "Pedir hasta", ""],
          shown.map((x) => [
            `${esc(x.name)}${x.label ? `<br><span style="color:#6b625a;font-size:12px">${esc(x.label)}</span>` : ""}`,
            `<span style="color:${x.stock <= 0 ? "#b42318" : "#b54708"};font-weight:600">${qty(x.stock, x.unit)}</span>`,
            formatQty(x.min),
            x.reorder != null ? formatQty(x.reorder) : "—",
            x.requested ? "✓" : "",
          ]),
          [1, 2, 3],
        ) +
        (s.low_stock.length > MAX_LOW ? `<p style="font-size:13px;color:#6b625a">…y ${s.low_stock.length - MAX_LOW} más en la app.</p>` : ""),
    );
    text.push(`BAJO EL MÍNIMO (${s.low_stock.length})`, ...shown.map((x) => `- ${x.name}${x.label ? ` · ${x.label}` : ""}: hay ${qty(x.stock, x.unit)}, mínimo ${formatQty(x.min)}`), "");
  }

  if (s.pending_requests.length) {
    sections.push(
      `<h2 style="font-size:16px;margin:0 0 4px">Solicitudes por pedir (${s.pending_requests.length})</h2>` +
        table(
          ["Qué", "Cantidad", "Pidió"],
          s.pending_requests.map((r) => [esc(r.name), qty(r.qty, r.unit), r.auto ? "Automática" : esc(r.by ?? "—")]),
          [1],
        ),
    );
    text.push(`POR PEDIR (${s.pending_requests.length})`, ...s.pending_requests.map((r) => `- ${r.name}: ${qty(r.qty, r.unit)}`), "");
  }

  if (s.open_orders.length) {
    sections.push(
      `<h2 style="font-size:16px;margin:0 0 4px">Pedidos por llegar (${s.open_orders.length})</h2>` +
        table(
          ["Proveedor", "Pedido hace", "Líneas pendientes"],
          s.open_orders.map((o) => [
            esc(o.supplier),
            `<span style="color:${o.days > 5 ? "#b42318" : "inherit"}">${o.days === 0 ? "hoy" : o.days === 1 ? "1 día" : `${o.days} días`}</span>`,
            String(o.lines),
          ]),
          [1, 2],
        ),
    );
    text.push(`PEDIDOS POR LLEGAR (${s.open_orders.length})`, ...s.open_orders.map((o) => `- ${o.supplier}: hace ${o.days} días, ${o.lines} líneas`), "");
  }

  const y = s.yesterday;
  sections.push(
    `<h2 style="font-size:16px;margin:0 0 4px">Salidas de ayer</h2>
<p style="margin:0 0 18px;font-size:14px">${
      y.issues === 0
        ? "No hubo salidas."
        : `${y.issues} ${y.issues === 1 ? "salida" : "salidas"} con ${y.lines} ${y.lines === 1 ? "producto" : "productos"}.` +
          (y.short.length ? `<br><span style="color:#b54708">Salieron sin existencia suficiente (revisar en el próximo conteo): ${y.short.map(esc).join(", ")}.</span>` : "")
    }</p>`,
  );
  text.push(`SALIDAS DE AYER: ${y.issues}`, "");

  const html = `<!doctype html><html><body style="margin:0;background:#f7f4f0;font-family:Inter,Arial,sans-serif;color:#2b2622">
<div style="max-width:640px;margin:0 auto;padding:24px 16px">
<p style="margin:0;color:#6b625a;font-size:13px">Ebony Manager · Almacén</p>
<h1 style="font-size:20px;margin:4px 0 18px">Resumen del ${esc(longDate(s.today))}</h1>
<div style="background:#ffffff;border:1px solid #e7e2dc;padding:18px 18px 4px">${sections.join("\n")}</div>
<p style="margin:18px 0 0"><a href="${appUrl}/almacen" style="background:#5b4636;color:#ffffff;padding:10px 16px;text-decoration:none;font-size:14px">Abrir el almacén</a></p>
<p style="margin:18px 0 0;color:#9b928a;font-size:12px">Lo reciben los admins y quien tiene el permiso de Compras.</p>
</div></body></html>`;

  text.push(`Abrir el almacén: ${appUrl}/almacen`);
  return { subject, html, text: text.join("\n"), hasContent };
}
