"use client";

import { Palette } from "lucide-react";

import { PAGE_CLASS, PageHeader } from "@/components/shared/page-header";
import { FormSection } from "@/components/shared/form-section";
import type { TallerPainter, VeneerType } from "@/types/taller";
import { PaintersView } from "@/app/(app)/taller/painters-view";
import { useTt } from "@/app/(app)/taller/shared";

/** Settings → Formularios: una sección por formulario con lo que se puede configurar de él. */
export function FormulariosClient({ painters, veneers }: { painters: TallerPainter[]; veneers: VeneerType[] }) {
  const { tt } = useTt();
  return (
    <div className={PAGE_CLASS}>
      <PageHeader title={tt("forms_title")} subtitle={tt("forms_subtitle")} />
      <FormSection icon={Palette} title={tt("form_samples")} note={tt("form_samples_note")}>
        <PaintersView painters={painters} veneers={veneers} />
      </FormSection>
    </div>
  );
}
