/** Siglas que se quedan en mayúsculas al pasar un texto a formato normal. */
const KEEP = new Set(["TV", "LED", "MDF", "PH", "PVC", "USB", "WC"]);

/**
 * Un nombre escrito todo en mayúsculas («MUEBLE DE TV», «REC. SECUNDARIA») pasa a formato normal («Mueble de TV»,
 * «Rec. secundaria»); lo que ya viene con mayúsculas y minúsculas se respeta tal cual.
 */
export function tidyCase(raw: string): string {
  const s = raw.replace(/\s+/g, " ").trim();
  const letters = s.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, "");
  if (letters.length < 3 || s !== s.toLocaleUpperCase("es")) return s;
  const out = s
    .split(" ")
    .map((w) => (KEEP.has(w.replace(/[^A-ZÁÉÍÓÚÑÜ]/g, "")) ? w : w.toLocaleLowerCase("es")))
    .join(" ");
  return out.charAt(0).toLocaleUpperCase("es") + out.slice(1);
}
