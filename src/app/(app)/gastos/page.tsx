"use client";

import { DollarSign } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

export default function GastosPage() {
  const { lang } = useLang();
  return <ComingSoon icon={DollarSign} name={t(lang, strings.nav.gastos)} />;
}
