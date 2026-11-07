import { TERMS, TERMS_INTRO, TERMS_TITLE, type TermsSection } from "@/lib/cotizador/terms";

/**
 * Lo que sale en los documentos para el cliente (cotización y su PDF) y se
 * edita en Settings → Cotizaciones: datos de la empresa, datos para el pago y
 * Condiciones Generales. Se guarda en `app_settings` (una fila por clave); si
 * una clave no está, se usan estos valores (los de siempre).
 */

export interface QuoteTerms {
  title: string;
  intro: string;
  sections: TermsSection[];
}

export interface CompanyInfo {
  legalName: string;
  ruc: string;
  phone: string;
  email: string;
  address: string;
}

export type AccountType = "corriente" | "ahorros";

export interface PaymentInfo {
  bank: string;
  accountType: AccountType;
  accountNumber: string;
  holder: string;
  /** La línea de forma de pago, en español y en inglés (según el idioma de la cotización). */
  termsEs: string;
  termsEn: string;
}

export interface DocumentSettings {
  terms: QuoteTerms;
  company: CompanyInfo;
  payment: PaymentInfo;
}

export const SETTING_KEYS = { terms: "quote_terms", company: "company", payment: "payment" } as const;

export const DEFAULT_TERMS: QuoteTerms = { title: TERMS_TITLE, intro: TERMS_INTRO, sections: TERMS };

export const DEFAULT_COMPANY: CompanyInfo = {
  legalName: "EBONY DESIGNS, S.A.",
  ruc: "RUC 155678857-2-2019 DV: 0",
  phone: "6329-6666",
  email: "ventas@ebonypanama.com",
  address: "Ave 1A Sur - San Francisco",
};

export const DEFAULT_PAYMENT: PaymentInfo = {
  bank: "Banco General",
  accountType: "corriente",
  accountNumber: "03-70-01-127629-2",
  holder: "Ebony Designs SA",
  termsEs: "Pago: 50% al aceptar la cotización, 40% previo a la entrada a sitio y 10% al finalizar la instalación.",
  termsEn: "Payment: 50% upon accepting the quote, 40% before site entry and 10% upon completing installation.",
};

export const DEFAULT_DOCUMENTS: DocumentSettings = { terms: DEFAULT_TERMS, company: DEFAULT_COMPANY, payment: DEFAULT_PAYMENT };

const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);

/** Lee lo guardado con cuidado: lo que falte o venga mal toma el valor de siempre. */
export function parseTerms(v: unknown): QuoteTerms {
  const o = (v ?? {}) as Partial<QuoteTerms>;
  if (!Array.isArray(o.sections)) return DEFAULT_TERMS;
  return {
    title: str(o.title, DEFAULT_TERMS.title),
    intro: str(o.intro, DEFAULT_TERMS.intro),
    sections: o.sections
      .filter((s): s is TermsSection => !!s && typeof s === "object" && Array.isArray((s as TermsSection).items))
      .map((s) => ({
        title: str(s.title, ""),
        items: s.items
          .map((it) =>
            typeof it === "string"
              ? it
              : it && typeof it === "object" && typeof it.text === "string"
                ? { text: it.text, sub: Array.isArray(it.sub) ? it.sub.filter((x): x is string => typeof x === "string") : [] }
                : null
          )
          .filter((it): it is TermsSection["items"][number] => it !== null),
      })),
  };
}

export function parseCompany(v: unknown): CompanyInfo {
  const o = (v ?? {}) as Partial<CompanyInfo>;
  return {
    legalName: str(o.legalName, DEFAULT_COMPANY.legalName),
    ruc: str(o.ruc, DEFAULT_COMPANY.ruc),
    phone: str(o.phone, DEFAULT_COMPANY.phone),
    email: str(o.email, DEFAULT_COMPANY.email),
    address: str(o.address, DEFAULT_COMPANY.address),
  };
}

export function parsePayment(v: unknown): PaymentInfo {
  const o = (v ?? {}) as Partial<PaymentInfo>;
  return {
    bank: str(o.bank, DEFAULT_PAYMENT.bank),
    accountType: o.accountType === "ahorros" ? "ahorros" : o.accountType === "corriente" ? "corriente" : DEFAULT_PAYMENT.accountType,
    accountNumber: str(o.accountNumber, DEFAULT_PAYMENT.accountNumber),
    holder: str(o.holder, DEFAULT_PAYMENT.holder),
    termsEs: str(o.termsEs, DEFAULT_PAYMENT.termsEs),
    termsEn: str(o.termsEn, DEFAULT_PAYMENT.termsEn),
  };
}

/** Para editar: los puntos en una sola lista; `sub` = sub-punto del punto anterior. */
export interface PointRow {
  text: string;
  sub: boolean;
}

export function flattenItems(items: TermsSection["items"]): PointRow[] {
  return items.flatMap((it) =>
    typeof it === "string" ? [{ text: it, sub: false }] : [{ text: it.text, sub: false }, ...it.sub.map((text) => ({ text, sub: true }))]
  );
}

/** Al revés; los vacíos se descartan y un sub-punto sin punto arriba queda como punto. */
export function unflattenItems(rows: readonly PointRow[]): TermsSection["items"] {
  const out: TermsSection["items"] = [];
  for (const row of rows) {
    const text = row.text.trim();
    if (!text) continue;
    if (row.sub && out.length) {
      const last = out[out.length - 1];
      out[out.length - 1] = typeof last === "string" ? { text: last, sub: [text] } : { ...last, sub: [...last.sub, text] };
    } else out.push(text);
  }
  return out;
}
