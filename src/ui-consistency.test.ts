import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guardia de consistencia de la interfaz (ver UI-RULES.md). Corre junto con
 * todas las pruebas (`npx vitest run`) y falla si alguien vuelve a escribir a
 * mano algo que ya tiene su componente compartido: así un recuadro de "no hay
 * nada", un campo de formulario o un título de bloque no pueden salir distintos
 * en una pantalla nueva.
 *
 * Si una regla estorba en un caso legítimo, se marca ESA línea con un
 * comentario `ui-allow: motivo` (hasta 3 líneas arriba). No se desactiva la regla.
 */

const SRC = join(__dirname);
const files: { path: string; lines: string[] }[] = [];
(function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push({ path: relative(SRC, full).replaceAll("\\", "/"), lines: readFileSync(full, "utf8").split("\n") });
  }
})(SRC);

const allowed = (lines: string[], i: number) => [i, i - 1, i - 2, i - 3].some((k) => k >= 0 && lines[k].includes("ui-allow:"));

function find(test: (line: string, path: string) => boolean): string[] {
  const out: string[] = [];
  for (const f of files) f.lines.forEach((line, i) => test(line, f.path) && !allowed(f.lines, i) && out.push(`${f.path}:${i + 1}`));
  return out;
}

const fix = (what: string, bad: string[]) => `${what}\n  ${bad.join("\n  ")}`;

describe("consistencia de la interfaz", () => {
  it("el vacío (\"todavía no hay…\") es siempre <EmptyState>, no un recuadro punteado a mano", () => {
    const bad = find((l, p) => p !== "components/shared/page-header.tsx" && l.includes("border-dashed") && l.includes("text-center"));
    expect(bad, fix("Usa <EmptyState> de @/components/shared/page-header (o marca `ui-allow: dropzone`/`ui-allow: foto` si es una zona de arrastre o un botón de agregar foto):", bad)).toEqual([]);
  });

  it("hay un solo <Field> (components/shared/field.tsx), no definiciones locales", () => {
    const bad = find((l, p) => p !== "components/shared/field.tsx" && /^\s*(export )?function Field\(/.test(l));
    expect(bad, fix("Importa Field de @/components/shared/field:", bad)).toEqual([]);
  });

  it("las fechas y horas usan <Input type=\"date\">, no un <input> crudo (se salen de su columna en el iPhone)", () => {
    const bad = find((l, p) => !p.startsWith("components/ui/") && /<input\b/.test(l) && /type="(date|time|month|week|datetime-local)"/.test(l));
    expect(bad, fix("Usa <Input> de @/components/ui/input:", bad)).toEqual([]);
  });

  it("los títulos de bloque de un formulario o ficha son <FormSection> (con su ícono)", () => {
    const bad = find((l, p) => p !== "app/(app)/cotizacion/[id]/client-view.tsx" && l.includes('<h3 className="text-sm font-semibold text-foreground">'));
    expect(bad, fix("Usa <FormSection icon title> de @/components/shared/form-section:", bad)).toEqual([]);
  });

  it("un concepto tiene un solo ícono: el del menú (Proyecto = Folder)", () => {
    const bad = find((l) => /\bFolderKanban\b/.test(l));
    expect(bad, fix("Proyecto usa el ícono Folder, como el menú principal:", bad)).toEqual([]);
  });

  it("no se usan confirm()/alert() del navegador (borrar es en dos toques: <ConfirmButton>)", () => {
    const bad = find((l) => /\bwindow\.(confirm|alert)\(/.test(l));
    expect(bad, fix("Usa <ConfirmButton> o useConfirm():", bad)).toEqual([]);
  });

  it("colores: del tema (bg-primary, text-muted-foreground…), no de la paleta de Tailwind — la deuda existente no puede crecer", () => {
    // Deuda anotada al crear la guardia. Si baja, bájala acá; si sube, la prueba falla.
    // (Los #hex de logos de marca, correos, PDF y el visor 3D son legítimos: no se revisan.)
    const BASELINE = 21;
    const palette = find((l) => /\b(bg|text|border|ring|fill|stroke)-(red|blue|green|amber|yellow|gray|slate|zinc|neutral|emerald|orange|rose|sky|indigo|purple|pink)-\d{2,3}\b/.test(l));
    expect(palette.length, fix("Hay más colores de paleta Tailwind que antes: usa tokens del tema. Líneas:", palette)).toBeLessThanOrEqual(BASELINE);
  });
});
