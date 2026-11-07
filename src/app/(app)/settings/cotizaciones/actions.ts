"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/dal";
import { parseCompany, parseKinds, parsePayment, parseTerms, type CompanyInfo, type PaymentInfo, type QuoteTerms } from "@/lib/settings/documents";
import { saveDocumentSetting } from "@/services/settings";

type Result = { ok: true } | { ok: false; error: string };

const trimAll = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])) as T;

async function run(fn: () => Promise<void>): Promise<Result> {
  await requireAdmin();
  try {
    await fn();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
  revalidatePath("/settings/cotizaciones");
  return { ok: true };
}

export async function saveCompanyAction(input: CompanyInfo): Promise<Result> {
  const company = trimAll(parseCompany(input));
  if (!company.legalName) return { ok: false, error: "Falta la razón social." };
  return run(() => saveDocumentSetting("company", company));
}

export async function savePaymentAction(input: PaymentInfo): Promise<Result> {
  const payment = trimAll(parsePayment(input));
  if (!payment.bank || !payment.accountNumber || !payment.holder) return { ok: false, error: "Faltan los datos del banco." };
  return run(() => saveDocumentSetting("payment", payment));
}

export async function saveKindsAction(input: string[]): Promise<Result> {
  const kinds = parseKinds(input);
  if (!input.some((k) => k.trim())) return { ok: false, error: "Deja al menos un tipo." };
  return run(() => saveDocumentSetting("kinds", kinds));
}

export async function saveTermsAction(input: QuoteTerms): Promise<Result> {
  const parsed = parseTerms(input);
  const terms: QuoteTerms = {
    title: parsed.title.trim(),
    intro: parsed.intro.trim(),
    sections: parsed.sections.map((s) => ({ title: s.title.trim(), items: s.items })),
  };
  if (!terms.title) return { ok: false, error: "Falta el título." };
  if (terms.sections.some((s) => !s.title || s.items.length === 0)) return { ok: false, error: "Cada sección necesita título y al menos un punto." };
  return run(() => saveDocumentSetting("terms", terms));
}
