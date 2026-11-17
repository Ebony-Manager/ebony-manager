# Plan: auditor de reglas (pendiente — retomar el miércoles 18 nov 2026)

> **Dónde vive (17 nov):** en **una sola sesión, «Diseño (barrido y auditor)»**, que **termina el barrido de diseño
> pendiente** (lista abajo) y **audita** lo ya hecho y lo nuevo. Cada **miércoles a las 8:59 (Panamá)** le llega un aviso;
> **pregunta primero a Carlos si hay uso disponible** y solo arranca con su sí. Carlos también le puede escribir cualquier día.
> Independencia: después de cada tanda de barrido, la sesión pide la revisión a un **revisor aparte (ayudante temporal con
> contexto limpio, no otra sesión)** que solo informa; así no se da por buena su propia obra.

## Cambios nuevos de la sesión de desarrollo (17 nov)
Cuando la sesión de desarrollo sube algo que **toca pantallas**, le manda un mensaje a esta sesión con qué cambió (commit y
pantallas). Esta sesión **no lo revisa en el momento**: lo **anota en `audits/PENDIENTES.md`** y lo revisa el **miércoles**
(o antes si Carlos lo pide). Los cambios solo de lógica, sin pantallas, no se avisan (igual los cubre el marcador).

## Barrido de diseño pendiente (traspasado desde la sesión de desarrollo, 17 nov)
Ya hecho: Compras, Almacén, Contratistas, Personal/Planilla (formularios, filtros, íconos, fichas, vacíos, carga, vocabulario
«Pendiente»). Componentes y patrones establecidos: `Field`, `FormSection`, `ProfileCard`, `EmptyState`, `LoadingBlock`,
`StatusBadge` + registro `STATUS`, `ICON`, `SegmentedFilter` con ícono, `ShowToggle`, `useFormErrors`, `useDiscardGuard` +
`useFormBaseline` (el aviso de descartar solo sale si hubo cambios), `FormDialog`. Guardia: `src/ui-consistency.test.ts`.

Falta, en tandas y con visto bueno de Carlos:
0. ~~**Almacén (restos)**~~ — **hecho 17 nov**: pedido con aviso de descartar; mensaje al proveedor marcado `ui-allow`;
   título del Resumen con `FormSection`; Revisión sin `router.refresh()` doble (es temporal: no se traduce); hoja de
   conteo marcada `ui-allow: impresión`; Salidas: «Sin stock» y «Bajo stock» con `StatusBadge` (ícono + tono).
1. ~~**Directorio**~~ — **hecho 17 nov**: formulario de proveedor con `useFormErrors` (nombre obligatorio con asterisco,
   error del servidor en aviso), aviso de descartar con `useFormBaseline`, contactos como tarjetas con campos titulados,
   íconos dentro de los campos, sin «opcional»; filtros Todos/Materiales/Servicios con ícono (`ICON.materials`, `ICON.service`).
2. **Settings**: `user-form-dialog` y `remove-user-dialog` usan `setError`; **íconos de permisos en Settings → Usuarios** (prometido).
3. **Inspecciones**, **Proyectos** y **Cotización**: barrido completo (formularios, filtros con ícono, estados, vacíos, carga, diálogos con aviso de descartar).
4. `planilla/auditoria-view.tsx`: un color azul literal en las celdas de proyección → decidir el token con Carlos.
5. Fecha del formulario de contrato sale en inglés en el iPhone («Nov 13, 2026») → mostrarla en el idioma de la app.
6. Bajar a 0 las líneas base de la guardia (hoy: «opcional» 0, archivos con `setError` 2, cierres sin guardia 7, colores literales 3).
7. **En pausa por decisión de Carlos** (no tocar sin que lo pida): rediseño del encabezado del teléfono; selector de etapas de Compras.

> Estado: **solo diseñado, nada construido todavía.** Se acordó esperar al miércoles para no gastar el uso de la
> sesión antes del reinicio del jueves 19 nov. Si el miércoles sobra uso, se hace; si no, se pasa al siguiente ciclo.

## Qué se quiere
Un auditor (otra sesión, aparte de la de desarrollo) que revise que se cumplan las reglas de la app
(`UI-RULES.md`, `CLAUDE.md`, `FOUNDATION.md`) en todas las pantallas. Carlos siente que lo hecho está ~80 % bien y
que ~20 % se escapó (ejemplos reales de la sesión del 14 nov: «Cargando…» sueltos, vacíos de Personal sin el
componente común, el aviso de descartar que salía siempre). Un revisor con contexto limpio los encuentra mejor que
quien escribió el código.

## Decisiones tomadas por Carlos
1. **No recurrente por calendario: se amarra a Git.** Revisa lo que cambió y **las áreas que ese cambio afecta**.
2. **Primera auditoría completa, partida por módulos, en paralelo** (cada sesión solo informa, no toca código).
3. **Informes:** pueden quedar en la sesión del auditor y también como archivo en el repositorio (`audits/`).
   El correo con resumen es opcional: solo se activa si Carlos lo pide.
4. Los arreglos los hace **esta misma sesión de diseño**, por tandas y con el visto bueno de Carlos, después de leer cada informe. La auditoría en sí solo informa (y cada tanda de barrido la revisa un revisor aparte con contexto limpio).

## Diseño

### Cómo sabe qué hay nuevo (Git, no memoria)
- Archivo marcador en el repo (`AUDIT.md`): último commit auditado + lista de pantallas/rutas ya auditadas.
- Cada corrida: `git diff <último-commit-auditado>..HEAD` → archivos cambiados → audita → escribe informe → mueve el marcador.
- Una ruta o página que no esté en la lista de pantallas auditadas se marca «nueva, sin auditar» aunque nadie avise.
- Disparo (no se puede «escuchar» cada push; solo hay eventos en pull requests, y se está subiendo directo a `main`):
  1. **A pedido:** «audita lo nuevo» (por ejemplo antes de desplegar). *Recomendado.*
  2. **Tarea programada diaria que solo actúa si hubo commits nuevos** (si HEAD == marcador, termina en segundos). *Recomendado junto con la 1.*
  3. **Pasar a pull requests** y que el auditor revise cada uno antes de llegar a producción. Lo más seguro, pero cambia el flujo de trabajo; decidir más adelante.

### Análisis de impacto («a quién afecta»)
No revisa solo los archivos cambiados: busca quién los usa. Ejemplo: tocar `contracts-table.tsx` afecta la lista de
Contratos, la ficha del contratista y la ficha del proyecto. Un cambio en una función o migración de la base revisa
las pantallas, las políticas (RLS) y la integración MCP que dependen de ella. La lista «a quién afecta» va en el informe.

### Qué revisa (lista de verificación con gravedad — falta escribirla)
Partir de `UI-RULES.md` y convertirlo en checklist con gravedad (seguridad/permisos > datos > interfaz):
- Permisos: `requireModule()` en el servidor y `private.has_module()` / RLS en la base.
- Textos en español e inglés; sin precios, nombres ni colores escritos a mano.
- Estados de carga (`LoadingBlock`), vacío y error (`EmptyState`); avisos (toast) al guardar/borrar.
- Formularios: `Field`, `FormSection`, `useFormErrors`, `useDiscardGuard`/`useFormBaseline`, fechas con `Input type="date"`.
- Filtros con ícono, estados con `StatusBadge`, íconos de `ICON`, vista de teléfono (tablas con tarjeta o desplazamiento).
- Vocabulario unificado (Acordado / Abonado / Pendiente / Descuentos / Saldo / A pagar).
- Correr `npx vitest run`, `npx tsc --noEmit` y `npx eslint` y anotar el resultado.

### Primera auditoría: módulos (≈ 8 sesiones en paralelo)
1. Cotización y Ventas (cotizador, seguimiento, clientes)  2. Proyectos  3. Almacén (compras, herramientas, salidas)
4. Contratistas  5. Personal y Planilla  6. Inspecciones  7. Directorio y Settings  8. Compartido (menú, componentes comunes, Dashboard).

## Límites a recordar
- Hoy revisa **código**, no ve pantallas (la app pide Google para entrar) — ver «Pendiente nuevo» arriba para resolverlo.
- Puede señalar cosas que no son problema: por eso cada hallazgo debe traer archivo y línea, y el auditor no cambia código.
- Cada sesión consume uso; por eso se parte por módulo y no se repite lo ya auditado.

## Acceso visual (resuelto 17 nov, decisión de Carlos)
- **Cuenta:** `auditor@ebonypanama.com`, **admin** (Carlos aprobó que vea todos los datos para revisar bien). Creada
  directo en la base (lista de permitidos + usuario de correo ya confirmado). El correo no existe: no recibe nada.
- **Sin contraseña guardada:** cada vez que se use, ponerle una nueva al azar con el conector de Supabase
  (`update auth.users set encrypted_password = extensions.crypt('<al azar>', extensions.gen_salt('bf')) where email = 'auditor@ebonypanama.com'`)
  y no anotarla en ningún lado.
- **Entrar:** con `@supabase/ssr` (`createServerClient` con un frasco de cookies en memoria) hacer
  `auth.signInWithPassword`, pasar esas cookies (`sb-jdfkfbopecqvvyxherku-auth-token…`) al contexto de Playwright y abrir
  las rutas. Capturas a 390 px (teléfono) y escritorio. **Solo mirar: no guardar nada con esta cuenta.**
- **Red:** hace falta el entorno **«ebony-manager»** (ya creado: deja pasar `jdfkfbopecqvvyxherku.supabase.co` y
  `admin.ebonypanama.com`, e instala dependencias al arrancar). La sesión de diseño del 17 nov no se pudo mover a él
  (fue creada por otra sesión): las capturas funcionan en una sesión nueva abierta en ese entorno.
- **Probado y funcionando (17 nov, sesión «Diseño (barrido y auditor)» nueva):** el script `scripts/capturas.mjs` hace
  todo (entra, pasa la cookie `sb-jdfkfbopecqvvyxherku-auth-token` a Playwright y saca teléfono + escritorio por ruta):
  `ANON=<clave anon> AUDITOR_PW=<la recién puesta> node scripts/capturas.mjs <carpeta> /almacen/salidas …`.
  La contraseña se guarda solo en un archivo temporal del scratchpad y se borra al terminar. Las capturas van al
  scratchpad, no al repositorio.
- **Ojo:** el campo de fecha nativo sale como el navegador quiere (en Chromium de prueba, «11/17/2026»); es el mismo
  problema del punto 5 del barrido.
- Para ver una versión antes de publicar: `next dev` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (claves públicas; se leen con el conector de Supabase) y la misma cuenta.

## Pendiente nuevo (15 nov): que Claude pueda VER la app, no solo leer el código
Carlos pidió resolver esto: revisar solo por código limita mucho (no se ven cortes de texto, saltos, cómo queda en
el teléfono). Hoy no se puede porque la app solo deja entrar con Google, y eso no se puede automatizar en un navegador
de prueba. La sesión sí tiene Chromium + Playwright instalados para sacar capturas a tamaño de teléfono.

Opciones a evaluar (decidir con Carlos):
1. **Usuario de prueba con correo y contraseña, solo fuera de producción.** Crear en Supabase una cuenta «auditor»
   con contraseña y una entrada por contraseña que solo exista en el servidor local / vista previa (nunca en
   admin.ebonypanama.com). Claude levanta la app en la sesión, entra con Playwright y saca capturas de cada pantalla
   en teléfono y escritorio. *La más simple.*
2. **Enlace de acceso generado por el servidor** (magic link con la API de administración de Supabase) para esa cuenta
   de prueba: no hace falta pantalla de contraseña, pero la sesión necesita la clave de servicio de Supabase como
   credencial guardada (no en el código ni en el chat).
3. **Datos:** decidir si el auditor ve la base real (sueldos, saldos) o una copia/rama de prueba de Supabase. Con la
   real, darle a la cuenta de prueba solo lectura y solo los módulos necesarios.
4. Revisar con `read_documentation` (red y credenciales del entorno) qué hosts y claves hacen falta para que la app
   corra dentro de la sesión.

Cuando esto funcione, el auditor agrega capturas a su informe (por pantalla, teléfono y escritorio) y lo visual deja
de depender solo de las capturas de Carlos.

## Pasos cuando se retome (en este orden)
0. Resolver el acceso visual a la app (sección «Pendiente nuevo»).
1. Escribir la lista de verificación con gravedad (`UI-RULES.md` → checklist).
2. Crear `AUDIT.md` (marcador) y la instrucción de análisis de impacto.
3. Lanzar las sesiones por módulo (solo informe; cada una escribe `audits/AAAA-MM-DD-<modulo>.md`).
4. Leer informes, arreglar por pantalla, mover el marcador.
5. Dejar el comando «audita lo nuevo» y, si se quiere, la tarea diaria que solo actúa si hubo commits nuevos.

Preguntas abiertas: ¿correo con resumen o solo la sesión? ¿Tarea diaria condicionada a commits o solo a pedido?

## Otros pendientes de la sesión de desarrollo (no relacionados con el auditor)
- Barrido de consistencia: Directorio (el formulario de proveedor aún usa `setError`), Settings (`user-form-dialog`, `remove-user-dialog`
  usan `setError`; íconos de permisos en Usuarios), Inspecciones, Proyectos, Cotización; filtros sin ícono que queden.
- `planilla/auditoria-view.tsx`: un color azul literal en las celdas de proyección (decidir qué token usar).
- Fecha del formulario de contrato sale en inglés («Nov 13, 2026») según el idioma del iPhone: mostrarla en el idioma de la app.
- Encabezado del teléfono (rediseño en pausa) y selector de etapas de Compras (decisión pendiente).
- Contrato en $0.00 duplicado («Panelado puerta de baño y closet», Wilson Castro): lo revisa Carlos, no se borra desde acá.
