/**
 * Las muestras de pintura se hacen los sábados (decisión de Carlos, 18 nov): lo que entra hasta el miércoles va al
 * sábado de esa semana; lo que entra de jueves en adelante, al sábado de la semana siguiente. Fecha en YYYY-MM-DD.
 */
export function nextSampleSaturday(todayIso: string): string {
  const [y, m, d] = todayIso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay(); // 0 domingo … 6 sábado
  const days = 6 - dow + (dow >= 4 ? 7 : 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
