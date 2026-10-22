import type { ContractorLedgerEntry } from "@/types/contractors";

/**
 * Retención de garantía (pintores): lo retenido de cada trabajo es un
 * movimiento `retencion` que baja el saldo; su devolución, uno `retencion`
 * a favor. Ambos llevan el proyecto. Por proyecto:
 *   por devolver = Σ retenido − Σ devuelto.
 */
export interface RetentionByProject {
  /** null = trabajos sin proyecto. */
  projectId: string | null;
  projectName: string | null;
  heldCents: number;
  releasedCents: number;
  pendingCents: number;
}

export function retentionByProject(
  entries: Pick<ContractorLedgerEntry, "category" | "direction" | "amountCents" | "projectId" | "projectName">[]
): RetentionByProject[] {
  const map = new Map<string, RetentionByProject>();
  for (const e of entries) {
    if (e.category !== "retencion") continue;
    const key = e.projectId ?? "";
    const cur = map.get(key) ?? {
      projectId: e.projectId,
      projectName: e.projectName,
      heldCents: 0,
      releasedCents: 0,
      pendingCents: 0,
    };
    if (e.direction === "reduce") cur.heldCents += e.amountCents;
    else cur.releasedCents += e.amountCents;
    cur.pendingCents = cur.heldCents - cur.releasedCents;
    cur.projectName ??= e.projectName;
    map.set(key, cur);
  }
  return [...map.values()].sort(
    (a, b) => b.pendingCents - a.pendingCents || (a.projectName ?? "").localeCompare(b.projectName ?? "")
  );
}

/** Total por devolver (solo lo positivo de cada proyecto). */
export function retentionPendingCents(rows: RetentionByProject[]): number {
  return rows.reduce((s, r) => s + Math.max(0, r.pendingCents), 0);
}
