/** "Nabil Massiel Soriano" → nombre "Nabil Massiel", apellido "Soriano" (se puede corregir en el formulario). */
export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] ?? "", last: "" };
  const lastCount = parts.length >= 4 ? 2 : 1;
  return { first: parts.slice(0, -lastCount).join(" "), last: parts.slice(-lastCount).join(" ") };
}
