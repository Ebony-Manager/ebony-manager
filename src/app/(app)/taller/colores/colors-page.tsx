"use client";

import { useRouter } from "next/navigation";

import { BackLink, PAGE_CLASS, PageHeader } from "@/components/shared/page-header";
import type { TallerPainter, VeneerType, WorkOrder } from "@/types/taller";
import { ColorsList } from "../colors-view";
import { useTt } from "../shared";

/** Historial de colores: se busca un color y, al tocarlo, se abre su solicitud en Taller. */
export function ColorsPage({ orders, painters, veneers }: { orders: WorkOrder[]; painters: TallerPainter[]; veneers: VeneerType[] }) {
  const { tt } = useTt();
  const router = useRouter();
  return (
    <div className={PAGE_CLASS}>
      <BackLink href="/taller" label={tt("back_taller")} />
      <PageHeader title={tt("colors_title")} subtitle={tt("colors_subtitle")} />
      <ColorsList orders={orders} painters={painters} veneers={veneers} onOpen={(id) => router.push(`/taller?trabajo=${id}`)} />
    </div>
  );
}
