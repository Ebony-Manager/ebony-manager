import { groupedOrder } from "@/lib/cotizador/items";
import {
  quoteTotals,
  sectionLabel,
  sectionTotals,
} from "@/lib/cotizador/pricing";
import type { Quote } from "@/types/cotizador";

/**
 * La factura de venta de Alegra para una cotización aprobada (POST
 * /api/v1/invoices, https://developer.alegra.com/reference/post_invoices).
 * Pura: recibe la cotización y lo elegido en Settings, devuelve el cuerpo.
 *
 * - En BORRADOR (`status: "draft"`) y sin `stamp`: no se emite factura
 *   electrónica; alguien la revisa en Alegra.
 * - Una línea por ítem, en el orden de la cotización, todas con el mismo
 *   producto/servicio de Alegra; el nombre del ítem va en la descripción.
 * - Precio por unidad SIN impuesto ni descuento (así lo pide Alegra),
 *   cantidad del ítem, el descuento (el del ítem y el general, combinados) como % en cada línea y
 *   el ITBMS como impuesto de Alegra.
 */

export interface AlegraConfig {
  /** Producto/servicio de Alegra para todas las líneas. */
  itemId: string;
  itemName?: string;
  /** Impuesto de Alegra para el ITBMS (null = la cotización va sin impuesto). */
  taxId: string | null;
  taxName?: string;
  /** Tasa del impuesto elegido (para comprobar que coincide con la cotización). */
  taxPct: number | null;
}

export interface AlegraInvoiceItem {
  id: string;
  description: string;
  price: number;
  quantity: number;
  discount?: number;
  tax?: { id: string }[];
}

export interface AlegraInvoiceBody {
  date: string;
  dueDate: string;
  client: string;
  status: "draft";
  items: AlegraInvoiceItem[];
  observations: string;
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/** El descuento global de la cotización como % por línea (Alegra no tiene descuento global). */
export function discountPct(
  q: Pick<Quote, "sections" | "discountType" | "discountValue" | "itbmsPct" | "commissionPct" | "ccfPct">,
): number {
  if (!q.discountValue) return 0;
  if (q.discountType === "pct") return round(q.discountValue, 4);
  const { subtotal, discount } = quoteTotals(q);
  return subtotal > 0 ? round((discount / subtotal) * 100, 4) : 0;
}

export function buildAlegraInvoice(
  q: Pick<
    Quote,
    | "number"
    | "projectName"
    | "sections"
    | "discountType"
    | "discountValue"
    | "itbmsPct"
    | "commissionPct"
    | "ccfPct"
  >,
  config: AlegraConfig,
  contactId: string,
  today: string,
): AlegraInvoiceBody {
  if (q.itbmsPct > 0 && !config.taxId)
    throw new Error(
      "Falta elegir el impuesto de ITBMS de Alegra en Settings → Conexiones.",
    );
  if (
    q.itbmsPct > 0 &&
    config.taxPct !== null &&
    Math.abs(config.taxPct - q.itbmsPct) > 0.001
  ) {
    throw new Error(
      `El ITBMS de la cotización (${q.itbmsPct}%) no coincide con el impuesto elegido en Alegra (${config.taxPct}%).`,
    );
  }
  const sections = groupedOrder(q.sections).filter(
    (s) => sectionTotals(s, q).total > 0,
  );
  if (sections.length === 0)
    throw new Error("La cotización no tiene ítems con precio.");
  const general = discountPct(q);
  return {
    date: today,
    dueDate: today,
    client: contactId,
    status: "draft",
    observations: [q.number, q.projectName].filter(Boolean).join(" · "),
    items: sections.map((s) => {
      const st = sectionTotals(s, q);
      // Alegra tiene un solo % de descuento por línea: el del ítem y el general, combinados.
      const itemShare = st.gross > 0 ? st.total / st.gross : 1;
      const discount = round((1 - itemShare * (1 - general / 100)) * 100, 4);
      const title = [s.kind, sectionLabel(s)].filter(Boolean).join(" · ");
      return {
        id: config.itemId,
        description: [title, s.description.trim()].filter(Boolean).join("\n"),
        price: round(st.unit, 2),
        quantity: st.qty,
        ...(discount > 0 ? { discount } : {}),
        ...(q.itbmsPct > 0 && config.taxId
          ? { tax: [{ id: config.taxId }] }
          : {}),
      };
    }),
  };
}

/** Lo que daría Alegra con esas líneas (para avisar si no cuadra con la cotización por redondeos). */
export function alegraExpectedTotal(
  body: AlegraInvoiceBody,
  itbmsPct: number,
): number {
  const net = body.items.reduce(
    (s, it) => s + it.price * it.quantity * (1 - (it.discount ?? 0) / 100),
    0,
  );
  return round(
    net * (1 + (body.items.some((i) => i.tax) ? itbmsPct : 0) / 100),
    2,
  );
}

/** Enlace a la factura en Alegra. */
export const alegraInvoiceUrl = (id: string) =>
  `https://app.alegra.com/invoice/view/id/${encodeURIComponent(id)}`;
