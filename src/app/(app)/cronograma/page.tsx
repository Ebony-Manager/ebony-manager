"use client";

import { Calendar } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

export default function CronogramaPage() {
  const { lang } = useLang();
  return <ComingSoon icon={Calendar} name={t(lang, strings.nav.cronograma)} />;
}
