"use client";

import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

import type { DirectoryPerson } from "@/types/staff-directory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/planilla/format";
import { countryName } from "@/lib/countries";
import { STAFF_PATH } from "@/lib/personal/paths";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { ContractorAvatar } from "../../contratistas/contractor-avatar";
import { documentLabel } from "./download-documents";

/**
 * Ficha de una persona para quien tiene el permiso Personal pero no el
 * dinero de su lista (Planilla para empleados, Contratistas para
 * contratistas): solo identificación, contacto y documento. Solo lectura.
 */
export function StaffReadOnlyProfile({ person }: { person: DirectoryPerson }) {
  const { lang } = useLang();
  const td = (k: keyof typeof strings.documentos) => t(lang, strings.documentos[k]);
  const g = `group_${person.group}` as keyof typeof strings.documentos;
  const group = g in strings.documentos ? td(g) : person.group;
  const doc = documentLabel(person, td("type_cedula"), td("type_pasaporte"));

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start text-muted-foreground">
        <Link href={STAFF_PATH}>
          <ArrowLeft className="size-3.5" />
          {t(lang, strings.common.back)}
        </Link>
      </Button>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <ContractorAvatar name={person.name} photoUrl={person.photoUrl} size="xl" />
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-foreground">
              {person.name}
              {!person.active && <Badge variant="secondary">{td("inactive")}</Badge>}
            </h1>
            <p className="text-sm text-muted-foreground">{person.position ? `${person.position} · ${group}` : group}</p>
          </div>
        </div>
      </Card>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Item
            label={td("f_document")}
            empty={td("not_set")}
            value={
              doc || person.documentUrl ? (
                <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  {doc || td("not_set")}
                  {person.documentUrl && (
                    <a href={person.documentUrl} target="_blank" rel="noreferrer" title={td("open_document")} className="block shrink-0">
                      {person.documentIsPdf ? (
                        <span className="flex h-6 items-center gap-1 rounded-sm border border-border px-1.5 text-xs text-muted-foreground hover:bg-muted/40">
                          <FileText className="size-3.5" />
                          PDF
                        </span>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage; next/image no aplica.
                        <img src={person.documentUrl} alt={td("open_document")} className="h-6 w-9 rounded-sm border border-border object-cover hover:opacity-80" />
                      )}
                    </a>
                  )}
                </span>
              ) : null
            }
          />
          <Item label={td("f_nationality")} empty={td("not_set")} value={person.nationality ? countryName(person.nationality, lang) : null} />
          <Item label={td("f_birth")} empty={td("not_set")} value={person.birthDate ? formatDate(lang, person.birthDate) : null} />
          <Item label={td("f_phone")} empty={td("not_set")} value={person.phone} />
          <Item label={td("f_email")} empty={td("not_set")} value={person.email} />
          <Item label={td("f_address")} empty={td("not_set")} value={person.address} />
          <Item
            label={td("f_emergency")}
            empty={td("not_set")}
            value={[person.emergencyContactName, person.emergencyContactPhone].filter(Boolean).join(" · ") || null}
          />
          <Item label={td("f_start")} empty={td("not_set")} value={person.startDate ? formatDate(lang, person.startDate) : null} />
        </dl>
      </section>
    </div>
  );
}

function Item({ label, value, empty }: { label: string; value: React.ReactNode; empty: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={value ? "break-words text-foreground" : "text-muted-foreground/70"}>{value || empty}</dd>
    </div>
  );
}
