"use client";

import * as React from "react";

/**
 * Mapa empleado -> URL firmada de su foto, disponible para todas las
 * pantallas de Planilla sin pasarlo por props. `EmployeeAvatar` lo lee: si
 * hay foto la muestra, si no, la inicial de siempre.
 */
const PhotosContext = React.createContext<Record<string, string>>({});

export function EmployeePhotosProvider({
  photoUrls,
  children,
}: {
  photoUrls: Record<string, string>;
  children: React.ReactNode;
}) {
  return <PhotosContext.Provider value={photoUrls}>{children}</PhotosContext.Provider>;
}

export function useEmployeePhoto(employeeId: string): string | null {
  return React.useContext(PhotosContext)[employeeId] ?? null;
}
