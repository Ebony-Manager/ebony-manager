"use client";

import { Folder } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

export default function ProyectosPage() {
  const { lang } = useLang();
  return <ComingSoon icon={Folder} name={t(lang, strings.nav.proyectos)} />;
}
