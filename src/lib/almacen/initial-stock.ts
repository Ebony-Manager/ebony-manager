/** Blank means untouched; explicit zero is a physical count of zero. */
export function initialStockLines(values: Record<string, string>) {
  return Object.entries(values).filter(([, value]) => value.trim() !== "").map(([variantId, value]) => {
    const qty = Number(value.trim().replace(",", "."));
    if (!/^\d+(?:[.,]\d+)?$/.test(value.trim()) || !Number.isFinite(qty) || qty < 0) {
      throw new Error("Revisa las existencias iniciales: usa cantidades de cero o mayores.");
    }
    return { variantId, qty };
  });
}
