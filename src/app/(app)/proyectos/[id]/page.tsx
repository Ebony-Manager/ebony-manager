import { notFound } from "next/navigation";

import { requireAnyModule } from "@/lib/auth/dal";
import { getIncomingItems, getStoredItems } from "@/services/guardado";
import { hasModule, isDesignerView } from "@/lib/auth/modules";
import { getContractors, getContracts, getLaborRates, getProject, getProjects } from "@/services/contractors";
import { getInspectionPainters, getProjectInspections } from "@/services/inspections";
import { getProjectSupplies } from "@/services/almacen";
import { driveEnabled } from "@/lib/google/drive";
import { getClients } from "@/services/ventas";
import { getProjectQuotes } from "@/services/cotizador";
import { getProjectDeliveries, getUnassignedDeliveries } from "@/services/deliveries";
import { getDesignerCandidates, getDesignerProjectQuotes, getProjectDesigners } from "@/services/project-designers";
import { getProjectItems, quoteItemsPending } from "@/services/diseno";
import { getTallerPainters, getTallerPeople, getTallerProjects, getVeneerTypes, getWorkOrders, withProjectNames } from "@/services/taller";
import { ProjectHub } from "./project-hub";
import { getOrderSummaries } from "@/services/produccion";

// La ficha de un proyecto: el lugar desde donde se llega a todo lo de la
// obra. Cada sección pide su módulo (Contratos pide Contratistas;
// Inspecciones, Inspecciones; Suministros lo ve todo el que entra a la ficha) y
// acá solo se carga lo de los módulos que el usuario tiene.
export const dynamic = "force-dynamic";

const none = <T,>(value: T) => Promise.resolve(value);

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await requireAnyModule("proyectos", "contratistas", "diseno");
  const designerView = isDesignerView(profile);
  const canContracts = hasModule(profile, "contratistas");
  const canInspections = hasModule(profile, "inspecciones");
  const canQuotes = hasModule(profile, "cotizacion");
  const canTaller = hasModule(profile, "taller");
  const canStored = hasModule(profile, "almacen") || hasModule(profile, "diseno") || hasModule(profile, "proyectos");
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);

  const project = await getProject(id);
  if (!project) notFound();

  const [contracts, contractors, projects, laborRates, inspections, painters, supplies, clients, quotes, deliveries, unassigned, designers, designerCandidates, designerQuotes, taller, design, stored] = await Promise.all([
    canContracts ? getContracts({ projectId: id }) : none([]),
    canContracts ? getContractors() : none([]),
    canContracts ? getProjects() : none([]),
    canContracts ? getLaborRates() : none([]),
    canInspections ? getProjectInspections(id) : none([]),
    canInspections ? getInspectionPainters() : none([]),
    designerView ? none([]) : getProjectSupplies(id),
    project.designerId || project.clientId ? getClients().catch(() => []) : none([]),
    canQuotes ? getProjectQuotes(id) : none([]),
    getProjectDeliveries(id).catch(() => []),
    designerView ? none([]) : getUnassignedDeliveries().catch(() => []),
    getProjectDesigners(id).catch(() => []),
    designerView ? none([]) : getDesignerCandidates().catch(() => []),
    designerView ? getDesignerProjectQuotes(id).catch(() => []) : none([]),
    canTaller
      ? Promise.all([getWorkOrders({ projectId: id }), getTallerPeople(), getTallerProjects(), getTallerPainters(), getVeneerTypes()])
          .then(([orders, people, projects, painters, veneers]) => ({ orders: withProjectNames(orders, projects), people, projects, painters, veneers }))
          .catch(() => null)
      : none(null),
    Promise.all([getProjectItems(id), quoteItemsPending(id), getOrderSummaries({ projectId: id }).catch(() => [])])
      .then(([items, pendingFromQuote, orders]) => ({ items, pendingFromQuote, orders }))
      .catch(() => null),
    canStored
      ? Promise.all([getStoredItems(id), getIncomingItems(id)])
          .then(([items, incoming]) => ({ items, incoming }))
          .catch(() => null)
      : none(null),
  ]);
  const nameOf = (cid: string | null) => (cid ? (clients.find((c) => c.id === cid)?.name ?? null) : null);

  return (
    <ProjectHub
      project={project}
      initialTab={tab}
      canContracts={canContracts}
      contracts={contracts}
      contractors={contractors.map((c) => ({ id: c.id, name: c.name, contractorType: c.contractorType }))}
      projects={projects}
      laborRates={laborRates}
      canInspections={canInspections}
      inspections={inspections}
      painters={painters}
      supplies={supplies}
      drive={{ enabled: driveEnabled(), folderId: project.driveFolderId ?? null }}
      canQuotes={canQuotes}
      quotes={quotes}
      deliveries={deliveries}
      unassignedDeliveries={unassigned}
      projectPeople={{ designer: nameOf(project.designerId), client: nameOf(project.clientId) }}
      designerView={designerView}
      designers={designers}
      designerCandidates={designerCandidates}
      designerQuotes={designerQuotes}
      taller={taller}
      design={design}
      stored={stored}
    />
  );
}
