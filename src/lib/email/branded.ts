// El diseño de todos los correos de Ebony: el mismo de las plantillas de
// Supabase (supabase/templates/): fondo gris claro, tarjeta blanca con el logo,
// botón negro y el pie "Ebony Custom Woodwork · Panamá". Los correos que manda
// la app (resumen del Almacén y los que vengan) se arman con esto; si cambia el
// diseño, cambiar también las plantillas de Supabase.

/** El logo en PNG (los correos no muestran SVG), servido por la app. */
export const EMAIL_LOGO_URL = "https://admin.ebonypanama.com/email/ebony-logo.png";

export const EMAIL_COLORS = {
  page: "#f4f4f2",
  ink: "#0a0a0a",
  text: "#3f3f3f",
  muted: "#6b6b6b",
  faint: "#9a9a9a",
  line: "#ececea",
  warn: "#b54708",
} as const;

export interface BrandedEmail {
  /** Línea chica arriba del título (ej. "Almacén"). */
  kicker?: string;
  title: string;
  /** HTML ya escapado. */
  body: string;
  button?: { href: string; label: string };
  /** Nota gris del pie (por qué le llega este correo). */
  footnote?: string;
  /** Ancho de la tarjeta: 480 para mensajes, más para tablas. */
  width?: number;
}

export function brandedEmailHtml({ kicker, title, body, button, footnote, width = 480 }: BrandedEmail): string {
  const c = EMAIL_COLORS;
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${c.page};font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${c.ink};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.page};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${width}px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 32px 8px 32px;">
          <img src="${EMAIL_LOGO_URL}" width="120" height="32" alt="Ebony" style="display:block;border:0;">
        </td></tr>
        <tr><td style="padding:20px 32px 8px 32px;">
          ${kicker ? `<p style="margin:0 0 4px 0;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:${c.muted};">${kicker}</p>` : ""}
          <p style="margin:0 0 18px 0;font-size:20px;font-weight:600;line-height:1.3;">${title}</p>
          ${body}
          ${
            button
              ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr><td style="border-radius:10px;background:${c.ink};">
            <a href="${button.href}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${button.label}</a>
          </td></tr></table>`
              : ""
          }
        </td></tr>
        <tr><td style="padding:24px 32px 32px 32px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:${c.faint};border-top:1px solid ${c.line};padding-top:16px;">
            Ebony Custom Woodwork · Panamá${footnote ? `<br>${footnote}` : ""}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
