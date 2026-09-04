"use client";

import { BarChart2 } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

export default function DashboardPage() {
  const { lang } = useLang();
  return <ComingSoon icon={BarChart2} name={t(lang, strings.nav.dashboard)} />;
}
