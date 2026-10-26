/**
 * Mientras llega una pantalla de la app: un esqueleto con la forma de
 * siempre (título, filtros, lista), en vez de dejar la pantalla anterior
 * quieta. Las barras de navegación quedan en su lugar; la barra fina de
 * arriba (navigation-progress.tsx) acompaña la espera.
 */
export default function Loading() {
  const block = "animate-pulse rounded-md bg-muted";
  return (
    <div className="flex flex-col gap-5 px-4 pt-4 pb-10 sm:px-7 sm:pt-6" aria-busy="true">
      <div className="flex flex-col gap-2">
        <div className={`${block} h-3 w-28`} />
        <div className={`${block} h-6 w-56`} />
        <div className={`${block} h-3.5 w-full max-w-md`} />
      </div>
      <div className="flex gap-2">
        <div className={`${block} h-9 flex-1 sm:max-w-xs`} />
        <div className={`${block} h-9 w-24`} />
      </div>
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className={`${block} h-14`} style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    </div>
  );
}
