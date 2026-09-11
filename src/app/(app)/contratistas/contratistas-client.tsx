"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import type { ContractorWithBalance, LaborRate, Project } from "@/types/contractors";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { ContractorDirectory } from "./contractor-directory";
import { ContractorFormDialog } from "./contractor-form-dialog";
import { ProjectsView } from "./projects-view";
import { LaborRatesView } from "./labor-rates-view";

/**
 * Chrome del módulo Contratistas (C2): pestañas "Contratistas"
 * (directorio), "Proyectos" y "Tarifas" (catálogo de mano de obra). El
 * estado de cuenta completo vive en la ficha de cada contratista
 * (`/contratistas/[id]`).
 */
export function ContratistasClient({
  contractors,
  projects,
  laborRates,
}: {
  contractors: ContractorWithBalance[];
  projects: Project[];
  laborRates: LaborRate[];
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  const [tab, setTab] = React.useState("directory");
  const [addOpen, setAddOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{tt("title")}</h1>
          <p className="text-sm text-muted-foreground">{tt("subtitle")}</p>
        </div>
        {tab === "directory" && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" />
            {tt("add_contractor")}
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="directory">{tt("tab_directory")}</TabsTrigger>
          <TabsTrigger value="projects">{tt("tab_projects")}</TabsTrigger>
          <TabsTrigger value="rates">{tt("tab_rates")}</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="pt-4">
          <ContractorDirectory contractors={contractors} />
        </TabsContent>
        <TabsContent value="projects" className="pt-4">
          <ProjectsView projects={projects} />
        </TabsContent>
        <TabsContent value="rates" className="pt-4">
          <LaborRatesView rates={laborRates} />
        </TabsContent>
      </Tabs>

      <ContractorFormDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
