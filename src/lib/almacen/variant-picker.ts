// Menús de variante de la tienda de Salidas, como en el JotForm: una
// variante "40 cm · Cierre suave · Oculto" se elige con tres menús (tamaño,
// apertura, colocación). Cada menú solo ofrece lo que existe con lo ya elegido
// en los anteriores, así nunca se arma una combinación que no está en el catálogo.

export interface PickableVariant {
  id: string;
  label: string;
}

const SEP = " · ";

/** Cuántos menús: 0 si es variante única, 1 si las etiquetas no se pueden partir parejo. */
export function dimensionCount(variants: readonly PickableVariant[]): number {
  if (variants.length === 0 || (variants.length === 1 && !variants[0].label)) return 0;
  const counts = new Set(variants.map((v) => (v.label ? v.label.split(SEP).length : 0)));
  if (counts.size !== 1 || counts.has(0)) return 1;
  return [...counts][0];
}

function parts(v: PickableVariant, dims: number): string[] {
  return dims <= 1 ? [v.label] : v.label.split(SEP);
}

/** Opciones del menú `k` según lo elegido en los menús anteriores (en el orden del catálogo). */
export function optionsAt(variants: readonly PickableVariant[], k: number, selection: readonly string[]): string[] {
  const dims = dimensionCount(variants);
  const out: string[] = [];
  for (const v of variants) {
    const p = parts(v, dims);
    if (p.slice(0, k).every((x, i) => x === selection[i]) && !out.includes(p[k])) out.push(p[k]);
  }
  return out;
}

/** Al cambiar el menú `k`, los siguientes se acomodan a una combinación que exista. */
export function reconcile(variants: readonly PickableVariant[], selection: readonly string[]): string[] {
  const dims = dimensionCount(variants);
  const next: string[] = [];
  for (let k = 0; k < dims; k++) {
    const opts = optionsAt(variants, k, next);
    next.push(opts.includes(selection[k]) ? selection[k] : opts[0]);
  }
  return next;
}

/** La variante elegida, o null si no hay (no debería pasar después de reconcile). */
export function resolveVariant(variants: readonly PickableVariant[], selection: readonly string[]): PickableVariant | null {
  const dims = dimensionCount(variants);
  if (dims === 0) return variants[0] ?? null;
  return variants.find((v) => parts(v, dims).every((x, i) => x === selection[i])) ?? null;
}

/** La selección que corresponde a una variante (para empezar en la primera). */
export function selectionOf(variants: readonly PickableVariant[], variant: PickableVariant | undefined): string[] {
  const dims = dimensionCount(variants);
  return variant && dims > 0 ? parts(variant, dims) : [];
}
