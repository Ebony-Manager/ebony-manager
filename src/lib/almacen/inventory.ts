// Reglas puras del Almacén (sin Supabase ni React): estado de existencia,
// nombres, cantidades y el mensaje de pedido para WhatsApp.

import type { InventoryUnit, InventoryVariant } from "@/types/almacen";

export type StockStatus = "sin" | "bajo" | "ok";

/** Sin existencia (0 o negativa), bajo el mínimo (o en él) o bien. */
export function stockStatus(v: Pick<InventoryVariant, "stockQty" | "minQty">): StockStatus {
  if (v.stockQty <= 0) return "sin";
  if (v.minQty != null && v.minQty > 0 && v.stockQty <= v.minQty) return "bajo";
  return "ok";
}

/** "Riel de gaveta · 40 cm · Oculto"; la variante única muestra solo el producto. */
export function variantName(itemName: string, label: string): string {
  return label ? `${itemName} · ${label}` : itemName;
}

/** Cuánto pedir para volver a "pedir hasta" (o al doble del mínimo si no hay). */
export function suggestedOrderQty(v: Pick<InventoryVariant, "stockQty" | "minQty" | "reorderQty">, allowsDecimals: boolean): number {
  const target = v.reorderQty ?? (v.minQty != null ? v.minQty * 2 : 0);
  const need = target - Math.max(v.stockQty, 0);
  if (need <= 0) return allowsDecimals ? 0.01 : 1;
  return allowsDecimals ? Math.round(need * 100) / 100 : Math.ceil(need);
}

/** 1234.5 → "1,234.5" con hasta 2 decimales. */
export function formatQty(n: number, lang: "es" | "en" = "es"): string {
  return new Intl.NumberFormat(lang === "es" ? "es-PA" : "en-US", { maximumFractionDigits: 2 }).format(n);
}

/** Costo por unidad en centavos → "$2.50"; los de menos de un dólar con hasta 4 decimales ("$0.015"). */
export function formatUnitCost(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: dollars < 1 ? 4 : 2 })}`;
}

/** Lee una cantidad escrita a mano ("12", "12.5", "12,5"). null si no es un número válido. */
export function parseQty(text: string): number | null {
  const clean = text.trim().replace(",", ".");
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

const UNIT_LABELS: Record<InventoryUnit, { es: [string, string]; en: [string, string] }> = {
  unidad: { es: ["unidad", "unidades"], en: ["unit", "units"] },
  metro: { es: ["metro", "metros"], en: ["meter", "meters"] },
  caja: { es: ["caja", "cajas"], en: ["box", "boxes"] },
  galon: { es: ["galón", "galones"], en: ["gallon", "gallons"] },
  botella: { es: ["botella", "botellas"], en: ["bottle", "bottles"] },
  lamina: { es: ["lámina", "láminas"], en: ["sheet", "sheets"] },
  rollo: { es: ["rollo", "rollos"], en: ["roll", "rolls"] },
  par: { es: ["par", "pares"], en: ["pair", "pairs"] },
  juego: { es: ["juego", "juegos"], en: ["set", "sets"] },
  kilo: { es: ["kilo", "kilos"], en: ["kilo", "kilos"] },
  pliego: { es: ["pliego", "pliegos"], en: ["sheet", "sheets"] },
  bolsa: { es: ["bolsa", "bolsas"], en: ["bag", "bags"] },
};

export function unitLabel(unit: string | null | undefined, qty: number, lang: "es" | "en" = "es"): string {
  const entry = UNIT_LABELS[(unit ?? "unidad") as InventoryUnit];
  if (!entry) return unit ?? "";
  const [one, many] = entry[lang];
  return qty === 1 ? one : many;
}

/** Número de WhatsApp en formato wa.me (solo dígitos; 8 dígitos = Panamá, se le pone 507). */
export function whatsappNumber(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.length <= 8 ? `507${digits}` : digits;
}

/**
 * Teléfono en un solo formato: los de Panamá como "+507 6000-0000" (con o sin
 * 507 delante); los de otro país (+86, +57…) se dejan como vienen, sin
 * caracteres invisibles. Igual que private.format_phone_pa en la base.
 */
export function formatPhonePA(raw: string | null | undefined): string | null {
  const v = (raw ?? "").replace(/[\u202a\u202c\u200e\u200f]/g, "").trim();
  if (!v) return null;
  const digits = v.replace(/\D/g, "");
  const local = /^\d{8}$/.test(digits) ? digits : /^507\d{8}$/.test(digits) ? digits.slice(3) : null;
  return local ? `+507 ${local.slice(0, 4)}-${local.slice(4)}` : v;
}

/** Abre el chat del proveedor con el mensaje ya escrito (solo falta tocar Enviar). */
export function whatsappUrl(raw: string | null | undefined, text: string): string | null {
  const number = whatsappNumber(raw);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}

/**
 * Ubicación del proveedor → enlace para abrir Google Maps: si ya es un enlace
 * (lo normal: "Compartir → Copiar enlace" en Maps) se usa tal cual; si es
 * una dirección escrita, se busca en Maps. Vacío = null.
 */
export function mapsUrl(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`;
}

export interface OrderMessageLine {
  name: string;
  qty: number;
  unit: string | null;
}

/** El mensaje del pedido para el proveedor: va siempre en español (proveedores de Panamá). */
export function orderMessage(contactName: string | null, lines: OrderMessageLine[], notes?: string | null): string {
  const hello = contactName?.trim() ? `Hola ${contactName.trim()}, buen día.` : "Hola, buen día.";
  const items = lines.map((l) => `• ${formatQty(l.qty)} ${unitLabel(l.unit, l.qty)} — ${l.name}`);
  const parts = [hello, "Les escribimos de Ebony Custom Woodwork para hacer el siguiente pedido:", "", ...items];
  if (notes?.trim()) parts.push("", notes.trim());
  parts.push("", "Por favor confírmennos disponibilidad, precio y tiempo de entrega. ¡Gracias!");
  return parts.join("\n");
}
