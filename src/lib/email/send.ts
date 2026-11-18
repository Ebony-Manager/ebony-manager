import "server-only";

/**
 * Manda un correo con Resend (el mismo servicio del resumen diario de Almacén). Variables en Vercel:
 * RESEND_API_KEY y RESEND_FROM. Nunca rompe lo que lo llama: devuelve si se mandó y, si no, por qué.
 */
export async function sendEmail(msg: { to: string[]; subject: string; html: string; text: string }): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) return { ok: false, error: "Faltan RESEND_API_KEY o RESEND_FROM en Vercel." };
  const to = msg.to.filter(Boolean);
  if (to.length === 0) return { ok: false, error: "Sin destinatario." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: msg.subject, html: msg.html, text: msg.text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, error: `Resend respondió ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Un correo sencillo: título, líneas «etiqueta: valor», una lista y un botón. */
export function simpleEmail(p: { title: string; rows: [string, string][]; listTitle?: string; list?: string[]; buttonLabel?: string; buttonUrl?: string; footer?: string }) {
  const rowsHtml = p.rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${esc(k)}</td><td style="padding:4px 0;color:#111"><b>${esc(v)}</b></td></tr>`).join("");
  const listHtml = p.list?.length
    ? `<p style="margin:16px 0 6px;color:#111"><b>${esc(p.listTitle ?? "")}</b></p><ul style="margin:0;padding-left:18px;color:#111">${p.list.map((x) => `<li style="margin:3px 0">${esc(x)}</li>`).join("")}</ul>`
    : "";
  const button = p.buttonUrl
    ? `<p style="margin:20px 0"><a href="${esc(p.buttonUrl)}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">${esc(p.buttonLabel ?? "Abrir")}</a></p>`
    : "";
  const html = `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:14px;max-width:560px">
<h2 style="font-size:18px;margin:0 0 12px;color:#111">${esc(p.title)}</h2>
<table style="border-collapse:collapse">${rowsHtml}</table>${listHtml}${button}
<p style="margin-top:24px;color:#888;font-size:12px">${esc(p.footer ?? "Ebony Manager")}</p></div>`;
  const text = [p.title, "", ...p.rows.map(([k, v]) => `${k}: ${v}`), ...(p.list?.length ? ["", p.listTitle ?? "", ...p.list.map((x) => `- ${x}`)] : []), ...(p.buttonUrl ? ["", p.buttonUrl] : [])].join("\n");
  return { html, text };
}
