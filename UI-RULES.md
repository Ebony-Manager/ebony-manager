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
| Un campo con su título | `<Field label required? error? icon? hint?>` — el único 🛡️ | `shared/field` |
| Un bloque de una ficha de lectura (empleado, contratista): tarjeta con ícono, título, línea de apoyo y la acción a la derecha | `<ProfileCard icon title subtitle? action?>` — todos los bloques de una ficha lo usan; la acción principal es el botón relleno y las secundarias, de borde | `shared/profile-card` |
| Un grupo de campos o un bloque de una ficha, con ícono y título | `<FormSection icon title note? action? quiet?>` 🛡️ | `shared/form-section` |
| Un estado (sin stock, bajo stock, pendiente…) | `<StatusBadge status>` y, en el filtro, el mismo ícono y tono (`STATUS`, `TONE_TEXT`) | `shared/status-badge`, `lib/ui/status` |
| Validar un formulario | `useFormErrors` + `<Field error>` | `lib/ui/use-form-errors` |
| Cerrar un diálogo con cosas escritas | `useDiscardGuard` | `shared/discard-guard` |
| El ícono de un concepto (proyecto, cliente, responsable, fecha…) | `ICON.x` | `lib/ui/concepts` |
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
- **Todo campo lleva su título arriba**, siempre (`<Field>`). El texto de adentro (placeholder) es solo un ejemplo, nunca el título: un campo de "Notas" no dice "Notas" por dentro. Sin excepciones: una fila repetida (contactos de una firma) es una tarjeta con sus campos titulados, no cuatro cajas con texto adentro.
- **Obligatorio = asterisco rojo junto al título** (`required`). Lo opcional no se marca: no se escribe «opcional» en ninguna parte 🛡️. En un "uno u otro" (arquitecto o cliente) ninguno lleva asterisco; el grupo dice "al menos uno".
- **El ícono va DENTRO del campo**, a la izquierda y tenue (`icon={ICON.owner}`), y el título queda limpio. Si el concepto está en `lib/ui/concepts.ts` se usa; si no, el campo no lleva ícono. Quien se encarga de algo (responsable, quien recibe) = persona.
- **Los campos de texto largo (Notas, descripción) no llevan ícono**: solo el título de arriba.
- **Pie de un diálogo: Cancelar a la izquierda y Guardar a la derecha, uno al lado del otro, también en el teléfono** (ahí cada uno ocupa media fila). Se usa siempre `DialogFooter`; las acciones secundarias (Aprobar, Eliminar…) van en su propia fila arriba en el teléfono y a la izquierda en escritorio.
- **En el teléfono (< 480 px) los campos de un bloque van uno por fila**: un campo con ícono y una fecha necesitan ancho; en dos columnas el valor se corta.
- **Estados con ícono y tono, definidos una sola vez** (`lib/ui/status.ts`). La etiqueta de una fila y la opción del filtro del mismo estado usan el mismo ícono y tono; el color nunca es la única señal.
- **Las acciones de un bloque van en su encabezado** (`action=` de `FormSection`), no sueltas debajo.
- **Lo secundario o ya lleno por defecto** va en un `FormSection quiet` (fondo tenue) para que lo principal resalte.
- **Web y celular iguales**: se prueba en 390 px de ancho además de escritorio. Las cuadrículas de formulario llevan `min-w-0` en cada celda (ya lo trae `Field`).
- **Textos en `src/lib/i18n.ts`**, siempre en español e inglés.

## 3. Validación de formularios

- **Se valida al tocar Guardar y se muestran TODOS los errores a la vez**: cada campo que falla se marca en rojo con su mensaje debajo (`<Field error>`), la pantalla baja al primero y el error desaparece cuando se corrige ese campo. Se usa `useFormErrors().validate([...])` 🛡️.
- **El botón Guardar no se desactiva** por campos vacíos: así se ve qué falta. Solo se desactiva mientras guarda.
- **Lo que falla en el servidor** (no se pudo guardar) va en un aviso (`toast.error`), no como mensaje rojo al final del formulario.
- **El formulario valida lo mismo que exige la base de datos**: la persona nunca debe ver un mensaje técnico de la base.
- **Un mensaje, una redacción**: cortos y concretos ("Falta el nombre.", "Elige el motivo de pérdida.").
- **Cambios sin guardar**: al cerrar un diálogo con cosas escritas (tocar afuera, Cancelar, Esc) se pregunta "¿Descartar los cambios?" (`useDiscardGuard`). Al guardar bien se cierra sin preguntar.

## 4. Protocolo para toda pantalla nueva o cambiada

1. **Antes de escribir**: ¿hay un componente de la tabla de arriba? Úsalo. ¿Lo que voy a repetir no existe? Créalo en `shared/` y documéntalo aquí.
2. **Mientras escribes**: nada de `border-dashed`, `<h3 className="text-sm font-semibold…">`, `function Field`, `<input type="date">`, «opcional» en un campo, `setError(...)` ni colores literales; la guardia los rechaza (o no los deja crecer, en lo que falta migrar).
3. **Antes de publicar** (siempre, en este orden): `npx tsc --noEmit -p .` → `npx eslint src` → `npx vitest run` (incluye la guardia) → `next build` → captura en escritorio y en 390 px.
4. **Si hay que cambiar el aspecto de algo** (por ejemplo, el vacío): se cambia el componente compartido, una vez, y toda la app lo sigue. Si cambias solo una pantalla, estás creando la inconsistencia que esto evita.
5. **Caso legítimo que la guardia rechaza** (zona de arrastre, botón de agregar foto): se marca esa línea con un comentario `ui-allow: motivo`. No se apaga la regla.
6. **Regla nueva**: cuando aparezca una inconsistencia que no estaba vigilada, se arregla en todas partes, se agrega aquí y se agrega a la guardia.
