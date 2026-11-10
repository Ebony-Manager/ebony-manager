/** Un acta de entrega (formulario de JotForm) de un proyecto. */
export interface ProjectDelivery {
  id: string;
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
