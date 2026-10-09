"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

import type { ContractorWithBalance, LaborRate, Project } from "@/types/contractors";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { breadcrumbFor } from "@/components/layout/nav-items";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { ContractorDirectory } from "./contractor-directory";
import { ContractorFormDialog } from "./contractor-form-dialog";
import { ProjectsView } from "./projects-view";
import { LaborRatesView } from "./labor-rates-view";
import { ContractorsDashboardView, type ContractorsDashboardInput } from "./contractors-dashboard-view";

/**
 * Chrome del módulo Contratistas (C2): pestañas "Dashboard" (resumen de
 * todos), "Contratistas" (directorio), "Proyectos" y "Tarifas" (catálogo de mano de obra). El
 * estado de cuenta completo vive en la ficha de cada contratista
 * (`/contratistas/[id]`).
 */
export function ContratistasClient({
  contractors,
  projects,
  laborRates,
  dashboard,
}: {
  contractors: ContractorWithBalance[];
  projects: Project[];
  laborRates: LaborRate[];
  dashboard: ContractorsDashboardInput;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);
  const pathname = usePathname();
  const crumbs = breadcrumbFor(pathname, lang);

  const [tab, setTab] = React.useState("dashboard");
  const [addOpen, setAddOpen] = React.useState(false);

  const TABS = [
    { value: "dashboard", label: tt("tab_dashboard") },
    { value: "directory", label: tt("tab_directory") },
    { value: "projects", label: tt("tab_projects") },
    { value: "rates", label: tt("tab_rates") },
  ];

  return (
    <div className="flex flex-col gap-5 px-7 pt-6 pb-10">
      {crumbs.length > 0 && (
        <nav aria-label="breadcrumb" className="-mt-2 flex items-center gap-1.5 text-sm">
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={crumb} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-ink-900/30">/</span>}
                <span className={isLast ? "font-semibold text-ink-900" : "text-ink-900/50"}>{crumb}</span>
              </span>
            );
          })}
        </nav>
      )}

      {/* Pestañas — texto simple con subrayado, mismo patrón que Planilla
          (ver planilla-client.tsx), en vez de las pastillas grises viejas. */}
      <div className="flex items-center gap-[22px] border-b border-ink-900/8">
        {TABS.map(({ value, label }) => {
          const isActive = tab === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={
                isActive
                  ? "pb-[10px] text-[13.5px] font-semibold text-walnut border-b-2 border-walnut"
                  : "pb-[11px] text-[13.5px] font-medium text-ink-900/40 hover:text-ink-900/60"
              }
            >
              {label}
            </button>
          );
        })}
      </div>

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
        <TabsContent value="dashboard" className="pt-0">
          <ContractorsDashboardView input={dashboard} />
        </TabsContent>
        <TabsContent value="directory" className="pt-0">
          <ContractorDirectory contractors={contractors} />
        </TabsContent>
        <TabsContent value="projects" className="pt-0">
          <ProjectsView projects={projects} />
        </TabsContent>
        <TabsContent value="rates" className="pt-0">
          <LaborRatesView rates={laborRates} />
        </TabsContent>
      </Tabs>

      <ContractorFormDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
