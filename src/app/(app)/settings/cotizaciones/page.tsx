import { requireAdmin } from "@/lib/auth/dal";
import { getDocumentSettings, getSectionKinds } from "@/services/settings";
import { CotizacionesSettingsClient } from "./cotizaciones-client";

// Settings → Cotizaciones: datos de la empresa, datos para el pago y
// Condiciones Generales que salen en cada cotización. Solo admin; la RLS
// de `app_settings` repite la regla.
export const dynamic = "force-dynamic";

export default async function CotizacionesSettingsPage() {
  await requireAdmin();
  const [settings, kinds] = await Promise.all([getDocumentSettings(), getSectionKinds()]);
  return <CotizacionesSettingsClient settings={settings} kinds={kinds} />;
}
