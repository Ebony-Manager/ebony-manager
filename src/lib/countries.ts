import type { Lang } from "@/lib/i18n";

/**
 * Países para el campo "Nacionalidad" (empleados y contratistas). Se guarda
 * el código ISO 3166-1 de dos letras (ej. "PA") y el nombre se muestra en el
 * idioma de la app con `Intl.DisplayNames`, así no hay que mantener la lista
 * de nombres a mano ni traducirla.
 */
export const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AL", "AM", "AO", "AR", "AT", "AU", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI",
  "BJ", "BN", "BO", "BR", "BS", "BT", "BW", "BY", "BZ", "CA", "CD", "CF", "CG", "CH", "CI", "CL", "CM", "CN", "CO",
  "CR", "CU", "CV", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG", "ER", "ES", "ET", "FI", "FJ",
  "FM", "FR", "GA", "GB", "GD", "GE", "GH", "GM", "GN", "GQ", "GR", "GT", "GW", "GY", "HN", "HR", "HT", "HU", "ID",
  "IE", "IL", "IN", "IQ", "IR", "IS", "IT", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW",
  "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MG", "MH", "MK",
  "ML", "MM", "MN", "MR", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NE", "NG", "NI", "NL", "NO", "NP", "NR",
  "NZ", "OM", "PA", "PE", "PG", "PH", "PK", "PL", "PR", "PS", "PT", "PW", "PY", "QA", "RO", "RS", "RU", "RW", "SA",
  "SB", "SC", "SD", "SE", "SG", "SI", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SY", "SZ", "TD", "TG",
  "TH", "TJ", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "US", "UY", "UZ", "VA", "VC", "VE",
  "VN", "VU", "WS", "XK", "YE", "ZA", "ZM", "ZW",
] as const;

/** Los países que más se usan en Ebony, arriba de la lista (en este orden). */
export const COMMON_COUNTRIES = ["PA", "CO", "VE", "NI", "EC", "DO", "CR", "CU"] as const;

const COUNTRY_SET = new Set<string>(COUNTRY_CODES);

export function isCountryCode(value: string | null | undefined): value is string {
  return !!value && COUNTRY_SET.has(value);
}

const displayNames: Partial<Record<Lang, Intl.DisplayNames>> = {};

/**
 * Nombre del país en el idioma de la app. Un valor que no es un código
 * (texto viejo escrito a mano) se muestra tal cual, para no perderlo.
 */
export function countryName(value: string | null | undefined, lang: Lang): string {
  if (!value) return "";
  if (!isCountryCode(value)) return value;
  displayNames[lang] ??= new Intl.DisplayNames([lang === "en" ? "en" : "es"], { type: "region" });
  return displayNames[lang]!.of(value) ?? value;
}

/** Opciones para el selector: los frecuentes primero y el resto por nombre. */
export function countryOptions(lang: Lang): { code: string; name: string; common: boolean }[] {
  const common = COMMON_COUNTRIES.map((code) => ({ code, name: countryName(code, lang), common: true }));
  const rest = COUNTRY_CODES.filter((c) => !(COMMON_COUNTRIES as readonly string[]).includes(c))
    .map((code) => ({ code, name: countryName(code, lang), common: false }))
    .sort((a, b) => a.name.localeCompare(b.name, lang, { sensitivity: "base" }));
  return [...common, ...rest];
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

let byName: Map<string, string> | null = null;

/**
 * Código del país a partir de su nombre en español o inglés ("Panama",
 * "Panamá", "Colombia" → "PA", "CO"), o del código mismo. null si no se
 * reconoce (ej. el campo "Country" del registro de JotForm).
 */
export function countryCodeFromName(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (isCountryCode(raw.toUpperCase())) return raw.toUpperCase();
  if (!byName) {
    byName = new Map();
    for (const lang of ["es", "en"] as const) {
      for (const code of COUNTRY_CODES) byName.set(fold(countryName(code, lang)), code);
    }
  }
  return byName.get(fold(raw)) ?? null;
}
