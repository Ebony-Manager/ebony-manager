# UI-RULES.md — Reglas de interfaz de Ebony Manager

> **Una sola forma de hacer cada cosa.** Si lo que necesitas ya tiene componente,
> se usa. Si no lo tiene y lo vas a repetir en dos lugares, primero se crea en
> `src/components/shared/` y después se usa. Nunca se copia el estilo a mano.
> Las reglas marcadas con 🛡️ las vigila la prueba `src/ui-consistency.test.ts`
> (corre con `npx vitest run`): si se rompen, la prueba falla y dice la línea.

## 1. Qué componente va para qué

| Necesito… | Uso | Dónde |
|---|---|---|
| "Todavía no hay nada" / "no hay resultados" / "no se pudo cargar" | `<EmptyState>` (`size="page"` si es toda la vista) 🛡️ | `shared/page-header` |
| Un campo con su título | `<Field label hint? optional?>` — el único 🛡️ | `shared/field` |
| Un grupo de campos o un bloque de una ficha, con ícono y título | `<FormSection icon title note? action? quiet?>` 🛡️ | `shared/form-section` |
| Un ícono dentro del campo (ubicación, celular, correo) | `<WithIcon icon>` | `shared/form-section` |
| Fecha u hora | `<Input type="date">` — nunca `<input>` crudo 🛡️ | `ui/input` |
| Elegir entre pocas opciones / filtros | `<SegmentedFilter>` (con ícono en cada opción si lo hay) | `shared/page-breadcrumb` |
| "Mostrar inactivos / historial" | `<ShowToggle>` | `shared/page-header` |
| Encabezado de página, "volver", pestañas | `PageHeader`, `BackLink`, `SubTabs` | `shared/page-header` |
| Tarjeta de cifra | `<KpiCard>` | `shared/kpi-card` |
| Borrar / cancelar / acción destructiva | `<ConfirmButton>` (dos toques, rojo) — nunca `window.confirm` 🛡️ | `shared/confirm-button` |
| Archivos de Drive | `<DriveFiles>` | `shared/drive-files` |

## 2. Reglas de estilo

- **Colores del tema**, nunca literales: `bg-primary`, `text-muted-foreground`, `text-destructive`… 🛡️ (la paleta de Tailwind no puede crecer).
- **Un concepto, un ícono: el del menú principal.** Proyecto = `Folder`, Cliente = `User`, Firma/arquitecto = `Building2`, Cotización = `FileText`, Oportunidad/seguimiento = `Waypoints`. No se inventan variantes (`FolderKanban`) 🛡️.
- **El ícono va donde ayuda a reconocer**: en el encabezado de cada grupo, en filtros, pestañas y dentro de campos evidentes (ubicación, celular, correo, fecha). No en el título de cada campo.
- **Un solo texto por campo**: título arriba, y el "ejemplo" como placeholder solo si aporta. "Opcional" va al lado del título (`optional=`), no dentro del campo.
- **Las acciones de un bloque van en su encabezado** (`action=` de `FormSection`), no sueltas debajo.
- **Lo secundario o ya lleno por defecto** va en un `FormSection quiet` (fondo tenue) para que lo principal resalte.
- **Web y celular iguales**: se prueba en 390 px de ancho además de escritorio. Las cuadrículas de formulario llevan `min-w-0` en cada celda (ya lo trae `Field`).
- **Textos en `src/lib/i18n.ts`**, siempre en español e inglés.

## 3. Protocolo para toda pantalla nueva o cambiada

1. **Antes de escribir**: ¿hay un componente de la tabla de arriba? Úsalo. ¿Lo que voy a repetir no existe? Créalo en `shared/` y documéntalo aquí.
2. **Mientras escribes**: nada de `border-dashed`, `<h3 className="text-sm font-semibold…">`, `function Field`, `<input type="date">` ni colores literales; la guardia los rechaza.
3. **Antes de publicar** (siempre, en este orden): `npx tsc --noEmit -p .` → `npx eslint src` → `npx vitest run` (incluye la guardia) → `next build` → captura en escritorio y en 390 px.
4. **Si hay que cambiar el aspecto de algo** (por ejemplo, el vacío): se cambia el componente compartido, una vez, y toda la app lo sigue. Si cambias solo una pantalla, estás creando la inconsistencia que esto evita.
5. **Caso legítimo que la guardia rechaza** (zona de arrastre, botón de agregar foto): se marca esa línea con un comentario `ui-allow: motivo`. No se apaga la regla.
6. **Regla nueva**: cuando aparezca una inconsistencia que no estaba vigilada, se arregla en todas partes, se agrega aquí y se agrega a la guardia.
