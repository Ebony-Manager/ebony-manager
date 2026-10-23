// Lectura de los envíos del JotForm "Egreso de Suministros" para sacar el
// consumo real por producto y variante antes de migrar al Almacén.

export type EgresoLine = { product: string; variant: string; quantity: number };

type Answer = { text?: string; type?: string; answer?: unknown; prettyFormat?: string };

const QTY_KEY = /^(quantity|cantidad)$/i;
const SKIP_KEY = /^(amount|price|precio|monto)$/i;

/** "Riel de Gaveta (Amount: 0.00 USD, Quantity: 2, Tamaño: 30cm, Apertura: Push)" → producto, variante, cantidad. */
export function parseProductLine(raw: string): EgresoLine {
  const text = raw.replace(/<[^>]+>/g, "").trim();
  const m = /^(.*) \((.*)\)$/.exec(text);
  if (!m || !m[2].includes(":")) return { product: text, variant: "", quantity: 1 };
  let quantity = 1;
  const variant: string[] = [];
  for (const part of m[2].split(/,\s*(?=[^,:]*:)/)) {
    const i = part.indexOf(":");
    const key = (i < 0 ? "" : part.slice(0, i)).trim();
    const value = (i < 0 ? part : part.slice(i + 1)).trim();
    if (QTY_KEY.test(key)) quantity = Number(value.replace(",", ".")) || 0;
    else if (!SKIP_KEY.test(key) && value) variant.push(key ? `${key}: ${value}` : value);
  }
  return { product: m[1].trim(), variant: variant.join(" · "), quantity };
}

/** Las líneas de producto de la respuesta de una lista de productos de JotForm. */
export function productLines(answer: Answer): string[] {
  const a = answer.answer as Record<string, unknown> | undefined;
  if (a && typeof a.paymentArray === "string") {
    try {
      const parsed = JSON.parse(a.paymentArray) as { product?: unknown };
      if (Array.isArray(parsed.product)) return parsed.product.map(String);
    } catch {}
  }
  return (answer.prettyFormat ?? "")
    .split(/<br\s*\/?>|\n/i)
    .map((s) => s.trim())
    .filter((s) => s && !/^total\b/i.test(s));
}

/** Texto plano de cualquier respuesta; las fechas de JotForm quedan como AAAA-MM-DD. */
export function answerText(answer: Answer | undefined): string {
  if (!answer) return "";
  const a = answer.answer;
  if (a && typeof a === "object" && "year" in a && "month" in a && "day" in a) {
    const d = a as Record<string, string>;
    return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
  }
  if (typeof answer.prettyFormat === "string" && answer.prettyFormat) return answer.prettyFormat.replace(/<[^>]+>/g, " ").trim();
  if (typeof a === "string") return a;
  if (Array.isArray(a)) return a.join(", ");
  return a == null ? "" : JSON.stringify(a);
}

export function isProductAnswer(answer: Answer): boolean {
  const a = answer.answer;
  return (!!a && typeof a === "object" && "paymentArray" in a) || /payment|product/i.test(answer.type ?? "");
}
