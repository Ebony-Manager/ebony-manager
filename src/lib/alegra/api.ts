import "server-only";

/**
 * Cliente mínimo de la API de Alegra (https://developer.alegra.com).
 * Autenticación Basic con el correo y el token de un usuario de Alegra
 * (Configuración → API – Integraciones con otros sistemas), guardados en
 * Vercel como ALEGRA_EMAIL y ALEGRA_TOKEN. Límite: 150 consultas por minuto.
 * Los IDs llegan como texto (Alegra está pasando a UUID): siempre string.
 */

const BASE = "https://api.alegra.com/api/v1";

export function alegraConfigured(): boolean {
  return (
    !!process.env.ALEGRA_EMAIL?.trim() && !!process.env.ALEGRA_TOKEN?.trim()
  );
}

function authHeader(): string {
  const email = process.env.ALEGRA_EMAIL?.trim();
  const token = process.env.ALEGRA_TOKEN?.trim();
  if (!email || !token)
    throw new Error(
      "Alegra no está conectado: faltan ALEGRA_EMAIL y ALEGRA_TOKEN en Vercel.",
    );
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

export async function alegraFetch<T>(
  path: string,
  init: {
    method?: "GET" | "POST";
    body?: unknown;
    query?: Record<string, string | number>;
  } = {},
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(init.query ?? {}))
    url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const b = body as { message?: string; error?: { message?: string } } | null;
    const msg = b?.message ?? b?.error?.message;
    throw new Error(`Alegra ${res.status}${msg ? `: ${msg}` : ""}`);
  }
  return body as T;
}

export interface AlegraOption {
  id: string;
  name: string;
  /** Impuestos: la tasa. */
  percentage?: number | null;
}

/** Productos/servicios activos (para elegir cuál va en las líneas). */
export async function listItems(): Promise<AlegraOption[]> {
  const out: AlegraOption[] = [];
  for (let start = 0; start < 600; start += 30) {
    const page = await alegraFetch<
      { id: string | number; name: string; status?: string }[]
    >("/items", { query: { start, limit: 30 } });
    out.push(
      ...page
        .filter((i) => i.status !== "inactive")
        .map((i) => ({ id: String(i.id), name: i.name })),
    );
    if (page.length < 30) break;
  }
  return out;
}

export async function listTaxes(): Promise<AlegraOption[]> {
  const taxes = await alegraFetch<
    {
      id: string | number;
      name: string;
      percentage?: string | number;
      status?: string;
    }[]
  >("/taxes", { query: { limit: 30 } });
  return taxes
    .filter((t) => t.status !== "inactive")
    .map((t) => ({
      id: String(t.id),
      name: t.name,
      percentage:
        t.percentage === undefined || t.percentage === null
          ? null
          : Number(t.percentage),
    }));
}

/** El contacto (cliente) de Alegra con ese nombre exacto, o uno nuevo. */
export async function findOrCreateContact(c: {
  name: string;
  email: string | null;
  phone: string | null;
}): Promise<string> {
  const name = c.name.trim();
  const found = await alegraFetch<{ id: string | number; name: string }[]>(
    "/contacts",
    { query: { name, limit: 30 } },
  );
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  const match = found.find((x) => norm(x.name) === norm(name));
  if (match) return String(match.id);
  const created = await alegraFetch<{ id: string | number }>("/contacts", {
    method: "POST",
    body: {
      name,
      type: ["client"],
      ...(c.email ? { email: c.email } : {}),
      ...(c.phone ? { phonePrimary: c.phone } : {}),
    },
  });
  return String(created.id);
}

export async function createInvoice(
  body: unknown,
): Promise<{ id: string; number: string | null; total: number | null }> {
  const inv = await alegraFetch<{
    id: string | number;
    numberTemplate?: {
      fullNumber?: string;
      number?: string | number;
      prefix?: string;
    };
    total?: number;
  }>("/invoices", {
    method: "POST",
    body,
  });
  const nt = inv.numberTemplate;
  const number =
    nt?.fullNumber ??
    (nt?.number !== undefined ? `${nt.prefix ?? ""}${nt.number}` : null);
  return {
    id: String(inv.id),
    number,
    total: typeof inv.total === "number" ? inv.total : null,
  };
}

/** Prueba de solo lectura: ¿la cuenta responde con estas credenciales? */
export async function companyName(): Promise<string> {
  const c = await alegraFetch<{ name?: string }>("/company");
  return c.name ?? "la empresa";
}
