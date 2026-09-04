"use client";

import type { LucideIcon } from "lucide-react";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

/** Placeholder for every module route — including Cotización, which is
 *  being rebuilt from scratch on this base rather than ported (see
 *  _legacy/ for the old implementation, kept as reference). */
export function ComingSoon({ icon: Icon, name }: { icon: LucideIcon; name: string }) {
  const { lang } = useLang();

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-ebony-gray/30 flex items-center justify-center mb-4">
        <Icon className="text-ebony-medium" size={28} />
      </div>
      <h2 className="text-lg font-semibold text-ebony-dark">{name}</h2>
      <p className="text-ebony-light text-sm mt-1">{t(lang, strings.common.comingSoon)}</p>
    </div>
  );
}
