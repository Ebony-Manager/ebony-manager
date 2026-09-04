"use client";

import { FileText } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

// Cotización is being rebuilt from scratch on this base — the old
// implementation (table, PDF export, plan uploader, Sheets read/write) is
// archived at _legacy/src/pages/Cotizacion.jsx as reference, not ported.
export default function CotizacionPage() {
  const { lang } = useLang();
  return <ComingSoon icon={FileText} name={t(lang, strings.nav.cotizacion)} />;
}
