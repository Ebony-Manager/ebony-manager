/**
 * Eje Y "bonito" para las gráficas del Dashboard: elige un paso redondo
 * (100, 250, 500, 1000, 2000…) para que el máximo del eje sea un múltiplo
 * limpio y haya entre 2 y 5 marcas. `maxValue` en dólares; devuelve las
 * marcas (empezando en 0) y el máximo del eje, también en dólares.
 */
const STEPS = [50, 100, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000];

export function niceAxis(maxValue: number, maxTicks = 5): { ticks: number[]; max: number; step: number } {
  const safe = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 0;
  const step = STEPS.find((s) => safe / s <= maxTicks) ?? STEPS[STEPS.length - 1];
  const max = Math.max(Math.ceil(safe / step), 1) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  return { ticks, max, step };
}
