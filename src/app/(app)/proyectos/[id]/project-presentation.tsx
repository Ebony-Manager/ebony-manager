"use client";

import * as React from "react";

import { DriveFiles } from "@/components/shared/drive-files";
import { LoadingBlock } from "@/components/shared/loading-block";
import { EmptyState } from "@/components/shared/page-header";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { ensureShopPresentationFolderAction } from "../../drive-actions";

/**
 * Presentación en taller: fotos y videos del mueble presentado completo en
 * taller (como se va a instalar), de evidencia. Viven en Drive, en la carpeta
 * del proyecto → PRESENTACION EN TALLER; se suben desde el teléfono o la compu.
 */
export function ProjectPresentation({ projectId, driveEnabled }: { projectId: string; driveEnabled: boolean }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.proyectos) => t(lang, strings.proyectos[k]);
  const [folder, setFolder] = React.useState<{ id: string | null; error: string | null } | null>(null);

  React.useEffect(() => {
    if (!driveEnabled) return;
    let alive = true;
    void ensureShopPresentationFolderAction(projectId).then((res) => {
      if (alive) setFolder(res.ok ? { id: res.data.folderId, error: null } : { id: null, error: res.error });
    });
    return () => {
      alive = false;
    };
  }, [projectId, driveEnabled]);

  const create = React.useCallback(async () => {
    const res = await ensureShopPresentationFolderAction(projectId);
    return res.ok ? res.data : null;
  }, [projectId]);

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-2xl text-xs text-muted-foreground">{tt("presentation_hint")}</p>
      {driveEnabled && folder === null ? (
        <LoadingBlock variant="cards" rows={2} />
      ) : (
        <>
          {folder?.error && <EmptyState>{folder.error}</EmptyState>}
          <DriveFiles enabled={driveEnabled} folderId={folder?.id ?? null} onCreate={create} />
        </>
      )}
    </div>
  );
}
