import { requireAdmin } from "@/lib/auth/dal";
import { answerText, isProductAnswer, parseProductLine, productLines } from "@/lib/almacen/jotform-egresos";

// Catálogo del JotForm "Egreso de Suministros" (productos con fotos,
// variantes, existencias y mínimos), tal cual está en JotForm, para revisarlo
// antes de migrarlo al Almacén. Solo lectura y solo admin. CSV por defecto;
// `?formato=json` da los datos crudos y `?formato=egresos` todos los envíos,
// una fila por producto entregado.
const FORM_ID = "221884899655074";
const JOTFORM_API = process.env.JOTFORM_API_URL ?? "https://api.jotform.com";

type Product = Record<string, unknown>;

export async function GET(request: Request) {
  await requireAdmin();
  const apiKey = process.env.JOTFORM_API_KEY?.trim();
  if (!apiKey) return new Response("Falta JOTFORM_API_KEY en el servidor.", { status: 500 });
  const formato = new URL(request.url).searchParams.get("formato");
  if (formato === "egresos") return egresosCsv(apiKey);

  const res = await fetch(`${JOTFORM_API}/form/${FORM_ID}/properties`, { headers: { APIKEY: apiKey }, cache: "no-store" });
  if (!res.ok) return new Response(`JotForm respondió ${res.status}.`, { status: 502 });
  const body = (await res.json()) as { content?: Record<string, unknown> };
  const props = body.content ?? {};

  const products = toProducts(props.products);
  // Lo que tenga que ver con inventario (existencias, alertas) o con las categorías puede vivir fuera de los productos.
  const inventory = Object.fromEntries(Object.entries(props).filter(([k]) => /stock|inventor|alert|categor/i.test(k)));

  if (formato === "json") {
    return Response.json({ products, inventory }, { headers: { "Content-Disposition": 'attachment; filename="catalogo-jotform.json"' } });
  }

  const known = new Set(["pid", "name", "description", "price", "images", "options"]);
  const rows = [
    ["pid", "nombre", "descripcion", "precio", "imagenes", "opciones", "otros_datos"],
    ...products.map((p) => [
      str(p.pid),
      str(p.name),
      str(p.description),
      str(p.price),
      images(p.images).join(" | "),
      typeof p.options === "string" ? p.options : JSON.stringify(p.options ?? ""),
      JSON.stringify(Object.fromEntries(Object.entries(p).filter(([k]) => !known.has(k)))),
    ]),
  ];
  const csv = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="catalogo-jotform.csv"',
    },
  });
}

type Submission = { id: string; created_at: string; status?: string; answers?: Record<string, { text?: string; type?: string; answer?: unknown; prettyFormat?: string }> };

/** Una fila por producto entregado en cada envío, para calcular el consumo real por variante. */
async function egresosCsv(apiKey: string): Promise<Response> {
  const submissions: Submission[] = [];
  for (let offset = 0; ; offset += 1000) {
    const url = `${JOTFORM_API}/form/${FORM_ID}/submissions?limit=1000&offset=${offset}&orderby=created_at`;
    const res = await fetch(url, { headers: { APIKEY: apiKey }, cache: "no-store" });
    if (!res.ok) return new Response(`JotForm respondió ${res.status}.`, { status: 502 });
    const page = ((await res.json()) as { content?: Submission[] }).content ?? [];
    submissions.push(...page);
    if (page.length < 1000) break;
  }

  const rows = [["envio", "creado", "fecha", "entregado_a", "autorizado_por", "proyecto", "producto", "variante", "cantidad", "devoluciones", "texto_original"]];
  for (const s of submissions) {
    if (s.status === "DELETED") continue;
    const answers = Object.values(s.answers ?? {});
    const byText = (re: RegExp) => answerText(answers.find((a) => re.test(a.text ?? "")));
    const devoluciones = answers
      .filter((a) => /^devoluci/i.test(a.text ?? ""))
      .map((a) => [a.text, answerText(a)] as const)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ");
    const base = [s.id, s.created_at, byText(/^fecha/i), byText(/entregado/i), byText(/autorizado/i), byText(/proyecto/i)];
    const lines = answers.filter(isProductAnswer).flatMap(productLines);
    if (lines.length === 0) rows.push([...base, "", "", "", devoluciones, ""]);
    for (const line of lines) {
      const p = parseProductLine(line);
      rows.push([...base, p.product, p.variant, String(p.quantity), devoluciones, line]);
    }
  }
  return new Response("﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="egresos-jotform.csv"' },
  });
}

function toProducts(raw: unknown): Product[] {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) return value as Product[];
  if (value && typeof value === "object") return Object.values(value as Record<string, Product>);
  return [];
}

function images(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [raw];
    } catch {
      return raw ? [raw] : [];
    }
  }
  return [];
}

const str = (v: unknown) => (v == null ? "" : String(v));

function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
