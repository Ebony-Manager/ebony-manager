import "server-only";

import {
  DELIVERY_FORMS,
  DELIVERY_KINDS,
  actaAnswersFromApi,
  projectQuestion,
  type ActaAnswers,
  type ActaQuestion,
  type ActaSubmission,
  type DeliveryKind,
} from "./acta-form";
import { createFolder, driveEnabled, driveRoot, ensureSubfolders, uploadBytes } from "@/lib/google/drive";
import { stageFolder } from "@/lib/google/drive-stages";
import { stageForProject } from "@/lib/google/stage-rules";

const API = process.env.JOTFORM_API_URL ?? "https://api.jotform.com";

function apiKey(): string | null {
  return process.env.JOTFORM_API_KEY?.trim() || null;
}

const questionsCache = new Map<string, { at: number; list: ActaQuestion[] }>();

/** Las preguntas de un formulario (nombre interno, etiqueta, tipo, id). Cache de 10 minutos. */
export async function getFormQuestions(formId: string): Promise<(ActaQuestion & { qid: string })[]> {
  const hit = questionsCache.get(formId);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.list as (ActaQuestion & { qid: string })[];
  const key = apiKey();
  if (!key) return [];
  const res = await fetch(`${API}/form/${formId}/questions`, { headers: { APIKEY: key }, cache: "no-store" });
  if (!res.ok) throw new Error(`JotForm ${res.status}`);
  const body = (await res.json()) as { content?: Record<string, { qid?: string; name?: string; text?: string; type?: string }> };
  const list = Object.entries(body.content ?? {})
    .filter(([, q]) => q.name)
    .map(([qid, q]) => ({ qid: q.qid ?? qid, name: q.name!, text: q.text ?? "", type: q.type ?? "" }));
  questionsCache.set(formId, { at: Date.now(), list });
  return list;
}

/** Las preguntas del acta (compatibilidad). */
export const getActaQuestions = () => getFormQuestions(DELIVERY_FORMS.entrega.formId);

/** Las respuestas de un envío desde la API (con etiquetas). null sin API key o si no es de ese formulario. */
export async function getActaAnswers(submissionId: string, formId: string = DELIVERY_FORMS.entrega.formId): Promise<ActaAnswers | null> {
  const key = apiKey();
  if (!key) return null;
  const res = await fetch(`${API}/submission/${encodeURIComponent(submissionId)}`, { headers: { APIKEY: key }, cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json()) as { content?: { form_id?: string; answers?: Parameters<typeof actaAnswersFromApi>[0] } };
  if (body.content?.form_id !== formId || !body.content.answers) return null;
  return actaAnswersFromApi(body.content.answers);
}

const isPdf = (buf: ArrayBuffer) => new TextDecoder().decode(buf.slice(0, 5)) === "%PDF-";

/**
 * El PDF del envío. JotForm no documenta cómo bajarlo por API: se prueban
 * las direcciones que su soporte indica (primero el documento que llena el
 * formulario, después el PDF del envío) y vale la primera que sea un PDF.
 */
export async function downloadActaPdf(submissionId: string, formId: string = DELIVERY_FORMS.entrega.formId): Promise<ArrayBuffer> {
  const key = apiKey();
  if (!key) throw new Error("Falta JOTFORM_API_KEY");
  const sid = encodeURIComponent(submissionId);
  const urls = [
    `${API}/pdf-converter/${formId}/fill-pdf?download=1&submissionID=${sid}&apikey=${key}`,
    `${API}/generatePDF?formid=${formId}&submissionid=${sid}&apiKey=${key}&download=1`,
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
  throw new Error("JotForm no entregó el PDF");
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
 * Copia el PDF y las fotos a Drive: carpeta del proyecto → ACTAS DE ENTREGA
 * (o AUTORIZACIONES PINTURA / EMBALAJE) → "2026-11-10 · …". Si el proyecto no
 * tenía carpeta, se le crea (y se devuelve para guardarla). Sin proyecto, va
 * a esa misma carpeta en la raíz de la unidad. Nunca lanza error.
 */
export async function saveActaFiles(
  submissionId: string,
  acta: ActaSubmission,
  project: { name: string | null; status: string | null; folderId: string | null } | null,
  kind: DeliveryKind = "entrega"
): Promise<ActaFilesResult> {
  const out: ActaFilesResult = { driveFolderId: null, pdfFileId: null, projectFolderId: null, error: null };
  if (!driveEnabled()) return { ...out, error: "Drive no está conectado" };
  const { folder: folderName, formId, title } = DELIVERY_FORMS[kind];
  const errors: string[] = [];
  try {
    let parent: string;
    if (project) {
      let folder = project.folderId;
      if (!folder) {
        folder = await createFolder(project.name ?? acta.projectName, await stageFolder(stageForProject(project.status)));
        out.projectFolderId = folder;
      }
      parent = (await ensureSubfolders(folder, [folderName])).get(folderName)!;
    } else {
      parent = (await ensureSubfolders(driveRoot()!, [folderName])).get(folderName)!;
    }
    const date = acta.date ?? new Date().toISOString().slice(0, 10);
    const who = acta.clientName ?? acta.items?.split("\n")[0]?.slice(0, 60) ?? null;
    const label = [date, who, project ? null : acta.projectName].filter(Boolean).join(" · ");
    out.driveFolderId = await createFolder(label, parent);

    try {
      const pdf = await downloadActaPdf(submissionId, formId);
      out.pdfFileId = await uploadBytes(`${title} ${label}.pdf`, "application/pdf", pdf, out.driveFolderId);
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

/**
 * La lista de proyectos en los formularios: si el campo "Nombre Proyecto" de
 * un formulario es una lista desplegable, se le ponen como opciones los
 * proyectos activos (así en taller se escoge el proyecto y el envío cae solo
 * en él). Los formularios donde el campo es texto no se tocan. Devuelve en
 * cuántos formularios se actualizó.
 */
export async function syncProjectOptions(projectNames: string[]): Promise<number> {
  const key = apiKey();
  if (!key) return 0;
  const options = [...new Set(projectNames.map((n) => n.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  let updated = 0;
  for (const kind of DELIVERY_KINDS) {
    const { formId } = DELIVERY_FORMS[kind];
    try {
      const q = projectQuestion(await getFormQuestions(formId)) as (ActaQuestion & { qid: string }) | null;
      if (!q || q.type !== "control_dropdown") continue;
      const res = await fetch(`${API}/form/${formId}/question/${q.qid}`, {
        method: "POST",
        headers: { APIKEY: key, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ "question[options]": options.join("|") }),
        cache: "no-store",
      });
      if (res.ok) updated += 1;
    } catch (err) {
      console.error(`JotForm: no se pudo actualizar la lista de proyectos del formulario ${formId}`, err);
    }
  }
  return updated;
}
