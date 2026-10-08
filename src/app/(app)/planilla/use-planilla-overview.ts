"use client";

import * as React from "react";

import { getPlanillaOverviewAction } from "./actions";

type Overview = Awaited<ReturnType<typeof getPlanillaOverviewAction>>;

/**
 * Datos del Dashboard en UNA sola llamada al servidor (resumen anual,
 * obligaciones, saldos de préstamos a la fecha y composición mensual). Si falla, `failed` es true
 * y la pantalla puede mostrar "Reintentar" en vez de quedarse en blanco o
 * mostrar ceros como si no hubiera datos.
 */
export function usePlanillaOverview(year: number) {
  const [data, setData] = React.useState<(Overview & { year: number }) | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    getPlanillaOverviewAction(year)
      .then((o) => {
        if (cancelled) return;
        setData({ ...o, year });
        setFailed(false);
      })
      .catch((err) => {
        console.error("Planilla: no se pudo cargar el resumen", err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [year, attempt]);

  const current = data && data.year === year ? data : null;
  return {
    rows: current?.rows ?? null,
    obligations: current?.obligations ?? null,
    balances: current?.balances ?? ({} as Record<string, number>),
    composition: current?.composition ?? null,
    failed,
    retry: () => {
      setFailed(false);
      setAttempt((a) => a + 1);
    },
  };
}
