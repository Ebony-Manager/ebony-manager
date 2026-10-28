/** Texto comparable para todos los buscadores. Conserva ñ distinta de n. */
export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("es")
    .replace(/ñ/g, "\uE000")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\uE000/g, "ñ")
    .replace(/\s+/g, " ");
}

export function matchesSearch(value: string | null | undefined, query: string): boolean {
  return normalizeSearchText(value).includes(normalizeSearchText(query));
}
