// Lectura del catálogo de productos del JotForm "Egreso de Suministros"
// (propiedad `products` del formulario, que a veces llega como texto JSON).

export const EGRESOS_FORM_ID = "221884899655074";

export type Product = Record<string, unknown>;

export function toProducts(raw: unknown): Product[] {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) return value as Product[];
  if (value && typeof value === "object") return Object.values(value as Record<string, Product>);
  return [];
}

export function images(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [raw];
    } catch {
      return raw ? [raw] : [];
    }
  }
  return [];
}

