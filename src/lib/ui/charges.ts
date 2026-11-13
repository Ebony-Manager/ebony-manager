import { Banknote, Car, HandCoins, Landmark, ReceiptText, TriangleAlert, Wrench, type LucideIcon } from "lucide-react";

import type { LoanCategory } from "@/types/planilla";

/** El ícono de cada tipo de préstamo o descuento: el mismo en el alta, en el filtro y en las listas. */
export const CHARGE_ICON: Record<LoanCategory, LucideIcon> = {
  prestamo: HandCoins,
  adelanto: Banknote,
  herramienta: Wrench,
  dano: TriangleAlert,
  indrive: Car,
  otro: ReceiptText,
  tercero: Landmark,
};
