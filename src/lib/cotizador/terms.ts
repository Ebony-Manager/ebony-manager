/**
 * Condiciones generales de Ebony (documento "Terminos_y_Condiciones_Ebony",
 * nov 2026). Van al final de cada cotización: en la vista para el cliente y
 * en el PDF. `**texto**` = negrita. Son las de partida: se editan en
 * Settings → Cotizaciones (`app_settings.quote_terms`).
 */

export interface TermsSection {
  title: string;
  items: (string | { text: string; sub: string[] })[];
}

export const TERMS_TITLE = "Condiciones Generales – Ebony | Custom Woodwork";

export const TERMS_INTRO =
  "Al realizar el abono inicial, el cliente declara haber leído, entendido y aceptado en su totalidad los presentes términos y condiciones.";

export const TERMS: TermsSection[] = [
  {
    title: "1. Diseño y Desarrollo",
    items: [
      "El proyecto inicia tras la aprobación formal de la cotización y el abono inicial.",
      "Incluye reuniones, visitas técnicas (cuando aplique), y la elaboración de planos constructivos.",
      "El cliente podrá solicitar hasta **dos (2) rondas de cambios** sin costo adicional. Cambios adicionales tendrán un cargo según complejidad.",
      "La aprobación escrita de planos (por correo o firma) representa la autorización para iniciar producción. No se aceptan cambios posteriores sin impacto en costos y tiempos.",
      "Antes de proceder a producción, **se rectificarán las medidas en sitio**. La cotización puede **variar** en función de estos ajustes o del diseño final.",
      "En caso de que el cliente desee **eliminar un ítem ya abonado**, se podrá aplicar un cargo por **costos ya incurridos en diseño, planificación o medición técnica.**",
      "En caso de que el cliente decida reducir el alcance del proyecto una vez iniciado, la cotización será revisada en función del nuevo volumen. En caso de haberse aplicado un descuento basado en el volumen original, dicho descuento podrá ser ajustado o eliminado conforme al nuevo alcance, y el proyecto será recotizado según las condiciones vigentes para el nuevo volumen.",
    ],
  },
  {
    title: "2. Producción y Ejecución",
    items: [
      "El plazo de producción y entrega comenzará a contarse únicamente a partir de la aprobación escrita de los planos constructivos finales por parte del cliente.",
      "Los materiales y acabados se fabrican conforme a lo aprobado. Cambios posteriores se cotizarán por separado y pueden afectar los tiempos de entrega.",
      'Durante el desarrollo del proyecto pueden surgir **modificaciones o solicitudes adicionales ("extras")**. Estos serán cotizados y deberán ser **pagados al 100%** antes de su ejecución.',
      "Ebony se reserva el derecho de realizar ajustes técnicos que no alteren la estética ni funcionalidad del diseño.",
      "Materiales como la chapilla pueden presentar diferencias de tono y vetas propias de su naturaleza. Estas variaciones no se consideran defectos, sino características inherentes del material.",
      "No nos hacemos responsables por **desniveles, desplomes de paredes, techos o pisos**, que puedan afectar la instalación y por ende el resultado final de la entrega.",
      "En proyectos de ejecución extendida, los precios cotizados aplican para los ítems cuya producción inicie dentro de un plazo razonable desde la aprobación. En caso de que incrementos documentados en los costos de materia prima por parte de nuestros proveedores afecten ítems aún no iniciados en producción, Ebony se reserva el derecho de trasladar dicho ajuste al cliente. El incremento será notificado con anticipación y respaldado con documentación del proveedor.",
    ],
  },
  {
    title: "3. Entrega e Instalación",
    items: [
      "La instalación debe ser coordinada con antelación. El sitio debe contar con **electricidad funcional** para operar.",
      "El **acceso al área de trabajo debe estar completamente despejado** al momento de la instalación.",
      "**Ebony no realiza desmontaje de mobiliario existente**, salvo que haya sido expresamente cotizado. De requerirse despejar el área o desinstalar elementos existentes, se generará un **cargo adicional**.",
      "Todo trabajo **previo a nuestra llegada** debe estar completado (remoción de zócalos, refuerzos estructurales, extensiones eléctricas, etc.). De no estarlo, se pueden generar **costos adicionales** y retrasos.",
      "Si no se permite el ingreso al sitio en la fecha pactada (por falta de reserva de ascensor, acceso bloqueado o falta de coordinación), se aplicará un cargo de **$150** por costos logísticos.",
      "El cliente deberá informar con anticipación sobre la existencia de tuberías, cañerías u otras instalaciones ocultas en las paredes, pisos o techos del área de instalación. En caso de producirse una perforación accidental durante los trabajos de instalación por falta de esta información, la reparación correrá por cuenta del cliente.",
      "Los trabajos de carpintería e instalación son de naturaleza intrusiva. A pesar de las medidas de protección que Ebony implementa, no nos hacemos responsables por roces, manchas, polvo o daños menores a pintura, pasteo u otras superficies aledañas al área de trabajo. De requerirse retoque de pintura u otros acabados post-instalación, este costo no está incluido salvo que se haya cotizado expresamente.",
      "Ebony incluye el traslado del mobiliario hasta el área de instalación. En caso de que las dimensiones de las piezas excedan la capacidad del ascensor y se requiera el uso de grúa, escaleras u otros medios alternativos, el costo de dichos servicios correrá por cuenta del cliente.",
      {
        text: "Ebony **no realiza** trabajos de:",
        sub: [
          "**Plomería:** movimiento de tuberías o instalaciones hidráulicas.",
          "**Electricidad:** cableado, reubicación de tomacorrientes o salidas especiales.",
          "**Albañilería:** pintura, pasteo, modificaciones de paredes, techos o zócalos.",
          "**Superficies:** no incluye sobres de piedra, granito u otros, salvo que se especifique.",
          "**Herrajes y tiradores:** sólo se incluyen si están claramente descritos en la cotización.",
        ],
      },
      "**Todo lo que no esté explícitamente detallado en la cotización, no está incluido.**",
    ],
  },
  {
    title: "4. Garantía",
    items: ["Cualquier reclamo por garantía será evaluado según nuestro **manual de cuidado y mantenimiento**, el cual se entrega al finalizar el proyecto."],
  },
  {
    title: "5. Condiciones de Pago",
    items: [
      "**50% al aceptar la cotización**, un **40% previo a la entrada a sitio**, y el **10% restante al finalizar la instalación.**",
      "Pagos fuera de término pueden generar recargos y afectar el cronograma del proyecto.",
    ],
  },
];

/** "a **b** c" → [{ text: "a ", bold: false }, { text: "b", bold: true }, { text: " c", bold: false }]. */
export function richSegments(text: string): { text: string; bold: boolean }[] {
  return text
    .split("**")
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((s) => s.text.length > 0);
}
