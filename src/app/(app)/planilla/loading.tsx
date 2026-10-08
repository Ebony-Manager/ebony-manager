import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto instantáneo de Planilla mientras el servidor termina: al
 *  cambiar de pantalla se ve respuesta de inmediato en vez de una pantalla
 *  quieta. (El perfil del empleado tiene el suyo en [id]/loading.tsx.) */
export default function PlanillaLoading() {
  return (
    <div className="flex flex-col gap-4 px-7 pt-6 pb-10" aria-busy="true">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-8 w-full max-w-md" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
