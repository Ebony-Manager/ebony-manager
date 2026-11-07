import "server-only";

import { after } from "next/server";

import { alegraReady, invoiceQuoteInAlegra } from "@/services/alegra";

/**
 * Después de responder (no demora la aprobación): crea en Alegra el borrador
 * de cada cotización recién aprobada. Si Alegra todavía no está configurado,
 * no hace nada (se puede crear después desde la cotización).
 */
export function invoiceInAlegraAfterApproval(quoteIds: readonly string[]) {
  const ids = [...new Set(quoteIds.filter(Boolean))];
  if (ids.length === 0) return;
  after(async () => {
    if (!(await alegraReady())) return;
    for (const id of ids) await invoiceQuoteInAlegra(id).catch((err) => console.error("Alegra", id, err));
  });
}
