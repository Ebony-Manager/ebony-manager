import "server-only";

import { ACTA_FORM_ID, actaAnswersFromApi, type ActaAnswers, type ActaQuestion, type ActaSubmission } from "./acta-form";
import { createFolder, driveEnabled, driveRoot, ensureSubfolders, uploadBytes } from "@/lib/google/drive";
import { stageFolder } from "@/lib/google/drive-stages";
import { stageForProject } from "@/lib/google/stage-rules";

const API = process.env.JOTFORM_API_URL ?? "https://api.jotform.com";
export const ACTAS_FOLDER = "ACTAS DE ENTREGA";

function apiKey(): string | null {
  return process.env.JOTFORM_API_KEY?.trim() || null;
}

let questionsCache: { at: number; list: ActaQuestion[] } | null = null;

/** Las preguntas del formulario (nombre interno y etiqueta), para armar el enlace. Cache de 10 minutos. */
export async function getActaQuestions(): Promise<ActaQuestion[]> {
  if (questionsCache && Date.now() - questionsCache.at < 10 * 60_000) return questionsCache.list;
  const key = apiKey();
  if (!key) return [];
  const res = await fetch(`${API}/form/${ACTA_FORM_ID}/questions`, { headers: { APIKEY: key }, cache: "no-store" });
  if (!res.ok) throw new Error(`JotForm ${res.status}`);
  const body = (await res.json()) as { content?: Record<string, { name?: string; text?: string; type?: string }> };
  const list = Object.values(body.content ?? {})
    .filter((q) => q.name)
    .map((q) => ({ name: q.name!, text: q.text ?? "", type: q.type ?? "" }));
  questionsCache = { at: Date.now(), list };
  return list;
}

/** Las respuestas de un envío desde la API (con etiquetas). null sin API key o si no es de este formulario. */
export async function getActaAnswers(submissionId: string): Promise<ActaAnswers | null> {
  const key = apiKey();
  if (!key) return null;
  const res = await fetch(`${API}/submission/${encodeURIComponent(submissionId)}`, { headers: { APIKEY: key }, cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json()) as { content?: { form_id?: string; answers?: Parameters<typeof actaAnswersFromApi>[0] } };
  if (body.content?.form_id !== ACTA_FORM_ID || !body.content.answers) return null;
  return actaAnswersFromApi(body.content.answers);
}

const isPdf = (buf: ArrayBuffer) => new TextDecoder().decode(buf.slice(0, 5)) === "%PDF-";

/**
 * El PDF del acta (el documento de condiciones que llena JotForm). JotForm no
 * documenta cómo bajarlo por API: se prueban las direcciones que su soporte
 * indica, y vale la primera que devuelva un PDF de verdad.
 */
export async function downloadActaPdf(submissionId: string): Promise<ArrayBuffer> {
  const key = apiKey();
  if (!key) throw new Error("Falta JOTFORM_API_KEY");
  const sid = encodeURIComponent(submissionId);
  const urls = [
    `${API}/pdf-converter/${ACTA_FORM_ID}/fill-pdf?download=1&submissionID=${sid}&apikey=${key}`,
    `${API}/generatePDF?formid=${ACTA_FORM_ID}&submissionid=${sid}&apiKey=${key}&download=1`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { APIKEY: key }, cache: "no-store", redirect: "follow" });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (isPdf(buf)) return buf;
    } catch {
      // probar la siguiente
    }
  }
  throw new Error("JotForm no entregó el PDF del acta");
}

/** Un archivo subido al formulario (foto), con la API key. */
async function downloadUpload(url: string): Promise<{ data: ArrayBuffer; type: string; name: string }> {
  const key = apiKey();
  const withKey = key ? `${url}${url.includes("?") ? "&" : "?"}apiKey=${key}` : url;
  const res = await fetch(withKey, { headers: key ? { APIKEY: key } : {}, cache: "no-store", redirect: "follow" });
  if (!res.ok) throw new Error(`foto ${res.status}`);
  const type = res.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
  if (type.startsWith("text/html")) throw new Error("foto: JotForm pidió iniciar sesión");
  const name = decodeURIComponent(url.split("?")[0].split("/").pop() || "foto.jpg");
  return { data: await res.arrayBuffer(), type, name };
}

export interface ActaFilesResult {
  driveFolderId: string | null;
  pdfFileId: string | null;
  projectFolderId: string | null;
  error: string | null;
}

/**
 * Copia el PDF y las fotos a Drive: en la carpeta del proyecto → ACTAS DE
 * ENTREGA → "2026-11-10 · Ana Pérez". Si el proyecto no tenía carpeta, se le
 * crea (y se devuelve para guardarla). Un acta sin proyecto va a ACTAS DE
 * ENTREGA en la raíz de la unidad. Nunca lanza error: lo que falle se anota.
 */
export async function saveActaFiles(
  submissionId: string,
  acta: ActaSubmission,
  project: { name: string | null; status: string | null; folderId: string | null } | null
): Promise<ActaFilesResult> {
  const out: ActaFilesResult = { driveFolderId: null, pdfFileId: null, projectFolderId: null, error: null };
  if (!driveEnabled()) return { ...out, error: "Drive no está conectado" };
  const errors: string[] = [];
  try {
    let parent: string;
    if (project) {
      let folder = project.folderId;
      if (!folder) {
        folder = await createFolder(project.name ?? acta.projectName, await stageFolder(stageForProject(project.status)));
        out.projectFolderId = folder;
      }
      parent = (await ensureSubfolders(folder, [ACTAS_FOLDER])).get(ACTAS_FOLDER)!;
    } else {
      parent = (await ensureSubfolders(driveRoot()!, [ACTAS_FOLDER])).get(ACTAS_FOLDER)!;
    }
    const date = acta.date ?? new Date().toISOString().slice(0, 10);
    const label = [date, acta.clientName, project ? null : acta.projectName].filter(Boolean).join(" · ");
    out.driveFolderId = await createFolder(label, parent);

    try {
      const pdf = await downloadActaPdf(submissionId);
      out.pdfFileId = await uploadBytes(`Acta de entrega ${label}.pdf`, "application/pdf", pdf, out.driveFolderId);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "PDF");
    }

    let n = 0;
    for (const url of acta.photos) {
      n += 1;
      try {
        const f = await downloadUpload(url);
        await uploadBytes(`Foto ${n} - ${f.name}`, f.type, f.data, out.driveFolderId);
      } catch (err) {
        errors.push(`foto ${n}: ${err instanceof Error ? err.message : "error"}`);
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Drive");
  }
  out.error = errors.length ? errors.join("; ") : null;
  return out;
}
