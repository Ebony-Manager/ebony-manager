/** Un acta de entrega (formulario de JotForm) de un proyecto. */
import type { DeliveryKind } from "@/lib/deliveries/acta-form";

/** Un acta de entrega o una autorización a pintura / embalaje de un proyecto (formularios de JotForm). */
export interface ProjectDelivery {
  id: string;
  kind: DeliveryKind;
  approvedBy: string | null;
  receivedBy: string | null;
  notes: string | null;
  details: Record<string, string>;
  projectId: string | null;
  projectName: string;
  deliveredOn: string;
  clientName: string | null;
  clientEmail: string | null;
  clientIdDoc: string | null;
  address: string | null;
  items: string | null;
  photoCount: number;
  driveFolderId: string | null;
  pdfFileId: string | null;
  filesError: string | null;
  createdAt: string;
}
