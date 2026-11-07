import "server-only";

import {
  alegraConfigured,
  createInvoice,
  findOrCreateContact,
} from "@/lib/alegra/api";
import {
  alegraExpectedTotal,
  buildAlegraInvoice,
  type AlegraConfig,
} from "@/lib/alegra/invoice";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { quoteTotals } from "@/lib/cotizador/pricing";
import { errText, recordRun } from "@/lib/integrations/record";
import { SETTING_KEYS } from "@/lib/settings/documents";
import { createClient } from "@/lib/supabase/server";
import { getQuote } from "@/services/cotizador";
import type { QuoteAlegra } from "@/types/cotizador";

/** Lo elegido en Settings → Conexiones (producto/servicio e impuesto de Alegra), o null. */
export async function getAlegraConfig(): Promise<AlegraConfig | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SETTING_KEYS.alegra)
    .maybeSingle();
  const v = (data?.value ?? null) as Partial<AlegraConfig> | null;
  if (!v || typeof v.itemId !== "string" || !v.itemId) return null;
  return {
    itemId: v.itemId,
    itemName: typeof v.itemName === "string" ? v.itemName : undefined,
    taxId: typeof v.taxId === "string" && v.taxId ? v.taxId : null,
    taxName: typeof v.taxName === "string" ? v.taxName : undefined,
    taxPct: typeof v.taxPct === "number" ? v.taxPct : null,
  };
}

export async function getQuoteAlegra(
  quoteId: string,
): Promise<QuoteAlegra | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_alegra")
    .select("status, invoice_id, invoice_number, error, updated_at")
    .eq("quote_id", quoteId)
    .maybeSingle();
  // Sin la tabla (migración pendiente): como si no hubiera nada.
  if (error || !data) return null;
  return {
    status:
      data.status === "creada" || data.status === "creando"
        ? data.status
        : "error",
    invoiceId: data.invoice_id,
    invoiceNumber: data.invoice_number,
    error: data.error,
    updatedAt: data.updated_at,
  };
}

/** ¿Está todo listo para crear facturas? (credenciales en Vercel y lo elegido en Settings). */
export async function alegraReady(): Promise<boolean> {
  return alegraConfigured() && (await getAlegraConfig()) !== null;
}

/**
 * Crea en Alegra la factura (borrador) de una cotización aprobada. Nunca dos:
 * si ya tiene una creada, la devuelve; si otra petición la está creando
 * ahora mismo, no hace nada. Si algo falla queda en "error" con el motivo
 * (en la cotización y en Settings → Conexiones) para reintentar.
 */
export async function invoiceQuoteInAlegra(
  quoteId: string,
): Promise<QuoteAlegra> {
  const supabase = await createClient();
  const current = await getQuoteAlegra(quoteId);
  if (current?.status === "creada") return current;
  if (
    current?.status === "creando" &&
    Date.now() - Date.parse(current.updatedAt) < 2 * 60_000
  )
    return current;

  // Toma la cotización (la fila evita que dos peticiones creen dos facturas).
  const claim = current
    ? await supabase
        .from("quote_alegra")
        .update({
          status: "creando",
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("quote_id", quoteId)
        .eq("updated_at", current.updatedAt)
        .select("quote_id")
    : await supabase
        .from("quote_alegra")
        .insert({ quote_id: quoteId, status: "creando" })
        .select("quote_id");
  if (claim.error || !claim.data?.length)
    return (
      (await getQuoteAlegra(quoteId)) ?? {
        status: "creando",
        invoiceId: null,
        invoiceNumber: null,
        error: null,
        updatedAt: new Date().toISOString(),
      }
    );

  const fail = async (msg: string): Promise<QuoteAlegra> => {
    await supabase
      .from("quote_alegra")
      .update({
        status: "error",
        error: msg.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("quote_id", quoteId);
    await recordRun(supabase, null, "alegra", false, msg);
    return (await getQuoteAlegra(quoteId))!;
  };

  try {
    if (!alegraConfigured())
      return await fail("Faltan ALEGRA_EMAIL y ALEGRA_TOKEN en Vercel.");
    const config = await getAlegraConfig();
    if (!config)
      return await fail(
        "Falta elegir el producto/servicio de Alegra en Settings → Conexiones.",
      );
    const quote = await getQuote(quoteId);
    if (!quote) return await fail("La cotización no existe.");
    if (quote.status !== "APROBADA")
      return await fail("Solo se factura una cotización aprobada.");

    // A nombre del cliente amarrado a la cotización (o, si no hay, de la diseñadora).
    const billedId = quote.clientId ?? quote.designerId;
    if (!billedId)
      return await fail("La cotización no tiene cliente amarrado.");
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name, email, phone, alegra_contact_id")
      .eq("id", billedId)
      .single();
    if (clientError || !client)
      return await fail("No se encontró el cliente de la cotización.");
    let contactId = client.alegra_contact_id;
    if (!contactId) {
      contactId = await findOrCreateContact({
        name: client.name,
        email: client.email,
        phone: client.phone,
      });
      await supabase
        .from("clients")
        .update({ alegra_contact_id: contactId })
        .eq("id", client.id);
    }

    const body = buildAlegraInvoice(quote, config, contactId, todayInPanama());
    const inv = await createInvoice(body);
    const ours = Math.round(quoteTotals(quote).total * 100) / 100;
    const theirs = inv.total ?? alegraExpectedTotal(body, quote.itbmsPct);
    const note =
      Math.abs(theirs - ours) >= 0.02
        ? `Total en Alegra $${theirs.toFixed(2)} vs. cotización $${ours.toFixed(2)} (redondeo): revísalo.`
        : null;
    await supabase
      .from("quote_alegra")
      .update({
        status: "creada",
        invoice_id: inv.id,
        invoice_number: inv.number,
        error: note,
        updated_at: new Date().toISOString(),
      })
      .eq("quote_id", quoteId);
    await recordRun(
      supabase,
      null,
      "alegra",
      true,
      `${quote.number}: borrador ${inv.number ?? inv.id}`,
    );
    return (await getQuoteAlegra(quoteId))!;
  } catch (err) {
    return fail(errText(err));
  }
}
