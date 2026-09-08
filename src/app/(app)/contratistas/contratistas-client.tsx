"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import type { ContractorWithBalance } from "@/types/contractors";
import { Button } from "@/components/ui/button";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { ContractorDirectory } from "./contractor-directory";
import { ContractorFormDialog } from "./contractor-form-dialog";

/**
 * Chrome del módulo Contratistas (Etapa 1 · C1): encabezado, "Agregar
 * contratista" y el directorio. Sin tabs — el estado de cuenta vive en
 * la ficha de cada contratista.
 */
export function ContratistasClient({ contractors }: { contractors: ContractorWithBalance[] }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  const [addOpen, setAddOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{tt("title")}</h1>
          <p className="text-sm text-muted-foreground">{tt("subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" />
          {tt("add_contractor")}
        </Button>
      </div>

      <ContractorDirectory contractors={contractors} />

      <ContractorFormDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
