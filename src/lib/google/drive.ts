import "server-only";

import { createSign } from "node:crypto";

/**
 * Google Drive con la cuenta de servicio de la empresa (sin librería: un JWT
 * firmado y la API REST). Todo vive en la Unidad compartida cuyo ID está en
 * GOOGLE_DRIVE_ROOT_FOLDER_ID; la cuenta de servicio es miembro de esa unidad.
 * Variables (Vercel, nunca en el código):
 *   GOOGLE_SERVICE_ACCOUNT_JSON   el JSON completo de la llave
 *   GOOGLE_DRIVE_ROOT_FOLDER_ID   la unidad (o carpeta) raíz
 *   GOOGLE_DRIVE_IMPERSONATE      opcional: actuar en nombre de ese usuario
 */

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
export const FOLDER_MIME = "application/vnd.google-apps.folder";
const ALL_DRIVES = "supportsAllDrives=true";

interface Credentials {
  clientEmail: string;
  privateKey: string;
}

function credentials(): Credentials | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const json = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (!json.client_email || !json.private_key) return null;
    return { clientEmail: json.client_email, privateKey: json.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export function driveRoot(): string | null {
  return process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim() || null;
}

/** ¿Están puestas las variables? (Sin ellas la app muestra "Drive no está conectado".) */
export function driveEnabled(): boolean {
  return credentials() !== null && driveRoot() !== null;
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const creds = credentials();
  if (!creds) throw new Error("Drive no está conectado (faltan las variables en Vercel).");
  const now = Math.floor(Date.now() / 1000);
  const claims: Record<string, string | number> = {
    iss: creds.clientEmail,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const subject = process.env.GOOGLE_DRIVE_IMPERSONATE?.trim();
  if (subject) claims.sub = subject;
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(creds.privateKey).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
    cache: "no-store",
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !json.access_token) throw new Error(`Google no aceptó la llave: ${json.error_description ?? json.error ?? res.status}`);
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? detail;
    } catch {}
    throw new Error(`Drive: ${detail}`);
  }
  return res;
}

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size: number | null;
  modifiedTime: string;
  webViewLink: string | null;
  hasThumbnail: boolean;
}

const ITEM_FIELDS = "id,name,mimeType,size,modifiedTime,webViewLink,hasThumbnail,thumbnailLink";

type RawItem = { id: string; name: string; mimeType: string; size?: string; modifiedTime: string; webViewLink?: string; hasThumbnail?: boolean };
const mapItem = (f: RawItem): DriveItem => ({
  id: f.id,
  name: f.name,
  mimeType: f.mimeType,
  isFolder: f.mimeType === FOLDER_MIME,
  size: f.size ? Number(f.size) : null,
  modifiedTime: f.modifiedTime,
  webViewLink: f.webViewLink ?? null,
  hasThumbnail: !!f.hasThumbnail,
});

/** Lo que hay dentro de una carpeta: carpetas primero, luego por nombre. */
export async function listFolder(folderId: string): Promise<DriveItem[]> {
  const items: DriveItem[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId.replace(/'/g, "")}' in parents and trashed = false`,
      fields: `nextPageToken,files(${ITEM_FIELDS})`,
      orderBy: "folder,name_natural",
      pageSize: "200",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      corpora: "allDrives",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const json = (await (await driveFetch(`${API}/files?${params}`)).json()) as { files: RawItem[]; nextPageToken?: string };
    items.push(...json.files.map(mapItem));
    pageToken = json.nextPageToken;
  } while (pageToken);
  return items;
}

export async function getItem(id: string): Promise<DriveItem & { thumbnailLink: string | null }> {
  const res = await driveFetch(`${API}/files/${encodeURIComponent(id)}?fields=${ITEM_FIELDS}&${ALL_DRIVES}`);
  const raw = (await res.json()) as RawItem & { thumbnailLink?: string };
  return { ...mapItem(raw), thumbnailLink: raw.thumbnailLink ?? null };
}

export async function createFolder(name: string, parentId: string): Promise<string> {
  const res = await driveFetch(`${API}/files?fields=id&${ALL_DRIVES}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() || "Sin nombre", mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  return ((await res.json()) as { id: string }).id;
}

/** El contenido del archivo (para verlo dentro de la app). */
export async function downloadFile(id: string): Promise<Response> {
  return driveFetch(`${API}/files/${encodeURIComponent(id)}?alt=media&${ALL_DRIVES}`);
}

/** La miniatura de Google (necesita el token, por eso pasa por la app). */
export async function downloadThumbnail(link: string): Promise<Response> {
  return driveFetch(link);
}

/**
 * Subida directa del navegador a Google: la app abre una sesión "resumable"
 * con el token y devuelve su dirección; el navegador manda el archivo ahí
 * (sin pasar por Vercel, así no hay límite de tamaño de la función).
 */
export async function startUpload(parentId: string, name: string, mimeType: string, size: number, origin: string | null): Promise<string> {
  const res = await driveFetch(`${UPLOAD_API}/files?uploadType=resumable&${ALL_DRIVES}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType || "application/octet-stream",
      "X-Upload-Content-Length": String(size),
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify({ name, parents: [parentId] }),
  });
  const location = res.headers.get("location");
  if (!location) throw new Error("Drive no devolvió la dirección de subida.");
  return location;
}

export const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;
