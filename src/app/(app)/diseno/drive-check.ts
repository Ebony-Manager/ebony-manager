import "server-only";

import { driveEnabled, getItem as getDriveItem, isInsideFolder } from "@/lib/google/drive";
import { ensureProjectFolderAction } from "@/app/(app)/drive-actions";

/** Un archivo escogido del Drive del proyecto: tiene que estar dentro de la carpeta del proyecto. */
export async function checkProjectDriveFile(projectId: string, driveFileId: string) {
  if (!driveEnabled()) throw new Error("Drive no está conectado (faltan las variables en Vercel).");
  const project = await ensureProjectFolderAction(projectId);
  if (!project.ok) throw new Error(project.error);
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(driveFileId) || !(await isInsideFolder(driveFileId, project.data.folderId)))
    throw new Error("Ese archivo no está en la carpeta del proyecto.");
  const item = await getDriveItem(driveFileId);
  if (item.isFolder) throw new Error("Escoge un archivo, no una carpeta.");
  return item;
}

