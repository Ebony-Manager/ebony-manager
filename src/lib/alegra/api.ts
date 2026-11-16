import "server-only";

/**
 * Cliente mínimo de la API de Alegra (https://developer.alegra.com).
 * Dos formas de entrar, ambas desde Configuración → API en Alegra:
 *  - Las "Credenciales de acceso": ALEGRA_EMAIL + ALEGRA_TOKEN (Basic, la
 *    que documenta la API de facturas).
 *  - Un "JWT Token" (el nuevo que recomienda Alegra): ALEGRA_JWT, o puesto
 *    en ALEGRA_TOKEN (se reconoce solo; empieza con "eyJ"). Va como Bearer.
 * Si hay JWT, se usa ese. Límite: 150 consultas por minuto. Los IDs llegan
 * como texto (Alegra está pasando a UUID): siempre string.
 */

const BASE = "https://api.alegra.com/api/v1";

const looksLikeJwt = (t: string) => /^eyJ[\w-]*\.[\w-]+\.[\w-]+$/.test(t);

function jwt(): string | null {
  const explicit = process.env.ALEGRA_JWT?.trim();
  if (explicit) return explicit;
  const token = process.env.ALEGRA_TOKEN?.trim();
  return token && looksLikeJwt(token) ? token : null;
}

export function alegraConfigured(): boolean {
  return (
    !!jwt() ||
    (!!process.env.ALEGRA_EMAIL?.trim() && !!process.env.ALEGRA_TOKEN?.trim())
  );
}

/** Cómo se está entrando (para mostrarlo en Settings → Conexiones). */
export function alegraAuthMode(): "jwt" | "basic" | null {
  return jwt() ? "jwt" : alegraConfigured() ? "basic" : null;
}

function authHeader(): string {
  const bearer = jwt();
  if (bearer) return `Bearer ${bearer}`;
  const email = process.env.ALEGRA_EMAIL?.trim();
  const token = process.env.ALEGRA_TOKEN?.trim();
  if (!email || !token)
    throw new Error(
      "Alegra no está conectado: faltan ALEGRA_EMAIL y ALEGRA_TOKEN (o ALEGRA_JWT) en Vercel.",
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

/**
 * Prueba de solo lectura de lo que la app usa (una consulta mínima a cada
 * uno). Alegra responde 401 si el correo/token no sirven y 402 si el plan no
 * incluye ese recurso por API.
 */
export async function checkAccess(): Promise<
  { name: string; ok: boolean; error?: string }[]
> {
  const checks: [string, string][] = [
    ["facturas", "/invoices"],
    ["productos y servicios", "/items"],
    ["impuestos", "/taxes"],
    ["contactos", "/contacts"],
    ["cotizaciones", "/estimates"],
    ["numeraciones", "/number-templates"],
  ];
  const out: { name: string; ok: boolean; error?: string }[] = [];
  for (const [name, path] of checks) {
    try {
      await alegraFetch(path, { query: { limit: 1 } });
      out.push({ name, ok: true });
    } catch (err) {
      out.push({
        name,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return out;
}

/**
 * Informe para el soporte de Alegra: por cada recurso que usa la app, la consulta completa (método, URL, headers con la
 * clave OCULTA) y la respuesta completa (status, headers y body tal cual). Solo lectura (GET con limit=1).
 */
export async function alegraSupportReport(): Promise<string> {
  const paths = ["/contacts", "/invoices", "/items", "/taxes", "/estimates", "/number-templates"];
  const mode = alegraAuthMode();
  const hiddenAuth = mode === "jwt" ? "Bearer <JWT Token oculto>" : "Basic <correo:token oculto>";
  const out: unknown[] = [];
  for (const path of paths) {
    const url = new URL(`${BASE}${path}`);
    url.searchParams.set("limit", "1");
    const requestHeaders = { Authorization: hiddenAuth, Accept: "application/json" };
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: authHeader(), Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      const raw = await res.text();
      let body: unknown = raw;
      try {
        body = JSON.parse(raw);
      } catch {
        /* se deja como texto */
      }
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        if (k.toLowerCase() !== "set-cookie") headers[k] = v;
      });
      out.push({
        request: { method: "GET", url: url.toString(), headers: requestHeaders, body: null },
        response: { status: res.status, statusText: res.statusText, headers, body: typeof body === "string" ? body.slice(0, 4000) : body },
      });
    } catch (err) {
      out.push({
        request: { method: "GET", url: url.toString(), headers: requestHeaders, body: null },
        response: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }
  return JSON.stringify({ fecha: new Date().toISOString(), autenticacion: mode === "jwt" ? "JWT Token (Bearer)" : "Correo + token (Basic)", pruebas: out }, null, 2);
}
