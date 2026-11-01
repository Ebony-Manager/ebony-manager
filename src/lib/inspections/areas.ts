// Áreas de inspección: nombres limpios y "¿quisiste decir…?" para no crear
// la misma área con otro nombre ("Recamara principal" vs "Recámara principal").

/** Nombre limpio: sin espacios de más (respeta mayúsculas y acentos). */
export const cleanAreaName = (s: string) => s.replace(/\s+/g, " ").trim();

/** Para comparar: minúsculas, sin acentos ni signos, y abreviaturas comunes escritas completas. */
export function foldArea(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\brec\b/g, "recamara")
    .replace(/\bhab\b/g, "habitacion")
    .replace(/\s+/g, " ")
    .trim();
}

function distance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** El área que ya existe con el mismo nombre (sin importar mayúsculas, acentos ni signos), o null. */
export function sameArea(name: string, areas: readonly string[]): string | null {
  const f = foldArea(name);
  return f ? (areas.find((a) => foldArea(a) === f) ?? null) : null;
}

/**
 * Áreas existentes parecidas a lo escrito: una contiene a la otra o se
 * diferencian en pocas letras. Para sugerir usar la existente antes de crear otra.
 */
export function similarAreas(name: string, areas: readonly string[], max = 3): string[] {
  const f = foldArea(name);
  if (f.length < 3) return [];
  return areas
    .map((a) => ({ a, g: foldArea(a) }))
    .filter(({ g }) => g !== f && (g.includes(f) || f.includes(g) || distance(f, g) <= Math.max(1, Math.floor(Math.min(f.length, g.length) / 6))))
    .slice(0, max)
    .map(({ a }) => a);
}
