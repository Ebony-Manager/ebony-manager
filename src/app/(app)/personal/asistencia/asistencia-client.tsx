"use client";

import { PAGE_CLASS, PageHeader } from "@/components/shared/page-header";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { AsistenciaView } from "../../planilla/asistencia-view";

export function AsistenciaClient({ canPayroll }: { canPayroll: boolean }) {
  const { lang } = useLang();
  return (
    <div className={PAGE_CLASS}>
      <PageHeader title={t(lang, strings.nav.asistencia)} subtitle={t(lang, strings.pagos.sub_asistencia_only)} />
      <AsistenciaView canPayroll={canPayroll} onApplied={() => undefined} />
    </div>
  );
}
