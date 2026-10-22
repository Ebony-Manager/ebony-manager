import { describe, expect, it } from "vitest";

import { retentionByProject, retentionPendingCents } from "@/lib/contractors/retention";

const e = (
  over: Partial<{ category: "retencion" | "trabajo"; direction: "a_favor" | "reduce"; amountCents: number; projectId: string | null; projectName: string | null }>
) => ({
  category: over.category ?? ("retencion" as const),
  direction: over.direction ?? ("reduce" as const),
  amountCents: over.amountCents ?? 0,
  projectId: over.projectId ?? null,
  projectName: over.projectName ?? null,
});

describe("retentionByProject", () => {
  it("suma lo retenido y resta lo devuelto por proyecto", () => {
    const rows = retentionByProject([
      e({ amountCents: 1000, projectId: "p1", projectName: "Francesca" }),
      e({ amountCents: 500, projectId: "p1", projectName: "Francesca" }),
      e({ direction: "a_favor", amountCents: 1500, projectId: "p1", projectName: "Francesca" }),
      e({ amountCents: 300, projectId: "p2", projectName: "Bloque 3" }),
      e({ category: "trabajo", direction: "a_favor", amountCents: 9999, projectId: "p2" }),
    ]);
    expect(rows).toEqual([
      { projectId: "p2", projectName: "Bloque 3", heldCents: 300, releasedCents: 0, pendingCents: 300 },
      { projectId: "p1", projectName: "Francesca", heldCents: 1500, releasedCents: 1500, pendingCents: 0 },
    ]);
    expect(retentionPendingCents(rows)).toBe(300);
  });

  it("agrupa lo que no tiene proyecto", () => {
    const rows = retentionByProject([e({ amountCents: 200 }), e({ amountCents: 100 })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ projectId: null, pendingCents: 300 });
  });
});
