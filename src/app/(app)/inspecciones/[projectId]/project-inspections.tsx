"use client";

import { useLang } from "@/context/language-context";
import { usePageTitle } from "@/components/shared/page-title";
import { strings as titleStrings, t as titleT } from "@/lib/i18n";
import Link from "next/link";
import { Folder } from "lucide-react";

import type { Inspection, InspectionPainter, InspectionProject } from "@/types/inspections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PAGE_CLASS, PageHeader } from "@/components/shared/page-header";
import { projectPath } from "../../proyectos/paths";
import { InspectionsBoard } from "../inspections-board";
import { INSPECTIONS_PATH } from "../paths";
import { useTi } from "../shared";

export function ProjectInspections({
  project,
  inspections,
  painters,
  canOpenProject,
  startNew,
}: {
  project: InspectionProject;
  inspections: Inspection[];
  painters: InspectionPainter[];
  /** Con Proyectos (o Contratistas), un enlace a la ficha. */
  canOpenProject: boolean;
  /** Viene de "Nueva inspección": abre la visita de hoy (o una nueva) al entrar. */
  startNew?: boolean;
}) {
  usePageTitle([project.name, titleT(useLang().lang, titleStrings.nav.inspecciones)]);
  const { ti } = useTi();
  return (
    <div className={PAGE_CLASS}>
      <PageHeader
        back={{ href: INSPECTIONS_PATH, label: ti("back") }}
        title={
          <>
            {project.name}
            {!project.active && <Badge variant="outline">{ti("completed")}</Badge>}
          </>
        }
        subtitle={[project.clientName, project.location].filter(Boolean).join(" · ") || undefined}
        action={
          canOpenProject ? (
            <Button asChild size="sm" variant="ghost" className="text-muted-foreground">
              <Link href={projectPath(project.id)}>
                <Folder className="size-4" />
                <span className="hidden sm:inline">{ti("open_project")}</span>
              </Link>
            </Button>
          ) : undefined
        }
      />
      <InspectionsBoard project={project} inspections={inspections} painters={painters} startNew={startNew} />
    </div>
  );
}
