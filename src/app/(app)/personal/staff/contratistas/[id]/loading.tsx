import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto instantáneo mientras carga el perfil del contratista: sin esto,
 *  al hacer click en un contratista la pantalla no cambia nada hasta que el
 *  servidor termina (parece que "no abre"). */
export default function ContractorProfileLoading() {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6" aria-busy="true">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
